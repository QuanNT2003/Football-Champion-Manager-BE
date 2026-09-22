import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { GenerateFixturesDto } from './dto/generate-fixtures.dto';
import { InitializeSeasonDto } from './dto/initialize-season.dto';
import { ProcessSeasonTransitionDto } from './dto/process-season-transition.dto';

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

  
  @Get('countries')
  @ApiOperation({ summary: 'Lấy danh sách các quốc gia tinh hoa có giải đấu' })
  @ApiQuery({ name: 'search', required: false })
  async getCountries(@Query('search') search?: string) {
    return this.competitionsService.getCountries(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết giải đấu' })
  async getCompetitionById(@Param('id') id: string) {
    return this.competitionsService.getCompetitionById(BigInt(id));
  }

  @Get(':id/knockout-bracket')
  @ApiOperation({ summary: 'Lấy cây nhánh đấu / các trận loại trực tiếp (Knockout Bracket)' })
  @ApiQuery({ name: 'seasonId', required: false })
  @ApiQuery({ name: 'countryId', required: false })
  async getKnockoutBracket(
    @Param('id') id: string,
    @Query('seasonId') seasonId?: string,
    @Query('countryId') countryId?: string,
  ) {
    return this.competitionsService.getKnockoutBracket(
      BigInt(id),
      seasonId ? BigInt(seasonId) : undefined,
      countryId,
    );
  }

  @Get(':id/standings')
  @ApiOperation({ summary: 'Lấy Bảng xếp hạng giải đấu (Standings table)' })
  @ApiQuery({ name: 'seasonId', required: false })
  @ApiQuery({ name: 'countryId', required: false })
  async getStandings(
    @Param('id') id: string,
    @Query('seasonId') seasonId?: string,
    @Query('countryId') countryId?: string,
  ) {
    return this.competitionsService.getStandings(
      BigInt(id),
      seasonId ? BigInt(seasonId) : undefined,
      countryId,
    );
  }

  @Get(':id/top-scorers')
  @ApiOperation({ summary: 'Lấy bảng xếp hạng Vua phá lưới (Top Scorers)' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'countryId', required: false })
  async getTopScorers(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('countryId') countryId?: string,
  ) {
    return this.competitionsService.getTopScorers(BigInt(id), limit ? Number(limit) : 10, countryId);
  }

  @Get(':id/top-assists')
  @ApiOperation({ summary: 'Lấy bảng xếp hạng Vua kiến tạo (Top Assists)' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'countryId', required: false })
  async getTopAssists(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('countryId') countryId?: string,
  ) {
    return this.competitionsService.getTopAssists(BigInt(id), limit ? Number(limit) : 10, countryId);
  }

  @Get(':id/teams')
  @ApiOperation({ summary: 'Lấy danh sách các đội bóng tham gia giải đấu' })
  @ApiQuery({ name: 'countryId', required: false })
  async getCompetitionTeams(
    @Param('id') id: string,
    @Query('countryId') countryId?: string,
  ) {
    return this.competitionsService.getCompetitionTeams(BigInt(id), countryId);
  }

  @Post('initialize-season')
  @ApiOperation({ summary: 'Khởi tạo mùa giải mới: kích hoạt giải đấu, phân bổ CLB và sinh lịch thi đấu' })
  async initializeSeason(@Body() dto: InitializeSeasonDto) {
    return this.competitionsService.initializeNewSeason(dto);
  }

  @Post('generate-fixtures')
  @ApiOperation({ summary: 'Tự động bốc thăm và sinh lịch thi đấu (Fixtures) cho các giải đấu trong mùa' })
  async generateFixtures(@Body() dto: GenerateFixturesDto) {
    return this.competitionsService.generateSeasonFixtures(dto);
  }

  @Post('process-season-transition')
  @ApiOperation({ summary: 'Chuyển giao mùa giải (Season Transition): Thăng/Xuống hạng, Cúp C1/C2 Châu Lục, Lão hóa cầu thủ (+1 tuổi) và tạo mùa mới' })
  async processSeasonTransition(@Body() dto: ProcessSeasonTransitionDto) {
    return this.competitionsService.processSeasonTransition(dto);
  }

}
