import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TacticPositionDto {
  @ApiPropertyOptional({ description: 'ID vị trí trên sơ đồ', example: '1' })
  @IsString()
  formationPositionId: string;

  @ApiPropertyOptional({ description: 'ID cầu thủ được bố trí', example: '25' })
  @IsString()
  playerId: string;

  @ApiPropertyOptional({ description: 'Vai trò chuyên biệt (Inverted Wing Back, Target Man...)', example: 'POACHER' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Nhiệm vụ (Attack, Support, Defend)', example: 'ATTACK' })
  @IsOptional()
  @IsString()
  duty?: string;
}

export class UpdateTacticDto {
  @ApiPropertyOptional({ description: 'ID sơ đồ chiến thuật (4-3-3, 4-2-3-1...)', example: '1' })
  @IsOptional()
  @IsString()
  formationId?: string;

  @ApiPropertyOptional({ description: 'Phong cách chơi bóng (Gegenpressing, Tiki-Taka, Catenaccio...)', example: 'TIKI_TAKA' })
  @IsOptional()
  @IsString()
  tacticalStyle?: string;

  @ApiPropertyOptional({ description: 'Nhịp độ trận đấu (1 - 5)', example: 3 })
  @IsOptional()
  @IsNumber()
  tempo?: number;

  @ApiPropertyOptional({ description: 'Khổ rộng đội hình (1 - 5)', example: 4 })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ description: 'Độ cao khối đội hình phòng ngự (1 - 5)', example: 3 })
  @IsOptional()
  @IsNumber()
  defensiveLine?: number;

  @ApiPropertyOptional({ description: 'Cường độ áp sát pressing (1 - 5)', example: 4 })
  @IsOptional()
  @IsNumber()
  pressingIntensity?: number;

  @ApiPropertyOptional({ description: 'Danh sách 11 vị trí ra sân', type: [TacticPositionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TacticPositionDto)
  positions?: TacticPositionDto[];
}
