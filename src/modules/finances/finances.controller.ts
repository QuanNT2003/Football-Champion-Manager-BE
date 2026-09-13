import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FinancesService } from './finances.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@ApiTags('Tài Chính & Cửa Hàng Vàng')
@Controller('finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

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
    @Query('limit') limit: number = 50,
  ) {
    return this.financesService.getTransactions(BigInt(clubId), Number(limit));
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
