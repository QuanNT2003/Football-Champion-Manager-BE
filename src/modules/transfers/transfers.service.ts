import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMarket(page: number = 1, limit: number = 20, isLoan?: boolean, maxPrice?: number) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 20);
    const skip = (p - 1) * l;
    const where: any = {};

    if (isLoan) {
      where.is_loan_listed = true;
    } else {
      where.is_transfer_listed = true;
    }

    if (maxPrice) {
      where.asking_price = { lte: maxPrice };
    }

    const [total, list] = await Promise.all([
      this.prisma.player_status.count({ where }),
      this.prisma.player_status.findMany({
        where,
        skip,
        take: l,
        include: {
          players: {
            include: {
              clubs_players_current_club_idToclubs: {
                select: { id: true, name: true, logo_url: true },
              },
              countries_players_nationality_idTocountries: {
                select: { name: true, flag_url: true },
              },
              player_positions: {
                include: { positions: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      items: list.map((item) => {
        const p = item.players;
        const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];

        return {
          playerId: p.id.toString(),
          name: `${p.first_name} ${p.last_name}`.trim(),
          age: p.age,
          reputation: p.reputation,
          potential: p.potential,
          market_value: p.market_value,
          asking_price: item.asking_price,
          is_loan_listed: item.is_loan_listed,
          is_transfer_listed: item.is_transfer_listed,
          position: primaryPos?.positions?.code,
          currentClub: p.clubs_players_current_club_idToclubs ? {
            id: p.clubs_players_current_club_idToclubs.id.toString(),
            name: p.clubs_players_current_club_idToclubs.name,
            logo_url: p.clubs_players_current_club_idToclubs.logo_url,
          } : null,
          nationality: p.countries_players_nationality_idTocountries?.name,
        };
      }),
    };
  }

  async makeOffer(
    fromClubId: bigint,
    dto: {
      playerId: string;
      toClubId: string;
      offerAmount: number;
      isLoan?: boolean;
    },
  ) {
    const playerId = BigInt(dto.playerId);
    const toClubId = BigInt(dto.toClubId);

    const buyerClub = await this.prisma.clubs.findUnique({
      where: { id: fromClubId },
      include: { financial_accounts: true },
    });

    const fin = buyerClub?.financial_accounts?.[0];

    if (!buyerClub || !fin) {
      throw new BadRequestException('CLB mua không có tài khoản tài chính hợp lệ');
    }

    if (Number(fin.balance_cash) < dto.offerAmount) {
      throw new BadRequestException('Ngân sách tiền mặt của CLB không đủ để gửi lời đề nghị này');
    }

    const offer = await this.prisma.transfer_offers.create({
      data: {
        player_id: playerId,
        from_club_id: fromClubId,
        to_club_id: toClubId,
        transfer_type: 'DOMESTIC',
        offer_amount: dto.offerAmount,
        currency_type: 'CASH',
        status: 'PENDING',
        is_loan: Boolean(dto.isLoan),
      },
    });

    return {
      message: 'Đã gửi đề nghị chuyển nhượng thành công!',
      offerId: offer.id.toString(),
    };
  }

  async getOffersForClub(clubId: bigint) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.transfer_offers.findMany({
        where: { to_club_id: clubId },
        include: {
          players: { select: { id: true, first_name: true, last_name: true, market_value: true } },
          clubs_transfer_offers_from_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.transfer_offers.findMany({
        where: { from_club_id: clubId },
        include: {
          players: { select: { id: true, first_name: true, last_name: true, market_value: true } },
          clubs_transfer_offers_to_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { incoming, outgoing };
  }

  async respondOffer(offerId: bigint, clubId: bigint, response: 'ACCEPTED' | 'REJECTED') {
    const offer = await this.prisma.transfer_offers.findUnique({
      where: { id: offerId },
      include: {
        clubs_transfer_offers_from_club_idToclubs: { include: { financial_accounts: true } },
        clubs_transfer_offers_to_club_idToclubs: { include: { financial_accounts: true } },
      },
    });

    if (!offer) {
      throw new NotFoundException('Không tìm thấy lời đề nghị chuyển nhượng');
    }

    if (offer.to_club_id !== clubId) {
      throw new BadRequestException('Bạn không có quyền quyết định lời đề nghị này');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Lời đề nghị này đã được xử lý trước đó');
    }

    if (response === 'REJECTED') {
      await this.prisma.transfer_offers.update({
        where: { id: offerId },
        data: { status: 'REJECTED' },
      });
      return { message: 'Đã từ chối lời đề nghị chuyển nhượng' };
    }

    // ACCEPTED: Execute transfer
    const amount = Number(offer.offer_amount);
    const buyerFin = offer.clubs_transfer_offers_from_club_idToclubs?.financial_accounts?.[0];
    const sellerFin = offer.clubs_transfer_offers_to_club_idToclubs?.financial_accounts?.[0];

    if (!buyerFin || !sellerFin) {
      throw new BadRequestException('Tài khoản tài chính của một trong hai CLB không tồn tại');
    }

    if (Number(buyerFin.balance_cash) < amount) {
      throw new BadRequestException('CLB mua không còn đủ số dư để hoàn tất thương vụ');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Debit buyer, credit seller
      await tx.financial_accounts.update({
        where: { id: buyerFin.id },
        data: { balance_cash: { decrement: amount } },
      });

      await tx.financial_accounts.update({
        where: { id: sellerFin.id },
        data: { balance_cash: { increment: amount } },
      });

      // 2. Transfer player club
      await tx.players.update({
        where: { id: offer.player_id },
        data: { current_club_id: offer.from_club_id },
      });

      // 3. Remove transfer listing
      await tx.player_status.update({
        where: { player_id: offer.player_id },
        data: { is_transfer_listed: false, is_loan_listed: false },
      });

      // 4. Update offer status
      await tx.transfer_offers.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' },
      });

      // 5. Create transfer history record
      await tx.transfers.create({
        data: {
          player_id: offer.player_id,
          from_club_id: offer.to_club_id,
          to_club_id: offer.from_club_id,
          transfer_type: offer.transfer_type,
          transfer_fee: amount,
          currency_type: 'CASH',
          transfer_date: new Date(),
          is_loan: offer.is_loan,
        },
      });
    });

    return { message: 'Thương vụ chuyển nhượng đã hoàn tất thành công!' };
  }
}
