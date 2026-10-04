import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleTrainingDto {
  @ApiProperty({ description: 'ID danh mục bài tập huấn luyện', example: '1' })
  @IsNotEmpty({ message: 'Thiếu thông tin trainingTypeId' })
  @IsString()
  trainingTypeId: string;

  @ApiPropertyOptional({ description: 'Cường độ tập luyện (1 - 100)', example: 80, default: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  intensity?: number;
}
