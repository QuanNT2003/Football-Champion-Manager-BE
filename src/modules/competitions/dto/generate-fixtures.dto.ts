import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateFixturesDto {
  @ApiProperty({ description: 'ID mùa giải (nếu không truyền sẽ lấy Season đang ACTIVE)', example: '1', required: false })
  @IsOptional()
  @IsString()
  seasonId?: string;

  @ApiProperty({ description: 'ID giải đấu cụ thể (nếu không truyền sẽ sinh cho tất cả giải hoặc theo countryId)', example: '1', required: false })
  @IsOptional()
  @IsString()
  competitionId?: string;

  @ApiProperty({ description: 'ID quốc gia (nếu chỉ muốn sinh cho các giải của 1 nước)', example: '1', required: false })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiProperty({ description: 'ID phiên bản mùa giải cụ thể (competition_seasons.id)', example: '1', required: false })
  @IsOptional()
  @IsString()
  competitionSeasonId?: string;

  @ApiProperty({ description: 'Có xóa lịch thi đấu cũ của mùa này để sinh lại từ đầu không', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
