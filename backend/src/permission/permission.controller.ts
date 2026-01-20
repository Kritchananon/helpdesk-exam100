import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  ParseIntPipe, 
  UseGuards 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequireRoles } from './permission.decorator';
import { PermissionService } from './permission.service';
import { UserAllowRoleService } from '../user_allow_role/user_allow_role.service';
import { MasterRoleService } from '../master_role/master_role.service';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoleManagementController {
  constructor(
    private permissionService: PermissionService,
    private userAllowRoleService: UserAllowRoleService,
    private masterRoleService: MasterRoleService,
  ) {}

  @Get()
  @RequireRoles(13) // เฉพาะ ADMIN
  async getAllRoles() {
    return this.masterRoleService.getAllRoles();
  }

  @Get(':roleId')
  @RequireRoles(13)
  async getRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.masterRoleService.getRoleById(roleId);
  }

  @Post()
  @RequireRoles(13)
  async createRole(@Body() createRoleDto: any) {
    return this.masterRoleService.create(createRoleDto);
  }

  @Put(':roleId')
  @RequireRoles(13)
  async updateRole(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() updateRoleDto: any
  ) {
    return this.masterRoleService.update(roleId, updateRoleDto);
  }

  @Delete(':roleId')
  @RequireRoles(13)
  async deleteRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.masterRoleService.remove(roleId);
  }

  @Get(':roleId/users')
  @RequireRoles(13)
  async getRoleUsers(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.userAllowRoleService.getUsersByRole(roleId);
  }

  @Post('assign')
  @RequireRoles(13)
  async assignRolesToUser(@Body() assignDto: { user_id: number; role_id: number[] }) {
    return this.userAllowRoleService.create(assignDto);
  }

  @Delete('user/:userId/role/:roleId')
  @RequireRoles(13)
  async removeRoleFromUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('roleId', ParseIntPipe) roleId: number
  ) {
    await this.userAllowRoleService.remove(userId, roleId);
    
    // Clear cache หลังจากเปลี่ยน role
    this.permissionService.clearUserCache(userId);
    
    return { message: 'Role removed successfully' };
  }

  @Put('user/:userId/roles')
  @RequireRoles(13)
  async replaceUserRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('role_ids') roleIds: number[]
  ) {
    const result = await this.userAllowRoleService.replaceUserRoles(userId, roleIds);
    
    // Clear cache หลังจากเปลี่ยน roles
    this.permissionService.clearUserCache(userId);
    
    return result;
  }
}