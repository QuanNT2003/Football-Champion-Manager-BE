import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPlayerDto {
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

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên cầu thủ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID CLB chủ quản' })
  @IsOptional()
  @IsString()
  clubId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID quốc tịch' })
  @IsOptional()
  @IsString()
  nationalityId?: string;

  @ApiPropertyOptional({ description: 'Loại đội hình (FIRST_TEAM, RESERVES, YOUTH)' })
  @IsOptional()
  @IsString()
  squadType?: string;
}
