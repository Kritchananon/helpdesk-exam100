// customer_for_project/customer_for_project.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { CustomerForProjectService } from './customer_for_project.service';
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequireAnyAction } from '../permission/permission.decorator';

@Controller('api/customer-for-project')
export class CustomerForProjectController {
  constructor(private readonly customerForProjectService: CustomerForProjectService) { }

  // use this code for create customer for project
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Post()
  create(@Body() dto: CreateCustomerForProjectDto, @Request() req) {
    const userId = req.user.id || req.user.sub || req.user.userId;
    dto.create_by = userId;
    dto.update_by = userId;

    return this.customerForProjectService.create(dto);
  }

  // use this one code for show data of customer for project
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Get('cfp-data')
  getCFPdata() {
    return this.customerForProjectService.getCFPdata();
  }
  
  // use this one
  @Get('customer/:customerId/projects')
  getProjectsByCustomer(
    @Param('customerId', ParseIntPipe) customerId: number
  ) {
    return this.customerForProjectService.getProjectsByCustomer(customerId);
  }

  // use
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Patch('cfp/update/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerForProjectDto: UpdateCustomerForProjectDto,
    @Request() req
  ) {
    const userId = req.user.id || req.user.sub || req.user.userId;
    updateCustomerForProjectDto.create_by = userId;
    updateCustomerForProjectDto.update_by = userId;
    return this.customerForProjectService.update(id, updateCustomerForProjectDto, req.user.userId);
  }

  // use
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Delete('cfp/delete/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.customerForProjectService.remove(id);
  }
}