import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClubsService } from './clubs.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { ClaimStarterClubDto } from './dto/claim-starter-club.dto';

@ApiTags('Câu Lạc Bộ & Sân Vận Động')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách CLB với phân trang, tìm kiếm' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'Rosario' })
  @ApiQuery({ name: 'countryId', required: false })
  async getClubs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('countryId') countryId?: string,
  ) {
    return this.clubsService.getClubs(Number(page), Number(limit), search, countryId);
  }

  @Get('my-club')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết CLB mà HLV đang quản lý' })
  async getMyClub(@CurrentUser() user: AuthUser) {
    return this.clubsService.getMyClub(BigInt(user.id));
  }

  @Get('starter/countries')
  @ApiOperation({ summary: 'Lấy danh sách Quốc gia có CLB khởi nghiệp (Tier 3, 4, 5)' })
  @ApiQuery({ name: 'search', required: false, example: 'Vietnam' })
  async getStarterCountries(@Query('search') search?: string) {
    return this.clubsService.getStarterCountries(search);
  }

  @Get('starter/tiers')
  @ApiOperation({ summary: 'Lấy các Tier khởi nghiệp (3, 4, 5) kèm số lượng CLB trống theo Quốc gia' })
  @ApiQuery({ name: 'countryId', required: true, example: '1' })
  async getStarterTiers(@Query('countryId') countryId: string) {
    return this.clubsService.getStarterTiers(countryId);
  }

  @Post('starter/claim-random')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gán ngẫu nhiên một CLB chưa có chủ trong Quốc gia & Tier đã chọn' })
  async claimRandomStarterClub(
    @CurrentUser() user: AuthUser,
    @Body() dto: ClaimStarterClubDto,
  ) {
    return this.clubsService.claimRandomStarterClub(BigInt(user.id), dto.countryId, Number(dto.tier));
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Lấy dữ liệu tổng quan cho trang Dashboard của CLB (Trận đấu tiếp theo, BXH, Chỉ số OVR, v.v.)' })
  async getClubDashboard(@Param('id') id: string) {
    return this.clubsService.getClubDashboard(BigInt(id));
  }

  @Get(':id/trophies')
  @ApiOperation({ summary: 'Lấy danh sách cúp và danh hiệu phòng truyền thống của CLB' })
  async getClubTrophies(@Param('id') id: string) {
    return this.clubsService.getClubTrophies(BigInt(id));
  }

  @Get(':id/news')
  @ApiOperation({ summary: 'Lấy danh sách tin tức câu lạc bộ (chuyển nhượng, thi đấu, sự kiện)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'newsType', required: false, example: 'TRANSFER' })
  @ApiQuery({ name: 'search', required: false })
  async getClubNews(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('newsType') newsType?: string,
    @Query('search') search?: string,
  ) {
    return this.clubsService.getClubNews(BigInt(id), Number(page), Number(limit), newsType, search);
  }

  @Get(':id/squad-groups')
  @ApiOperation({ summary: 'Lấy danh sách cầu thủ gồm 2 list Đội 1 và Đội Trẻ' })
  async getClubSquadDetailed(@Param('id') id: string) {
    return this.clubsService.getClubSquadDetailed(BigInt(id));
  }

  @Get(':id/matches')
  @ApiOperation({ summary: 'Lấy danh sách các trận đấu mùa này của CLB' })
  @ApiQuery({ name: 'seasonId', required: false })
  async getClubMatches(@Param('id') id: string, @Query('seasonId') seasonId?: string) {
    return this.clubsService.getClubMatches(BigInt(id), seasonId ? BigInt(seasonId) : undefined);
  }

  @Get(':id/transfers')
  @ApiOperation({ summary: 'Lấy lịch sử chuyển nhượng (đến & đi) của CLB' })
  async getClubTransfers(@Param('id') id: string) {
    return this.clubsService.getClubTransfers(BigInt(id));
  }

  @Get(':id/season-history')
  @ApiOperation({ summary: 'Lấy lịch sử mùa giải (danh hiệu trên đầu, thành tích các mùa phía dưới)' })
  async getClubSeasonHistory(@Param('id') id: string) {
    return this.clubsService.getClubSeasonHistory(BigInt(id));
  }

  @Get(':id/stadium')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết sân vận động của CLB' })
  async getClubStadium(@Param('id') id: string) {
    return this.clubsService.getClubStadium(BigInt(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một CLB theo ID' })
  async getClubById(@Param('id') id: string) {
    return this.clubsService.getClubById(BigInt(id));
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nhận quyền quản lý / Trở thành HLV trưởng của CLB này' })
  async claimClub(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clubsService.claimClub(BigInt(user.id), BigInt(id));
  }

  @Get(':id/facilities')
  @ApiOperation({ summary: 'Lấy danh sách cơ sở vật chất của CLB' })
  async getFacilities(@Param('id') id: string) {
    return this.clubsService.getFacilities(BigInt(id));
  }

  @Post(':id/facilities/:facilityId/upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nâng cấp cấp độ cơ sở vật chất (tiêu tốn CASH)' })
  async upgradeFacility(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('facilityId') facilityId: string,
  ) {
    return this.clubsService.upgradeFacility(
      BigInt(user.id),
      BigInt(id),
      BigInt(facilityId),
    );
  }
}
