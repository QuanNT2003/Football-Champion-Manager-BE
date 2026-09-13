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
