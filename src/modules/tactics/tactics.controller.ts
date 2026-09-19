import {
  Body,
  Controller,
  Get,
  Param,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TacticsService } from './tactics.service';

export class TacticPositionDto {
  @ApiPropertyOptional()
  @IsString()
  formationPositionId: string;

  @ApiPropertyOptional()
  @IsString()
  playerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duty?: string;
}

export class UpdateTacticDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mentality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tempo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passingStyle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pressingIntensity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defensiveLine?: number;

  @ApiPropertyOptional({ type: [TacticPositionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TacticPositionDto)
  positions?: TacticPositionDto[];
}

@ApiTags('Chiến Thuật & Sơ Đồ Thi Đấu')
@Controller('tactics')
export class TacticsController {
  constructor(private readonly tacticsService: TacticsService) {}

  @Get('formations')
  @ApiOperation({ summary: 'Lấy danh sách các sơ đồ đội hình mẫu (4-3-3, 4-2-3-1, 3-5-2...)' })
  async getFormations() {
    return this.tacticsService.getFormations();
  }

  @Get('instructions')
  @ApiOperation({ summary: 'Lấy từ điển chỉ đạo chiến thuật' })
  async getInstructions() {
    return this.tacticsService.getTacticalInstructions();
  }

  @Get('club/:clubId')
  @ApiOperation({ summary: 'Lấy chiến thuật hiện tại và đội hình chính của CLB' })
  async getClubTactic(@Param('clubId') clubId: string) {
    return this.tacticsService.getClubTactic(BigInt(clubId));
  }

  @Put('club/:clubId')
  @ApiOperation({ summary: 'Cập nhật chiến thuật, phong cách chơi và vị trí ra sân' })
  async updateClubTactic(
    @Param('clubId') clubId: string,
    @Body() dto: UpdateTacticDto,
  ) {
    return this.tacticsService.updateClubTactic(BigInt(clubId), dto);
  }
}
