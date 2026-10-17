import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MoveSquadDto {
  @ApiProperty({
    description: 'Đội hình muốn chuyển đến: FIRST_TEAM hoặc YOUTH_U21',
    enum: ['FIRST_TEAM', 'YOUTH_U21', 'RESERVES', 'YOUTH_U19'],
    example: 'FIRST_TEAM',
  })
  @IsIn(['FIRST_TEAM', 'YOUTH_U21', 'RESERVES', 'YOUTH_U19'])
  squadType: 'FIRST_TEAM' | 'YOUTH_U21' | 'RESERVES' | 'YOUTH_U19';

  @ApiPropertyOptional({
    description: 'Số áo mong muốn (1 - 99). Nếu để trống, hệ thống sẽ tự động tìm và gán số áo còn trống nhỏ nhất.',
    example: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  squadNumber?: number;
}
