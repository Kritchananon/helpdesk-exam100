import { Controller, Post, Get, UseGuards, Request, Param, ParseIntPipe, Body, Delete, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PermissionGuard } from '../permission/permission.guard';
import { RequireAnyAction } from '../permission/permission.decorator';

@Controller('api')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  //  ใช้โค้ดนี้เพื่อดึงและส่งข้อมูลของ project
  @UseGuards(JwtAuthGuard)
  @Post('getProjectDDL')
  async getProjectDDL(@Request() req) {
    console.log('User in request:', req.user);
    const userId = req.user.id || req.user.sub || req.user.userId;
    const result = await this.projectService.getProjectsForUser(userId);

    return {
      code: result.code,
      status: result.status,
      message: result.message,
      data: result.data
    }
  }

  // ใช้โค้ดนี้เพื่อ create project
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_project')
  @Post('projects')
  async createProject(@Body() createProjectDto: CreateProjectDto, @Request() req) {
    console.log('User in request:', req.user);
    const userId = req.user.id || req.user.sub || req.user.userId

    // add user_id in dto
    createProjectDto.create_by = userId;

    return this.projectService.createProject(createProjectDto);
  }

  // เส้นดึง project พร้อมกับ status true false
  @UseGuards(JwtAuthGuard)
  @Get('get_all_project')
  async getProjectAll() {
    return await this.projectService.getProjects()
  }

  // use this code for update project
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_project')
  @Patch('project/update/:id')
  async updateProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: Partial<UpdateProjectDto>,
  ) {
    return this.projectService.updateProject(id, updateProjectDto);
  }

  // use this code for delete project
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_project')
  @Delete('project/delete/:id')
  async deleteProject(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.deleteProject(id);
  }
}
