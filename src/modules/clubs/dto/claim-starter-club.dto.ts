import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ClaimStarterClubDto {
  @ApiProperty({ description: 'ID của Quốc gia đã chọn', example: '1' })
  @IsNotEmpty()
  @IsString()
  countryId: string;

  @ApiProperty({ description: 'Tier giải đấu khởi nghiệp (3, 4 hoặc 5)', example: 3 })
  @IsNotEmpty()
  @IsNumber()
  tier: number;
}
