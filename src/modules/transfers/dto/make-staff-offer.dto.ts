import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class MakeStaffOfferDto {
  @ApiProperty({ description: 'ID của nhân sự cần tuyển mộ', example: '259' })
  @IsNotEmpty({ message: 'Thiếu thông tin staff_id của nhân sự' })
  @IsString()
  staff_id: string;

  @ApiProperty({ description: 'ID CLB gửi đề nghị', example: '1' })
  @IsNotEmpty({ message: 'Thiếu thông tin club_id của câu lạc bộ' })
  @IsString()
  club_id: string;

  @ApiPropertyOptional({ description: 'Vai trò đề xuất (HEAD_COACH, ASSISTANT_COACH, v.v.)', example: 'HEAD_COACH' })
  @IsOptional()
  @IsString()
  role_offered?: string;

  @ApiPropertyOptional({ description: 'Mức lương tuần đề xuất', example: 35000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  proposed_wage?: number;

  @ApiPropertyOptional({ description: 'Số năm hợp đồng', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  contract_years?: number;

  @ApiPropertyOptional({ description: 'Phí lót tay ký hợp đồng', example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  signing_bonus?: number;
}
