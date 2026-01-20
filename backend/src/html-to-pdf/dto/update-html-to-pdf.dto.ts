import { PartialType } from '@nestjs/swagger';
import { HtmlToPdfDto } from './create-html-to-pdf.dto';

export class UpdateHtmlToPdfDto extends PartialType(HtmlToPdfDto) {}
