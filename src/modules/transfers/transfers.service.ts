import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMarket(
    page: number = 1,
    limit: number = 20,
    isLoan?: boolean,
    maxPrice?: number,
    search?: string,
    position?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 20);
    const skip = (p - 1) * l;

    const where: any = {};

    // Cầu thủ: is_loan_listed, is_transfer_listed hoặc cầu thủ tự do (current_club_id: null)
    if (isLoan === true) {
      where.player_status = { is_loan_listed: true };
    } else {
      where.OR = [
        { player_status: { is_transfer_listed: true } },
        { player_status: { is_loan_listed: true } },
        { current_club_id: null },
      ];
    }

    if (maxPrice) {
      where.market_value = { lte: maxPrice };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { first_name: { contains: search } },
            { last_name: { contains: search } },
            { countries_players_nationality_idTocountries: { name: { contains: search } } },
          ],
        },
      ];
    }

    if (position) {
      let positionCodes: string[] = [position];
      if (position === 'DEF') positionCodes = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW'];
      else if (position === 'MID') positionCodes = ['CM', 'CDM', 'CAM', 'LM', 'RM'];
      else if (position === 'ATT' || position === 'FWD') positionCodes = ['ST', 'CF', 'LW', 'RW'];

      where.player_positions = {
        some: {
          positions: {
            code: { in: positionCodes },
          },
        },
      };
    }

    const [total, list] = await Promise.all([
      this.prisma.players.count({ where }),
      this.prisma.players.findMany({
        where,
        skip,
        take: l,
        include: {
          player_status: true,
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
        orderBy: { market_value: 'desc' },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      items: list.map((p) => {
        const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];
        const computedOvr = Math.round(Math.min(99, Math.max(55, (p.reputation || 6000) / 100)));
        const playerName = p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Player';
        const clubObj = p.clubs_players_current_club_idToclubs ? {
          id: p.clubs_players_current_club_idToclubs.id.toString(),
          name: p.clubs_players_current_club_idToclubs.name,
          logo_url: p.clubs_players_current_club_idToclubs.logo_url,
        } : null;

        return {
          id: p.id.toString(),
          playerId: p.id.toString(),
          name: playerName,
          common_name: playerName,
          first_name: p.first_name,
          last_name: p.last_name,
          age: p.age,
          reputation: p.reputation,
          potential: p.potential || 82,
          potential_rating: p.potential || 82,
          overall_rating: computedOvr,
          ovr: computedOvr,
          market_value: p.market_value,
          asking_price: p.player_status?.asking_price || p.market_value,
          is_loan_listed: p.player_status?.is_loan_listed || false,
          is_transfer_listed: p.player_status?.is_transfer_listed || false,
          is_free_agent: !p.current_club_id,
          position: primaryPos?.positions?.code || 'MID',
          currentClub: clubObj,
          club: clubObj,
          nationality: p.countries_players_nationality_idTocountries?.name || 'International',
          photo_url: p.photo_url || '/assets/players/default.png',
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

    const buyerAccount = await this.prisma.financial_accounts.findFirst({
      where: { club_id: fromClubId },
    });

    if (!buyerAccount || Number(buyerAccount.balance_cash) < dto.offerAmount) {
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

  async getStaffMarket(page: number = 1, limit: number = 20, role?: string, search?: string) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 20);
    const skip = (p - 1) * l;

    // Chỉ lấy staff đang tự do không có câu lạc bộ (không có hợp đồng ACTIVE)
    const where: any = {
      staff_contracts: {
        none: {
          status: 'ACTIVE',
        },
      },
    };

    if (role && role !== 'ALL') {
      where.staff_type = role;
    }

    if (search) {
      where.name = { contains: search };
    }

    const [total, list] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({
        where,
        skip,
        take: l,
        include: {
          countries: { select: { name: true, code: true, flag_url: true } },
          preferred_formation: { select: { id: true, name: true, code: true } },
        },
        orderBy: { reputation: 'desc' },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      items: list.map((s) => {
        const estimatedWage = Math.round((s.reputation || 5000) * 1.8);
        return {
          id: s.id.toString(),
          name: s.name || 'Staff',
          staffType: s.staff_type,
          coachingLicense: s.coaching_license,
          tacticalStyle: s.tactical_style,
          reputation: s.reputation,
          nationality: s.countries?.name || 'International',
          countryCode: s.countries?.code || 'INT',
          preferredFormation: s.preferred_formation ? {
            id: s.preferred_formation.id.toString(),
            name: s.preferred_formation.name,
            code: s.preferred_formation.code,
          } : null,
          currentClub: null, // Hoàn toàn là Free Agent
          wage: estimatedWage,
          signingFee: Math.round(estimatedWage * 12),
          photoUrl: s.photo_url || '/assets/staff/default.png',
        };
      }),
    };
  }

  async hireStaff(clubId: bigint, staffId: bigint) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException('Không tìm thấy thông tin nhân viên');
    }

    if (staff.staff_type === 'HEAD_COACH') {
      const existingHeadCoach = await this.prisma.staff_contracts.findFirst({
        where: {
          club_id: clubId,
          staff: { staff_type: 'HEAD_COACH' },
        },
      });

      if (existingHeadCoach) {
        await this.prisma.staff_contracts.delete({
          where: { id: existingHeadCoach.id },
        });
      }
    }

    await this.prisma.staff_contracts.deleteMany({
      where: { staff_id: staffId },
    });

    const weeklyWage = Math.round((staff.reputation || 5000) * 1.8);
    const newContract = await this.prisma.staff_contracts.create({
      data: {
        staff_id: staffId,
        club_id: clubId,
        salary: weeklyWage,
        salary_currency_id: BigInt(1),
        start_date: new Date(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
      include: {
        staff: true,
        clubs: true,
      },
    });

    return {
      message: `Ký hợp đồng thành công với ${staff.name} (${staff.staff_type})!`,
      contract: newContract,
    };
  }
}
