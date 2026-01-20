import { PartialType } from '@nestjs/swagger';
import { CreateUserAllowRoleDto } from './create-user_allow_role.dto';

export class UpdateUserAllowRoleDto extends PartialType(CreateUserAllowRoleDto) {}
