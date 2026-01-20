import { IsString, IsOptional, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

export class HtmlToPdfDto {
  @IsString()
  reportNumber: string;

  @IsString()
  reportDate: string;

  @IsString()
  status: string;

  @IsString()
  reporter: string;

  @IsString()
  priority: string;

  @IsString()
  category: string;

  @IsString()
  project: string;

  @IsString()
  issueTitle: string;

  @IsString()
  issueDescription: string;

  // ✅ รองรับทั้ง string เดี่ยวและ array
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map(v => String(v));
    if (typeof value === 'string') return [value];
    return [];
  })
  attachmentUrl?: string[];

  @IsString()
  assignee: string;

  @IsString()
  estimatedCloseDate: string;

  @IsString()
  deadline: string;

  @IsString()
  estimateTime: string;

  @IsString()
  leadTime: string;

  @IsString()
  changeRequest: string;

  @IsString()
  solutionDescription: string;

  @IsString()
  satisfactionRating: string;

  @IsOptional()
  @IsObject()
  additionalData?: any;
}