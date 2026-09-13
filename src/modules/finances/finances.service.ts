import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class FinancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getClubBalance(clubId: bigint) {
    const account = await this.prisma.financial_accounts.findFirst({
      where: { club_id: clubId },
    });

    if (!account) {
      throw new NotFoundException('Tài khoản tài chính không tồn tại');
    }

    return {
      clubId: clubId.toString(),
      cash: account.balance_cash,
      gold: account.balance_gold,
      status: account.status,
    };
  }

  async getTransactions(clubId: bigint, limit: number = 50) {
    const account = await this.prisma.financial_accounts.findFirst({
      where: { club_id: clubId },
    });

    if (!account) return [];

    return this.prisma.financial_transactions.findMany({
      where: { financial_account_id: account.id },
      orderBy: { transaction_date: 'desc' },
      take: limit,
    });
  }

  async getGoldShopPackages() {
    return this.prisma.gold_exchange_shop.findMany({
      where: { is_active: true },
      orderBy: { gold_cost: 'asc' },
    });
  }

  async exchangeGold(clubId: bigint, packageId: bigint) {
    const account = await this.prisma.financial_accounts.findFirst({
      where: { club_id: clubId },
    });

    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const pkg = await this.prisma.gold_exchange_shop.findUnique({
      where: { id: packageId },
    });

    if (!pkg || !pkg.is_active) {
      throw new BadRequestException('Gói quy đổi không tồn tại hoặc đã tạm dừng');
    }

    const goldCost = Number(pkg.gold_cost);
    const currentGold = Number(account.balance_gold);

    if (currentGold < goldCost) {
      throw new BadRequestException(`Bạn không đủ Vàng (Cần: ${goldCost} GOLD, Hiện có: ${currentGold} GOLD)`);
    }

    const cashReceived = Number(pkg.cash_reward);

    await this.prisma.$transaction([
      this.prisma.financial_accounts.update({
        where: { id: account.id },
        data: {
          balance_gold: { decrement: goldCost },
          balance_cash: { increment: cashReceived },
        },
      }),
      this.prisma.financial_transactions.create({
        data: {
          club_id: clubId,
          financial_account_id: account.id,
          type: 'GOLD_EXCHANGE',
          category: 'CURRENCY_EXCHANGE',
          amount: cashReceived,
          currency_type: 'CASH',
          reference_type: 'GOLD_SHOP',
          reference_id: packageId,
          description: `Đổi ${goldCost} Vàng nhận ${cashReceived.toLocaleString()} Tiền (${pkg.name})`,
          transaction_date: new Date(),
          idempotency_key: `GOLD_EXCHANGE_${account.id}_${packageId}_${Date.now()}`,
        },
      }),
    ]);

    return {
      message: `Quy đổi thành công! Nhận được ${cashReceived.toLocaleString()} CASH`,
      remaining_gold: currentGold - goldCost,
      new_cash: Number(account.balance_cash) + cashReceived,
    };
  }
}
