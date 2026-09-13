import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TacticsService } from './tactics.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

class UpdateTacticDto {
  formationId?: string;
  name?: string;
  mentality?: string;
  tempo?: number;
  passingStyle?: string;
  pressingIntensity?: number;
  defensiveLine?: number;
  positions?: Array<{
    formationPositionId: string;
    playerId: string;
    role?: string;
    duty?: string;
  }>;
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật chiến thuật, phong cách chơi và vị trí ra sân' })
  async updateClubTactic(
    @Param('clubId') clubId: string,
    @Body() dto: UpdateTacticDto,
  ) {
    return this.tacticsService.updateClubTactic(BigInt(clubId), dto);
  }
}
