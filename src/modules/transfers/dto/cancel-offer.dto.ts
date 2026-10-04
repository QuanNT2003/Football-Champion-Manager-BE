import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOfferDto {
  @ApiPropertyOptional({ description: 'ID CLB hủy đề nghị (snake_case)', example: '1' })
  @IsOptional()
  @IsString()
  club_id?: string;

  @ApiPropertyOptional({ description: 'ID CLB hủy đề nghị (camelCase alias)', example: '1' })
  @IsOptional()
  @IsString()
  clubId?: string;
}
