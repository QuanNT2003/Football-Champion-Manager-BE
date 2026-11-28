import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FinancesService } from './finances.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '@/common/decorators/current-user.decorator';
import { SponsorshipsService } from './sponsorships.service';

@ApiTags('Tài Chính & Cửa Hàng Vàng')
@Controller('finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService, private readonly sponsorshipsService: SponsorshipsService) {}

  @Get('club/:clubId/sponsorships')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem hợp đồng tài trợ và suất ký còn lại trong mùa' })
  getSponsorships(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string) {
    return this.sponsorshipsService.getSponsorships(BigInt(user.id), BigInt(clubId));
  }

  @Post('club/:clubId/sponsorships/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mở lời mời tài trợ cố định theo mùa' })
  openSponsorOffers(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string) {
    return this.sponsorshipsService.openOffers(BigInt(user.id), BigInt(clubId));
  }

  @Post('club/:clubId/sponsorships/:offerId/sign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ký tài trợ và nhận CASH, tối đa 4 hợp đồng mỗi mùa' })
  signSponsor(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string, @Param('offerId') offerId: string) {
    return this.sponsorshipsService.sign(BigInt(user.id), BigInt(clubId), BigInt(offerId));
  }

  @Get('club/:clubId/balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy số dư tài khoản CLB (Tiền CASH và Vàng GOLD)' })
  async getClubBalance(@Param('clubId') clubId: string) {
    return this.financesService.getClubBalance(BigInt(clubId));
  }

  @Get('club/:clubId/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem lịch sử sổ cái giao dịch tài chính của CLB' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getTransactions(
    @Param('clubId') clubId: string,
    @Query('limit') limit?: number,
  ) {
    return this.financesService.getTransactions(BigInt(clubId), limit ? Number(limit) : 50);
  }

  @Get('gold-shop')
  @ApiOperation({ summary: 'Danh sách các gói quy đổi Vàng sang Tiền (Gold Exchange Shop)' })
  async getGoldShopPackages() {
    return this.financesService.getGoldShopPackages();
  }

  @Post('club/:clubId/exchange-gold/:packageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thực hiện quy đổi Vàng sang Tiền qua gói quy đổi' })
  async exchangeGold(
    @Param('clubId') clubId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.financesService.exchangeGold(BigInt(clubId), BigInt(packageId));
  }
}
