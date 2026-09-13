import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@ApiTags('Trận Đấu & Match Engine')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách lịch thi đấu & kết quả' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'clubId', required: false })
  @ApiQuery({ name: 'seasonId', required: false })
  @ApiQuery({ name: 'seasonDay', required: false, example: 1 })
  @ApiQuery({ name: 'status', required: false, enum: ['SCHEDULED', 'FINISHED'] })
  async getMatches(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('clubId') clubId?: string,
    @Query('seasonId') seasonId?: string,
    @Query('seasonDay') seasonDay?: number,
    @Query('status') status?: string,
  ) {
    return this.matchesService.getMatches(
      Number(page),
      Number(limit),
      clubId,
      seasonId,
      seasonDay,
      status,
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
