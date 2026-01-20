import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../permission/permission.service';

export interface PermissionConfig {
  roles?: number[];
  action?: string;
  actions?: string[];
  allowOwner?: boolean;
  logicType?: 'OR' | 'AND';
}

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startTime = Date.now();
    this.logger.debug('🚀 PermissionGuard started');

    try {
      const permissionConfig = this.reflector.getAllAndOverride<PermissionConfig>(
        'permission_config',
        [context.getHandler(), context.getClass()],
      );

      this.logger.debug(`📋 Permission config: ${JSON.stringify(permissionConfig)}`);

      if (!permissionConfig) {
        this.logger.debug('✅ No permission config found, allowing access');
        return true;
      }

      const request = context.switchToHttp().getRequest();
      const user = request.user;

      this.logger.debug(`👤 User from request: ${JSON.stringify({
        id: user?.id,
        userId: user?.userId,
        user_id: user?.user_id,
        sub: user?.sub,
        username: user?.username
      })}`);

      if (!user) {
        this.logger.warn('❌ No user found in request');
        return false;
      }

      const userId = user.id || user.sub || user.userId || user.user_id;
      this.logger.debug(`🔍 Extracted userId: ${userId} (type: ${typeof userId})`);

      if (!userId) {
        this.logger.warn('❌ No valid userId found');
        return false;
      }

      // Convert to number if needed
      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      this.logger.debug(`🔢 Numeric userId: ${numericUserId}`);

      if (isNaN(numericUserId)) {
        this.logger.warn(`❌ Invalid userId: ${userId}`);
        return false;
      }

      // ดึง permissions/roles ของ user
      const userPermissions: number[] = await this.permissionService.getUserRoleIds(numericUserId);

      // ตรวจสอบตาม action (single)
      if (permissionConfig.action) {
        this.logger.debug(`🎯 Checking single action: ${permissionConfig.action}`);
        const result = await this.checkActionPermission(
          numericUserId,
          permissionConfig.action,
          userPermissions
        );
        this.logger.debug(`✨ Single action result: ${result}`);
        return result;
      }

      // ตรวจสอบตาม actions (multiple)
      if (permissionConfig.actions && permissionConfig.actions.length > 0) {
        this.logger.debug(`🎯 Checking multiple actions: ${permissionConfig.actions}`);
        const logicType = permissionConfig.logicType || 'OR';
        const result = await this.checkMultipleActions(
          numericUserId,
          permissionConfig.actions,
          logicType,
          userPermissions
        );
        this.logger.debug(`✨ Multiple actions result: ${result}`);
        return result;
      }

      // ตรวจสอบตาม roles
      if (permissionConfig.roles) {
        this.logger.debug(`🎯 Checking roles: ${permissionConfig.roles}`);

        const hasRole = await this.permissionService.hasAnyRole(
          numericUserId,
          permissionConfig.roles,
          userPermissions
        );

        this.logger.debug(`✨ Role check result: ${hasRole}`);

        if (!hasRole && permissionConfig.allowOwner) {
          this.logger.debug('🔍 Checking resource ownership');
          const resourceId = this.extractResourceId(request);
          if (resourceId) {
            const ownershipResult = await this.checkResourceOwnership(numericUserId, resourceId, request);
            this.logger.debug(`✨ Ownership result: ${ownershipResult}`);
            return ownershipResult;
          }
        }

        return hasRole;
      }

      this.logger.warn('❌ No valid permission configuration found');
      return false;

    } catch (error) {
      this.logger.error(`💥 Error in PermissionGuard: ${error.message}`, error.stack);
      return false;
    } finally {
      const endTime = Date.now();
      this.logger.debug(`⏱️ PermissionGuard execution time: ${endTime - startTime}ms`);
    }
  }

  private mapActionToRoleId(action: string): number {
    // แปลง action เป็น roleId (permission)
    const actionMap: Record<string, number> = {
      CREATE_USER: 15,
      READ_USER: 15,
      UPDATE_USER: 15,
      DELETE_USER: 16,
      CREATE_TICKET: 1,
      // เพิ่ม mapping ตาม business logic ของคุณ
    };
    return actionMap[action] ?? 0;
  }

  private async checkMultipleActions(userId: number, actions: string[], logicType: 'OR' | 'AND', userPermissions: number[]): Promise<boolean> {
    this.logger.debug(`🔄 Checking ${actions.length} actions with ${logicType} logic for user ${userId}`);
    
    const results = await Promise.all(
      actions.map(async (action, index) => {
        const result = await this.checkActionPermission(userId, action, userPermissions);
        this.logger.debug(`  ${index + 1}. ${action}: ${result}`);
        return result;
      })
    );

    if (logicType === 'AND') {
      const hasAllPermissions = results.every(result => result === true);
      this.logger.debug(`🔗 AND logic result: ${hasAllPermissions} (all must be true: ${results})`);
      return hasAllPermissions;
    } else {
      const hasAnyPermission = results.some(result => result === true);
      this.logger.debug(`🔗 OR logic result: ${hasAnyPermission} (any can be true: ${results})`);
      return hasAnyPermission;
    }
  }

  private async checkActionPermission(userId: number, action: string, userPermissions: number[]): Promise<boolean> {
    this.logger.debug(`🎬 Checking action '${action}' for user ${userId}`);
    
    try {
      const actionMap = {
        'create_user': () => this.permissionService.canCreateUser(userId, userPermissions),
        'read_user': () => this.permissionService.canReadUser(userId, userPermissions),
        'update_user': () => this.permissionService.canUpdateUser(userId, userPermissions),
        'delete_user': () => this.permissionService.canDeleteUser(userId, userPermissions),
        'create_ticket': () => this.permissionService.canCreateTicket(userId, userPermissions),
        'read_ticket': () => this.permissionService.canReadTicketDetial(userId, userPermissions),
        'read_all_tickets': () => this.permissionService.canReadAllTickets(userId, userPermissions),
        'update_ticket': () => this.permissionService.canUpdateTicket(userId, userPermissions),
        'delete_ticket': () => this.permissionService.canDeleteTicket(userId, userPermissions),
        'restore_ticket': () => this.permissionService.canRestoreTicket(userId, userPermissions),
        'viwe_ticket_delete': () => this.permissionService.canViewDeletedTickets(userId, userPermissions),
        'assign_ticket': () => this.permissionService.canAssignTicket(userId, userPermissions),
        'get_assign': () => this.permissionService.canGetAssign(userId, userPermissions),
        'change_status': () => this.permissionService.canChangeStatus(userId, userPermissions),
        'solve_problem': () => this.permissionService.canSolveProblem(userId, userPermissions),
        'create_project': () => this.permissionService.canCreateProject(userId, userPermissions),
        'read_project': () => this.permissionService.canReadProject(userId, userPermissions),
        'read_all_project': () => this.permissionService.canReadAllProject(userId, userPermissions),
        'manage_category': () => this.permissionService.canManageCategory(userId, userPermissions),
        'manage_status': () => this.permissionService.canManageStatus(userId, userPermissions),
        'rate_satisfaction': () => this.permissionService.canRateSatisfaction(userId, userPermissions),
        'get_all_master_fillter': () => this.permissionService.canGetAllMasterFillter(userId, userPermissions),
        'manage_customer': () => this.permissionService.canCreateCustomer(userId, userPermissions),
      };

      const permissionCheck = actionMap[action];
      if (!permissionCheck) {
        this.logger.warn(`❌ No permission check found for action: ${action}`);
        this.logger.warn(`Available actions: ${Object.keys(actionMap).join(', ')}`);
        return false;
      }

      const result = await permissionCheck();
      this.logger.debug(`🎭 Permission check result for '${action}': ${result}`);
      
      // เพิ่ม debug ข้อมูล user permission
      if (!result) {
        const userInfo = await this.permissionService.getUserPermissionInfo(userId);
        this.logger.debug(`🔍 User ${userId} roles: ${JSON.stringify(userInfo?.roles || [])}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Error checking action ${action}: ${error.message}`);
      return false;
    }
  }

  private extractResourceId(request: any): string | null {
    return request.params.id || request.params.ticket_no || request.params.ticket_id || null;
  }

  private async checkResourceOwnership(userId: number, resourceId: string, request: any): Promise<boolean> {
    if (request.route.path.includes('ticket')) {
      return false; // placeholder
    }
    return false;
  }
}