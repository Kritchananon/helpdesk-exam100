import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerForProjectDto } from './create-customer_for_project.dto';

export class UpdateCustomerForProjectDto extends PartialType(CreateCustomerForProjectDto) {}
