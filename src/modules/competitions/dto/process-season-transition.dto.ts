import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProcessSeasonTransitionDto {
  @ApiProperty({ description: 'ID World (mặc định 1)', example: '1', required: false })
  @IsOptional()
  @IsString()
  worldId?: string;

  @ApiProperty({ description: 'ID mùa giải vừa kết thúc cần xử lý (nếu trống sẽ lấy mùa ACTIVE hiện tại)', example: '1', required: false })
  @IsOptional()
  @IsString()
  completedSeasonId?: string;

  @ApiProperty({ description: 'Số mùa giải mới tiếp theo (ví dụ: 2)', example: 2, required: false })
  @IsOptional()
  @IsNumber()
  newSeasonNumber?: number;

  @ApiProperty({ description: 'Có tự động tăng 1 tuổi cho toàn bộ cầu thủ không', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  agePlayers?: boolean;

  @ApiProperty({ description: 'Có tự động khởi tạo mùa mới và sinh lịch đấu luôn không', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  initializeNewSeason?: boolean;

  @ApiProperty({ description: 'Chỉ xử lý cho 1 quốc gia cụ thể (nếu test)', example: '114', required: false })
  @IsOptional()
  @IsString()
  countryId?: string;
}
