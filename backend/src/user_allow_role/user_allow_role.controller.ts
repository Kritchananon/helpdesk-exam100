import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Put
} from '@nestjs/common';
import { UserAllowRoleService } from './user_allow_role.service';
import { CreateUserAllowRoleDto } from './dto/create-user_allow_role.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

@Controller()
export class UserAllowRoleController {
  constructor(private readonly userAllowRoleService: UserAllowRoleService) {}

  // Assign multiple roles to user
  @UseGuards(JwtAuthGuard)
  @Post('userAllowRole')
  create(@Body() createUserAllowRoleDto: CreateUserAllowRoleDto) {
    return this.userAllowRoleService.create(createUserAllowRoleDto);
  }

  // Replace all user roles (remove old, add new)
  @UseGuards(JwtAuthGuard)
  @Put('user/:user_id/replace')
  replaceUserRoles(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] }
  ) {
    return this.userAllowRoleService.replaceUserRoles(user_id, body.role_ids);
  }

  @Get()
  findAll() {
    return this.userAllowRoleService.findAll();
  }

  @Get('user/:user_id')
  findByUserId(@Param('user_id', ParseIntPipe) user_id: number) {
    return this.userAllowRoleService.findByUserId(user_id);
  }

  @Get('role/:role_id')
  findByRoleId(@Param('role_id', ParseIntPipe) role_id: number) {
    return this.userAllowRoleService.findByRoleId(role_id);
  }

  @Get('user/:user_id/role/:role_id')
  findOne(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Param('role_id', ParseIntPipe) role_id: number,
  ) {
    return this.userAllowRoleService.findOne(user_id, role_id);
  }

  @Get('user/:user_id/has-role/:role_id')
  async checkUserHasRole(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Param('role_id', ParseIntPipe) role_id: number,
  ) {
    const hasRole = await this.userAllowRoleService.userHasRole(user_id, role_id);
    return { hasRole };
  }

  @Get('user/:user_id/has-any-roles')
  async checkUserHasAnyRoles(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] }
  ) {
    const hasAnyRole = await this.userAllowRoleService.userHasAnyRole(user_id, body.role_ids);
    return { hasAnyRole };
  }

  @Get('user/:user_id/has-all-roles')
  async checkUserHasAllRoles(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] }
  ) {
    const hasAllRoles = await this.userAllowRoleService.userHasAllRoles(user_id, body.role_ids);
    return { hasAllRoles };
  }

  @Get('user/:user_id/role-names')
  getUserRoleNames(@Param('user_id', ParseIntPipe) user_id: number) {
    return this.userAllowRoleService.getUserRoleNames(user_id);
  }

  // Remove specific role from user
  @Delete('user/:user_id/role/:role_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Param('role_id', ParseIntPipe) role_id: number,
  ) {
    return this.userAllowRoleService.remove(user_id, role_id);
  }

  // Remove multiple specific roles from user
  @Delete('user/:user_id/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMultiple(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] }
  ) {
    return this.userAllowRoleService.removeMultiple(user_id, body.role_ids);
  }

  // Remove all roles from user
  @Delete('user/:user_id/all')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAllByUserId(@Param('user_id', ParseIntPipe) user_id: number) {
    return this.userAllowRoleService.removeAllByUserId(user_id);
  }

  // Remove all users from specific role
  @Delete('role/:role_id/all')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAllByRoleId(@Param('role_id', ParseIntPipe) role_id: number) {
    return this.userAllowRoleService.removeAllByRoleId(role_id);
  }
}
