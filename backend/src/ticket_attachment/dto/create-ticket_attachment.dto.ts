import { IsNotEmpty, IsOptional, IsString, IsInt, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketAttachmentDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  ticket_id: number;

  @IsOptional()
  @IsString()
  type?: string = 'Reporter'; // "Reporter" || "supporter"

  @IsOptional()
  @IsString()
  extension?: string; // จะถูก set อัตโนมัติจากไฟล์

  @IsOptional()
  @IsString()
  filename?: string; // จะถูก set อัตโนมัติ

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  create_by?: number; // จะถูก set จาก JWT

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  update_by: number;
}
