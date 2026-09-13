import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class InitializeSeasonDto {
  @ApiProperty({ description: 'ID World (mặc định 1)', example: '1', required: false })
  @IsOptional()
  @IsString()
  worldId?: string;

  @ApiProperty({ description: 'Số mùa giải tiếp theo cần tạo (nếu để trống sẽ tự động lấy Season hiện tại + 1)', example: 2, required: false })
  @IsOptional()
  @IsNumber()
  seasonNumber?: number;

  @ApiProperty({ description: 'Có tự động sinh toàn bộ lịch thi đấu (Fixtures) cho mùa mới không', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  autoGenerateFixtures?: boolean;

  @ApiProperty({ description: 'ID quốc gia cụ thể (nếu chỉ muốn khởi tạo giải cho 1 nước)', example: '1', required: false })
  @IsOptional()
  @IsString()
  countryId?: string;
}
