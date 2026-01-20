// customer/customer.service.ts
import { Injectable, Logger } from '@nestjs/common'; // 1. Import Logger
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  // 2. สร้าง instance ของ Logger
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, userId: number) {
    const customer = new Customer();
    customer.name = createCustomerDto.name;
    customer.address = createCustomerDto.address;
    customer.telephone = createCustomerDto.telephone;
    customer.email = createCustomerDto.email;
    customer.create_by = createCustomerDto.create_by;
    customer.update_by = createCustomerDto.update_by;
    customer.isenabled = true;

    await this.customerRepository.save(customer);

    return {
      code: 1,
      status: true,
      message: 'เพิ่มข้อมูลลูกค้าสำเร็จ',
      data: customer,
    };
  }

  async getCustomer() {
    try {
      const result = await this.customerRepository
        .createQueryBuilder('c')
        .select([
          'c.id',
          'c.name',
          'c.address',
          'c.email',
          'c.telephone',
          'c.status',
        ])
        .where('isenabled = true')
        .getMany();

      return {
        code: 0,
        status: true,
        message: 'get customer data successfully',
        data: result,
      };
    } catch (error) {
      // 3. เปลี่ยนจาก console.log เป็น logger.error
      this.logger.error('Error get customer:', error.stack);

      return {
        code: 1,
        status: false,
        message: error,
      };
    }
  }

  async getAllCustomer() {
    try {
      const customer = await this.customerRepository
        .createQueryBuilder('c')
        .select(['c.id as id', 'c.name as name'])
        .groupBy('c.id')
        .getRawMany();

      return {
        code: 1,
        status: true,
        message: 'Success',
        data: customer,
      };
    } catch (error) {
      // 3. เปลี่ยนจาก console.error เป็น logger.error
      this.logger.error('Error in getAllProjects:', error.stack);
      return {
        code: 0,
        status: false,
        message: 'Failed to fetch all projects',
        error: error.message,
      };
    }
  }

  async update(
    id: number,
    updateCustomerDto: UpdateCustomerDto,
    userId: number,
  ) {
    this.logger.log(`Start update for customer id: ${id}`); // 3. เปลี่ยนเป็น logger.log

    // หา customer ก่อน
    const customer = await this.customerRepository.findOneBy({ id });
    if (!customer || !customer.isenabled) {
      this.logger.warn(`Customer not found or disabled: ${id}`); // 3. เปลี่ยนเป็น logger.warn
      return {
        code: 0,
        status: false,
        message: 'ไม่พบข้อมูลลูกค้า',
        data: null,
      };
    }

    // อัพเดต fields ทีละตัว
    const fieldsToUpdate: Partial<Customer> = {};
    if (updateCustomerDto.name)
      fieldsToUpdate.name = updateCustomerDto.name;
    if (updateCustomerDto.address)
      fieldsToUpdate.address = updateCustomerDto.address;
    if (updateCustomerDto.telephone)
      fieldsToUpdate.telephone = updateCustomerDto.telephone;
    if (updateCustomerDto.email)
      fieldsToUpdate.email = updateCustomerDto.email;
    if (updateCustomerDto.status != undefined)
      fieldsToUpdate.status = updateCustomerDto.status;

    // set update info
    fieldsToUpdate.update_by = userId;
    fieldsToUpdate.update_date = new Date();

    this.logger.debug('Fields to update:', fieldsToUpdate); // 3. เปลี่ยนเป็น logger.debug

    // ใช้ save แยก fields แทน merge ทั้ง object เพื่อลดปัญหา
    try {
      const updatedCustomer = await this.customerRepository.save({
        id: customer.id,
        ...fieldsToUpdate,
      });
      this.logger.log('Customer updated successfully'); // 3. เปลี่ยนเป็น logger.log

      return {
        code: 1,
        status: true,
        message: 'อัพเดตข้อมูลลูกค้าสำเร็จ',
        data: updatedCustomer,
      };
    } catch (error) {
      // 3. เปลี่ยนจาก console.error เป็น logger.error
      this.logger.error(`Error updating customer ${id}:`, error.stack);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดตข้อมูลลูกค้า',
        data: null,
      };
    }
  }

  async remove(id: number) {
    const customer = await this.customerRepository.findOneBy({ id });

    if (!customer || !customer.isenabled) {
      this.logger.warn(`Customer not found or disabled: ${id}`); // 3. เปลี่ยนเป็น logger.warn
      return {
        code: 0,
        status: false,
        message: 'ไม่พบข้อมูลลูกค้า',
        data: null,
      };
    }

    // Soft delete
    customer.isenabled = false;
    await this.customerRepository.save(customer);

    return {
      code: 1,
      status: true,
      message: 'ลบข้อมูลลูกค้าสำเร็จ',
    };
  }
}