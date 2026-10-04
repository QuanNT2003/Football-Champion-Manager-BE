import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateListingDto {
  @ApiProperty({ description: 'Bật/tắt niêm yết bán trên thị trường chuyển nhượng', example: true })
  @IsBoolean()
  isTransferListed: boolean;

  @ApiProperty({ description: 'Bật/tắt niêm yết cho mượn', example: false })
  @IsBoolean()
  isLoanListed: boolean;

  @ApiPropertyOptional({ description: 'Mức giá yêu cầu tối thiểu khi bán', example: 15000000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  askingPrice?: number;
}
