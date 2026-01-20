import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean } from "class-validator";
import { NotificationType } from "../entities/notification.entity";

export class CreateNotificationDto {
    @IsString()
    ticket_no: string;

    @IsNumber()
    user_id: number;

    @IsOptional()
    @IsNumber()
    status_id?: number;

    @IsEnum(NotificationType)
    notification_type: NotificationType;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsBoolean()
    is_read?: boolean;

    @IsOptional()
    @IsBoolean()
    email_sent?: boolean;
}
