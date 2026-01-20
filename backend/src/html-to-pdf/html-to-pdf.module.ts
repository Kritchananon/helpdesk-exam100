import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HtmlToPdfService } from './html-to-pdf.service';
import { HtmlToPdfController } from './html-to-pdf.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '3h' },
    }),
  ],
  controllers: [HtmlToPdfController],
  providers: [HtmlToPdfService],
})
export class HtmlToPdfModule {}
