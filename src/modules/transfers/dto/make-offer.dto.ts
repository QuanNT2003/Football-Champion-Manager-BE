import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class MakeOfferDto {
  @ApiProperty({ description: 'ID cầu thủ muốn gửi đề nghị', example: '101' })
  @IsNotEmpty({ message: 'Thiếu thông tin player_id của cầu thủ' })
  @IsString()
  player_id: string;

  @ApiPropertyOptional({ description: 'ID CLB chủ quản hiện tại', example: '1' })
  @IsOptional()
  @IsString()
  to_club_id?: string;

  @ApiPropertyOptional({ description: 'Mức giá chuyển nhượng hoặc phí mượn', example: 5000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offer_amount?: number;

  @ApiPropertyOptional({ description: 'Là hợp đồng mượn hay mua đứt', example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_loan?: boolean;

  @ApiPropertyOptional({ description: 'Mức lương tuần đề xuất', example: 45000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  proposed_wage?: number;

  @ApiPropertyOptional({ description: 'Số năm hợp đồng', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  contract_years?: number;
}
