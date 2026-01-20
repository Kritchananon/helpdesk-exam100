import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { Users } from '../users/entities/user.entity';

export interface UserPermissionInfo {
  userId: number;
  username: string;
  roles: Array<{ roleId: number; roleName: string }>;
  permissions: Array<{ permissionId: number; permissionName: string }>;
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private permissionCache = new Map<number, UserPermissionInfo>();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private cacheTimestamps = new Map<number, number>();

  constructor(
    @InjectRepository(UserAllowRole)
    private readonly userAllowRoleRepo: Repository<UserAllowRole>,
    @InjectRepository(MasterRole)
    private readonly masterRoleRepo: Repository<MasterRole>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    private readonly dataSource: DataSource,
  ) {}

  // ดึงข้อมูล user + roles
  async getUserPermissionInfo(userId: number): Promise<UserPermissionInfo | null> {
    if (this.isCacheValid(userId)) return this.permissionCache.get(userId) || null;

    try {
      const results = await this.dataSource.query(
        `
        SELECT u.id as user_id, u.username, mr.id as role_id, mr.role_name
        FROM users u
        LEFT JOIN users_allow_role uar ON u.id = uar.user_id
        LEFT JOIN master_role mr ON uar.role_id = mr.id
        WHERE u.id = $1 AND u.isenabled = true
        `,
        [userId],
      );

      if (results.length === 0) return null;

      const roles = results.filter(r => r.role_id !== null).map(r => ({
        roleId: Number(r.role_id),
        roleName: r.role_name,
      }));

      const permissions = roles.map(r => ({ permissionId: r.roleId, permissionName: r.roleName }));

      const userInfo: UserPermissionInfo = {
        userId: results[0].user_id,
        username: results[0].username,
        roles,
        permissions,
      };

      this.permissionCache.set(userId, userInfo);
      this.cacheTimestamps.set(userId, Date.now());

      return userInfo;
    } catch (err) {
      this.logger.error(`Error getting user permission info for user ${userId}:`, err);
      return null;
    }
  }

  // ตรวจสอบ role
  async hasRole(userId: number, roleId: number, userPermissions: number[]): Promise<boolean> {
    return userPermissions.includes(roleId);
  }

  async hasAnyRole(userId: number, requiredRoles: number[], userPermissions: number[]): Promise<boolean> {
    return requiredRoles.some(role => userPermissions.includes(role));
}

  async hasAllRoles(userId: number, roleIds: number[], userPermissions: number[]): Promise<boolean> {
    return roleIds.every(rid => userPermissions.includes(rid));
  }

  async getUserRoleIds(userId: number): Promise<number[]> {
    const userInfo = await this.getUserPermissionInfo(userId);
    return userInfo ? userInfo.roles.map(r => r.roleId) : [];
  }

  async getUserRoleNames(userId: number): Promise<string[]> {
    const userInfo = await this.getUserPermissionInfo(userId);
    return userInfo ? userInfo.roles.map(r => r.roleName) : [];
  }

  // ------------------- ฟังก์ชัน canXxx -------------------
  async canCreateUser(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 15, userPermissions);
  }
  async canReadUser(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 15, userPermissions);
  }
  async canUpdateUser(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 15, userPermissions);
  }
  async canDeleteUser(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 16, userPermissions);
  }

  async canCreateCustomer(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 20, userPermissions);
  }

  async canCreateTicket(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 1, userPermissions);
  }
  async canReadTicketDetial(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 12, userPermissions);
  }
  async canReadAllTickets(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 13, userPermissions);
  }
  async canUpdateTicket(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [3, 19], userPermissions);
  }
  async canDeleteTicket(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [4, 19], userPermissions);
  }
  async canRestoreTicket(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [11, 19], userPermissions);
  }
  async canViewDeletedTickets(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [11, 19], userPermissions);
  }
  async canGetAllMasterFillter(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [1, 13], userPermissions);
  }

  async canAssignTicket(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [19], userPermissions);
  }
  
  async canGetAssign(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 9, userPermissions);
  }
  async canChangeStatus(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [5, 13], userPermissions);
  }
  async canSolveProblem(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [8], userPermissions);
  }

  async canCreateProject(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [10], userPermissions);
  }
  
  async canReadProject(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [1], userPermissions);
  }
  async canReadAllProject(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [13], userPermissions);
  }
  async canUpdateProject(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [10, 13], userPermissions);
  }
  async canDeleteProject(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [10, 13], userPermissions);
  }

  async canManageCategory(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [17, 13], userPermissions);
  }
  async canManageStatus(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasAnyRole(userId, [18, 13], userPermissions);
  }
  async canRateSatisfaction(userId: number, userPermissions: number[]): Promise<boolean> {
    return this.hasRole(userId, 14, userPermissions);
  }

  async isResourceOwner(userId: number, resourceCreatorId: number): Promise<boolean> {
    return userId === resourceCreatorId;
  }

  async canAccessResource(
    userId: number,
    resourceCreatorId: number,
    requiredRoles: number[],
    userPermissions: number[],
  ): Promise<boolean> {
    if (await this.isResourceOwner(userId, resourceCreatorId)) return true;
    return this.hasAnyRole(userId, requiredRoles, userPermissions);
  }

  // ------------------- Cache -------------------
  private isCacheValid(userId: number): boolean {
    const timestamp = this.cacheTimestamps.get(userId);
    return timestamp ? Date.now() - timestamp < this.CACHE_TTL : false;
  }

  clearUserCache(userId: number): void {
    this.permissionCache.delete(userId);
    this.cacheTimestamps.delete(userId);
  }
  clearAllCache(): void {
    this.permissionCache.clear();
    this.cacheTimestamps.clear();
  }

  // ------------------- Debug -------------------
  async debugUserPermissions(userId: number, userPermissions: number[]): Promise<any> {
    return {
      userId,
      userPermissions,
      canCreateUser: await this.canCreateUser(userId, userPermissions),
      canReadUser: await this.canReadUser(userId, userPermissions),
      canCreateTicket: await this.canCreateTicket(userId, userPermissions),
      canReadAllTickets: await this.canReadAllTickets(userId, userPermissions),
      canUpdateTicket: await this.canUpdateTicket(userId, userPermissions),
      canDeleteTicket: await this.canDeleteTicket(userId, userPermissions),
      canAssignTicket: await this.canAssignTicket(userId, userPermissions),
      canGetAssign: await this.canGetAssign(userId, userPermissions),
      canChangeStatus: await this.canChangeStatus(userId, userPermissions),
    };
  }
}
