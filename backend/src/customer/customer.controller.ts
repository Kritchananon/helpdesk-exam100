// customer/customer.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequireAnyAction } from '../permission/permission.decorator';

@Controller('api')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) { }

  // use this code for create customer
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Post('customer')
  create(@Body() createCustomerDto: CreateCustomerDto, @Request() req) {
    console.log('User in request:', req.user);

    const userId = req.user?.id || req.user?.sub || req.user?.userId;

    // add user_id in dto
    createCustomerDto.create_by = userId;
    createCustomerDto.update_by = userId;

    return this.customerService.create(createCustomerDto, userId);
  }

  // use this code for get data of customer ecth name or address
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Get('get_customer_data')
  async getCustomerData() {
    return this.customerService.getCustomer()
  }

  // use thid code for get all customer to show in drop down in customer for project page
  @UseGuards(JwtAuthGuard)
  @Get('get_all_customer')
  findAllcustomer() {
    return this.customerService.getAllCustomer();
  }

  // use this code for update customer data
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Patch('customer/update/:id')
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Request() req,
  ) {
    console.log('User in request:', req.user);

    const userId = req.user?.id || req.user?.sub || req.user?.userId;

    // add user_id in dto
    updateCustomerDto.create_by = userId;
    updateCustomerDto.update_by = userId;

    return this.customerService.update(+id, updateCustomerDto, userId);
  }

  // use this code for delete customer
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('manage_customer')
  @Delete('customer/delete/:id')
  remove(@Param('id') id: string) {
    return this.customerService.remove(+id);
  }
}
