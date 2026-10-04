import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { QueryMatchDto } from './dto';

@ApiTags('Trận Đấu & Match Engine')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách lịch thi đấu & kết quả' })
  async getMatches(@Query() query: QueryMatchDto) {
    return this.matchesService.getMatches(
      query.page || 1,
      query.limit || 20,
      query.clubId,
      query.seasonId,
      query.seasonDay,
      query.status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết trận đấu, diễn biến sự kiện, tỷ số và doanh thu vé' })
  async getMatchById(@Param('id') id: string) {
    return this.matchesService.getMatchById(BigInt(id));
  }

  @Post(':id/simulate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kích hoạt bộ mô phỏng trận đấu (Match Simulation Engine)' })
  async simulateMatch(@Param('id') id: string) {
    return this.matchesService.simulate(BigInt(id));
  }
}
