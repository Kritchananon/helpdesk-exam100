import { IsOptional, IsBoolean } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateNotificationDto } from './create-notification.dto';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
    @IsOptional()
    @IsBoolean()
    is_read?: boolean;

    @IsOptional()
    @IsBoolean()
    email_sent?: boolean;
}
