import { IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketAttachmentDto } from './create-ticket_attachment.dto';

export class UpdateTicketAttachmentDto extends PartialType(CreateTicketAttachmentDto) {
    @IsOptional()
    ticket_id?: number;

    @IsOptional()
    project_id?: number;

    @IsOptional()
    categories_id?: number;

    @IsOptional()
    issue_description?: string;
}
