import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';

@ApiTags('Giải Đấu & Bảng Xếp Hạng')
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các giải đấu bóng đá' })
  @ApiQuery({ name: 'countryId', required: false })
  @ApiQuery({ name: 'tier', required: false, example: 1 })
  async getCompetitions(
    @Query('countryId') countryId?: string,
    @Query('tier') tier?: number,
  ) {
    return this.competitionsService.getCompetitions(countryId, tier);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết giải đấu' })
  async getCompetitionById(@Param('id') id: string) {
    return this.competitionsService.getCompetitionById(BigInt(id));
  }

  @Get(':id/standings')
  @ApiOperation({ summary: 'Lấy Bảng xếp hạng giải đấu (Standings table)' })
  @ApiQuery({ name: 'seasonId', required: false })
  async getStandings(
    @Param('id') id: string,
    @Query('seasonId') seasonId?: string,
  ) {
    return this.competitionsService.getStandings(
      BigInt(id),
      seasonId ? BigInt(seasonId) : undefined,
    );
  }

  @Get(':id/top-scorers')
  @ApiOperation({ summary: 'Lấy bảng xếp hạng Vua phá lưới (Top Scorers)' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  async getTopScorers(
    @Param('id') id: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.competitionsService.getTopScorers(BigInt(id), Number(limit));
  }
}
