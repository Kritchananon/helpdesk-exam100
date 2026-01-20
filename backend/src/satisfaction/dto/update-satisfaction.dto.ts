import { PartialType } from '@nestjs/swagger';
import { CreateSatisfactionDto } from './create-satisfaction.dto';

export class UpdateSatisfactionDto extends PartialType(CreateSatisfactionDto) {}
