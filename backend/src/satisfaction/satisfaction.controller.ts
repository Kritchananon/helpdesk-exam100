import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { SatisfactionService } from './satisfaction.service';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

@Controller('api/satisfaction')
export class SatisfactionController {
  constructor(private readonly satisfactionService: SatisfactionService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':ticketId')
  create(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() createSatisfactionDto: CreateSatisfactionDto,
    @Request() req
  ) {
    const createBy = req.user.id || req.user.sub || req.user.userId;
    return this.satisfactionService.create(ticketId, createBy, createSatisfactionDto);
  }

  @Get()
  findAll() {
    return this.satisfactionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.satisfactionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSatisfactionDto: UpdateSatisfactionDto) {
    return this.satisfactionService.update(+id, updateSatisfactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.satisfactionService.remove(+id);
  }
}