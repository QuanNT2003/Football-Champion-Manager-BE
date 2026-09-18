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

  @ApiProperty({ description: 'Xử lý hợp đồng hết hạn, trả cầu thủ mượn, giải nghệ cầu thủ cao tuổi', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  processContracts?: boolean;

  @ApiProperty({ description: 'Xử lý xóa / đóng lịch sử án phạt thẻ mùa cũ (player_suspensions)', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  processSuspensions?: boolean;

  @ApiProperty({ description: 'Phát thưởng thành tích thứ hạng cho CLB và tổng kết mục tiêu', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  distributeFinances?: boolean;

  @ApiProperty({ description: 'Trao giải thưởng cá nhân Day 39 (Chiếc giày vàng, Vua kiến tạo, Găng tay vàng, Cầu thủ xuất sắc nhất)', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  processAwards?: boolean;
}

