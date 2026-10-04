import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMatchDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Lọc các trận của một CLB' })
  @IsOptional()
  @IsString()
  clubId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo mùa giải' })
  @IsOptional()
  @IsString()
  seasonId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ngày thi đấu của mùa (1 - 40)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  seasonDay?: number;

  @ApiPropertyOptional({ description: 'Trạng thái trận đấu (SCHEDULED, PLAYING, FINISHED)', enum: ['SCHEDULED', 'PLAYING', 'FINISHED'] })
  @IsOptional()
  @IsString()
  status?: string;
}
