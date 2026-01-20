import { Body, Controller, Post, Get, Param, Put, Delete, Query, UseGuards, Req, ForbiddenException, Patch } from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RequireRoles, RequireAction, RequireRolesOrOwner } from '../permission/permission.decorator';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { CreateUserAllowRoleDto } from '../user_allow_role/dto/create-user_allow_role.dto';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) { }
  
  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('create_user')
  async create(@Body() body: any, @Req() req: Request) {
    const userId = req.user && req.user['id'] ? req.user['id'] : null;

    // สร้าง CreateUserDto
    const createUserDto = new CreateUserDto();
    createUserDto.username = body.username;
    createUserDto.password = body.password;
    createUserDto.email = body.email;
    createUserDto.firstname = body.firstname;
    createUserDto.lastname = body.lastname;
    createUserDto.phone = body.phone;
    createUserDto.create_by = userId;
    createUserDto.update_by = userId;

    // สร้าง CreateUserAllowRoleDto ถ้ามี role_id
    let createUserAllowRoleDto;
    if (body.role_id && Array.isArray(body.role_id) && body.role_id.length > 0) {
      createUserAllowRoleDto = new CreateUserAllowRoleDto();
      createUserAllowRoleDto.role_id = body.role_id;
    }

    console.log('Received User DTO:', createUserDto);
    console.log('Received Role DTO:', createUserAllowRoleDto);

    return await this.userService.create(createUserDto, createUserAllowRoleDto);
  }

  // ใช้ตรงรายการหน้า user account
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('create_user')
  @Get('account')
  async getUserAccount() {
    return this.userService.userAccount();
  }

  // 
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('create_user')
  @Get('Allusers')
  async allUsers() {
    return this.userService.getAllUser();
  }

  // ใช้ตรงดึงข้อมูลออกไปแสเงในหน้า my profile
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Get(':id')
  async getUserById(@Param('id') id: number) {
    return this.userService.getUserAccountById(+id);
  }

  @Patch('update/:id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: Request) {

    const userId = req.user && req.user['id'] ? req.user['id'] : null;

    updateUserDto.update_by = userId;
    updateUserDto.create_by = userId;
    return this.userService.update(+id, updateUserDto);
  }

  @Delete('delete/:id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}