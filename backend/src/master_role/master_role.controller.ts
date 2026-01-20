import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { MasterRoleService } from './master_role.service';
import { CreateMasterRoleDto } from './dto/create-master_role.dto';
import { UpdateMasterRoleDto } from './dto/update-master_role.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequireAnyAction } from '../permission/permission.decorator';

@Controller('api/master_role')
export class MasterRoleController {
  constructor(private readonly masterRoleService: MasterRoleService) { }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Post()
  create(@Body() createMasterRoleDto: CreateMasterRoleDto) {
    return this.masterRoleService.create(createMasterRoleDto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Get('all_roles')
  findAll() {
    return this.masterRoleService.getAllRoles();
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.masterRoleService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Get('name/:name')
  findByName(@Param('name') name: string) {
    return this.masterRoleService.findByName(name);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMasterRoleDto: UpdateMasterRoleDto,
  ) {
    return this.masterRoleService.update(id, updateMasterRoleDto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.masterRoleService.remove(id);
  }
}
