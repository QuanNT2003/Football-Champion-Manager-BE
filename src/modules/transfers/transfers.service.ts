import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

import { GetMarketFilterDto } from './dto';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async getFilterOptions() {
    const [countries, attributes] = await Promise.all([
      this.prisma.countries.findMany({
        select: { id: true, code: true, name: true, flag_url: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.attributes.findMany({
        select: { id: true, code: true, name: true, category: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    return {
      countries: countries.map((c) => ({
        id: c.id.toString(),
        code: c.code,
        name: c.name,
        flag_url: c.flag_url,
      })),
      attributes: attributes.map((a) => ({
        id: a.id.toString(),
        code: a.code,
        name: a.name,
        category: a.category,
      })),
    };
  }

  async getMarket(
    pageOrParams: number | GetMarketFilterDto = 1,
    limitParam: number = 20,
    isLoanParam?: boolean,
    maxPriceParam?: number,
    searchParam?: string,
    positionParam?: string,
  ) {
    let params: GetMarketFilterDto = {};
    if (typeof pageOrParams === 'object' && pageOrParams !== null) {
      params = pageOrParams;
    } else {
      params = {
        page: Number(pageOrParams) || 1,
        limit: limitParam,
        isLoan: isLoanParam,
        maxPrice: maxPriceParam,
        search: searchParam,
        position: positionParam,
      };
    }

    const p = Math.max(1, Number(params.page) || 1);
    const l = Math.max(1, Number(params.limit) || 20);
    const skip = (p - 1) * l;

    const where: any = {};

    // 1. Lọc theo Tình trạng (status)
    if (params.status === 'FREE') {
      where.current_club_id = null;
    } else if (params.status === 'LOAN') {
      where.player_status = { is_loan_listed: true };
    } else if (params.status === 'TRANSFER') {
      where.player_status = { is_transfer_listed: true };
    } else {
      // Mặc định 'ALL': cầu thủ niêm yết bán, mượn hoặc tự do
      if (params.isLoan === true) {
        where.player_status = { is_loan_listed: true };
      } else {
        where.OR = [
          { player_status: { is_transfer_listed: true } },
          { player_status: { is_loan_listed: true } },
          { current_club_id: null },
        ];
      }
    }

    // 2. Lọc theo Tuổi (Age)
    const hasMinAge = params.minAge != null && !isNaN(Number(params.minAge));
    const hasMaxAge = params.maxAge != null && !isNaN(Number(params.maxAge));
    if (hasMinAge || hasMaxAge) {
      where.age = {
        ...(hasMinAge ? { gte: Number(params.minAge) } : {}),
        ...(hasMaxAge ? { lte: Number(params.maxAge) } : {}),
      };
    }

    // 3. Lọc theo Giá (Price)
    const hasMinPrice = params.minPrice != null && !isNaN(Number(params.minPrice));
    const hasMaxPrice = params.maxPrice != null && !isNaN(Number(params.maxPrice));
    if (hasMinPrice || hasMaxPrice) {
      where.market_value = {
        ...(hasMinPrice ? { gte: Number(params.minPrice) } : {}),
        ...(hasMaxPrice ? { lte: Number(params.maxPrice) } : {}),
      };
    }

    // 4. Lọc theo Quốc tịch (Nationality)
    if (params.nationalityId && params.nationalityId !== '' && params.nationalityId !== 'null' && params.nationalityId !== 'undefined') {
      try {
        where.nationality_id = BigInt(params.nationalityId);
      } catch (e) {}
    }

    // 5. Lọc theo OVR (Overall rating tính từ reputation)
    const hasMinOvr = params.minOvr != null && !isNaN(Number(params.minOvr));
    const hasMaxOvr = params.maxOvr != null && !isNaN(Number(params.maxOvr));
    if (hasMinOvr || hasMaxOvr) {
      where.reputation = {
        ...(hasMinOvr ? { gte: Number(params.minOvr) * 100 } : {}),
        ...(hasMaxOvr ? { lte: Number(params.maxOvr) * 100 } : {}),
      };
    }

    // 6. Lọc theo Kỹ năng (Attributes - 40 chỉ số FM)
    if (params.attributes) {
      try {
        const parsed = typeof params.attributes === 'string' ? JSON.parse(params.attributes) : params.attributes;
        const attrConditions: any[] = [];
        for (const [attrId, minVal] of Object.entries(parsed)) {
          const val = Number(minVal);
          if (val > 0) {
            attrConditions.push({
              player_attributes: {
                some: {
                  attribute_id: BigInt(attrId),
                  value: { gte: val },
                },
              },
            });
          }
        }
        if (attrConditions.length > 0) {
          where.AND = [...(where.AND || []), ...attrConditions];
        }
      } catch (e) {
        console.error('Lỗi phân giải attributes filter:', e);
      }
    }

    // 7. Tìm kiếm theo tên / quốc gia
    if (params.search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { first_name: { contains: params.search } },
            { last_name: { contains: params.search } },
            { countries_players_nationality_idTocountries: { name: { contains: params.search } } },
          ],
        },
      ];
    }

    // 8. Lọc theo Vị trí
    if (params.position && params.position !== 'ALL') {
      let positionCodes: string[] = [params.position];
      if (params.position === 'DEF') positionCodes = ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW'];
      else if (params.position === 'MID') positionCodes = ['CM', 'CDM', 'CAM', 'LM', 'RM'];
      else if (params.position === 'ATT' || params.position === 'FWD') positionCodes = ['ST', 'CF', 'LW', 'RW'];

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
            select: { id: true, name: true, flag_url: true },
          },
          player_positions: {
            include: { positions: true },
          },
          player_attributes: {
            include: { attributes: true },
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

        // Map kỹ năng dạng map { [code]: value }
        const attributesMap: Record<string, number> = {};
        if (p.player_attributes) {
          for (const pa of p.player_attributes) {
            if (pa.attributes?.code) {
              attributesMap[pa.attributes.code] = pa.value;
            }
          }
        }

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
          market_value: p.market_value ? Number(p.market_value) : 2500000,
          asking_price: p.player_status?.asking_price ? Number(p.player_status.asking_price) : (p.market_value ? Number(p.market_value) : 2500000),
          is_loan_listed: p.player_status?.is_loan_listed || false,
          is_transfer_listed: p.player_status?.is_transfer_listed || false,
          is_free_agent: !p.current_club_id,
          position: primaryPos?.positions?.code || 'MID',
          currentClub: clubObj,
          club: clubObj,
          nationality: p.countries_players_nationality_idTocountries?.name || 'International',
          nationality_id: p.nationality_id ? p.nationality_id.toString() : null,
          photo_url: p.photo_url || '/assets/players/default.png',
          attributes: attributesMap,
        };
      }),
    };
  }

  async makeOffer(
    fromClubId: bigint,
    dto: {
      player_id: string;
      to_club_id?: string;
      offer_amount?: number;
      is_loan?: boolean;
      proposed_wage?: number;
      contract_years?: number;
    },
  ) {
    if (!dto.player_id || dto.player_id === 'undefined' || dto.player_id === 'null') {
      throw new BadRequestException('Thiếu thông tin player_id của cầu thủ');
    }

    const playerId = BigInt(dto.player_id);

    const player = await this.prisma.players.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
    }

    let toClubId: bigint | null = null;
    if (dto.to_club_id && dto.to_club_id !== 'undefined' && dto.to_club_id !== 'null' && dto.to_club_id !== '') {
      try {
        toClubId = BigInt(dto.to_club_id);
      } catch {
        toClubId = null;
      }
    }

    if (!toClubId && player.current_club_id) {
      toClubId = player.current_club_id;
    }

    if (!toClubId) {
      throw new BadRequestException('Cầu thủ này hiện là cầu thủ tự do, không thuộc CLB nào để gửi đề nghị');
    }

    if (toClubId === fromClubId) {
      throw new BadRequestException('Bạn không thể gửi đề nghị mua cầu thủ thuộc chính CLB của mình');
    }

    const buyerAccount = await this.prisma.financial_accounts.findFirst({
      where: { club_id: fromClubId },
    });

    const isLoan = Boolean(dto.is_loan);
    const finalOfferAmount = isLoan ? 0 : Number(dto.offer_amount || 0);

    if (!buyerAccount || Number(buyerAccount.balance_cash) < finalOfferAmount) {
      throw new BadRequestException('Ngân sách tiền mặt của CLB không đủ để gửi lời đề nghị này');
    }

    const offer = await (this.prisma.transfer_offers as any).create({
      data: {
        player_id: playerId,
        from_club_id: fromClubId,
        to_club_id: toClubId,
        transfer_type: 'DOMESTIC',
        offer_amount: finalOfferAmount,
        currency_type: 'CASH',
        status: 'PENDING',
        is_loan: isLoan,
        proposed_wage: dto.proposed_wage ? Number(dto.proposed_wage) : 0,
        contract_years: dto.contract_years ? Number(dto.contract_years) : 3,
      },
    });

    return {
      message: isLoan
        ? 'Đã gửi đề nghị mượn cầu thủ thành công!'
        : 'Đã gửi đề nghị chuyển nhượng thành công!',
      offerId: offer.id.toString(),
    };
  }

  async getPlayerOffer(clubId: bigint, playerId: bigint) {
    const offer = await this.prisma.transfer_offers.findFirst({
      where: {
        from_club_id: clubId,
        player_id: playerId,
      },
      orderBy: { created_at: 'desc' },
      include: {
        clubs_transfer_offers_to_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
      },
    });

    if (!offer) return null;

    return {
      id: offer.id.toString(),
      player_id: offer.player_id.toString(),
      from_club_id: offer.from_club_id.toString(),
      to_club_id: offer.to_club_id.toString(),
      offer_amount: Number(offer.offer_amount),
      proposed_wage: Number((offer as any).proposed_wage || 0),
      contract_years: Number((offer as any).contract_years || 3),
      is_loan: Boolean(offer.is_loan),
      status: offer.status,
      created_at: offer.created_at,
      to_club: offer.clubs_transfer_offers_to_club_idToclubs ? {
        id: offer.clubs_transfer_offers_to_club_idToclubs.id.toString(),
        name: offer.clubs_transfer_offers_to_club_idToclubs.name,
        logo_url: offer.clubs_transfer_offers_to_club_idToclubs.logo_url,
      } : null,
    };
  }

  async cancelOffer(offerId: bigint, clubId?: bigint) {
    const offer = await this.prisma.transfer_offers.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Không tìm thấy lời đề nghị chuyển nhượng');
    }

    if (clubId && offer.from_club_id !== clubId) {
      throw new BadRequestException('Bạn không có quyền hủy lời đề nghị này');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException(`Không thể hủy đề nghị vì trạng thái hiện tại là ${offer.status}`);
    }

    await this.prisma.transfer_offers.update({
      where: { id: offerId },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Đã hủy lời đề nghị chuyển nhượng thành công!' };
  }

  async getOffersForClub(clubId: bigint) {
    const playerInclude = {
      select: {
        id: true,
        first_name: true,
        last_name: true,
        age: true,
        photo_url: true,
        market_value: true,
        reputation: true,
        player_positions: {
          include: {
            positions: {
              select: { id: true, code: true, name: true, category: true },
            },
          },
        },
        countries_players_nationality_idTocountries: {
          select: { name: true, flag_url: true, code: true },
        },
      },
    };

    const [incomingRaw, outgoingRaw] = await Promise.all([
      this.prisma.transfer_offers.findMany({
        where: { to_club_id: clubId },
        include: {
          players: playerInclude,
          clubs_transfer_offers_from_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
          clubs_transfer_offers_to_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.transfer_offers.findMany({
        where: { from_club_id: clubId },
        include: {
          players: playerInclude,
          clubs_transfer_offers_from_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
          clubs_transfer_offers_to_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const formatOffer = (o: any) => {
      const p = o.players;
      const posCode = p?.player_positions?.[0]?.positions?.code || 'ST';
      return {
        id: o.id.toString(),
        player_id: o.player_id.toString(),
        from_club_id: o.from_club_id.toString(),
        to_club_id: o.to_club_id.toString(),
        transfer_type: o.transfer_type,
        offer_amount: Number(o.offer_amount),
        proposed_wage: Number(o.proposed_wage || 0),
        contract_years: Number(o.contract_years || 3),
        currency_type: o.currency_type,
        status: o.status,
        created_at: o.created_at,
        is_loan: Boolean(o.is_loan),
        player: p ? {
          id: p.id.toString(),
          first_name: p.first_name,
          last_name: p.last_name,
          common_name: `${p.first_name} ${p.last_name}`.trim(),
          age: p.age,
          reputation: p.reputation,
          ovr: p.reputation || 70,
          photo_url: p.photo_url,
          market_value: Number(p.market_value),
          position: posCode,
          nationality: p.countries_players_nationality_idTocountries?.name || '',
          flag_url: p.countries_players_nationality_idTocountries?.flag_url || null,
        } : null,
        buyer_club: o.clubs_transfer_offers_from_club_idToclubs ? {
          id: o.clubs_transfer_offers_from_club_idToclubs.id.toString(),
          name: o.clubs_transfer_offers_from_club_idToclubs.name,
          logo_url: o.clubs_transfer_offers_from_club_idToclubs.logo_url,
        } : null,
        seller_club: o.clubs_transfer_offers_to_club_idToclubs ? {
          id: o.clubs_transfer_offers_to_club_idToclubs.id.toString(),
          name: o.clubs_transfer_offers_to_club_idToclubs.name,
          logo_url: o.clubs_transfer_offers_to_club_idToclubs.logo_url,
        } : null,
        from_club: o.clubs_transfer_offers_from_club_idToclubs ? {
          id: o.clubs_transfer_offers_from_club_idToclubs.id.toString(),
          name: o.clubs_transfer_offers_from_club_idToclubs.name,
          logo_url: o.clubs_transfer_offers_from_club_idToclubs.logo_url,
        } : null,
        to_club: o.clubs_transfer_offers_to_club_idToclubs ? {
          id: o.clubs_transfer_offers_to_club_idToclubs.id.toString(),
          name: o.clubs_transfer_offers_to_club_idToclubs.name,
          logo_url: o.clubs_transfer_offers_to_club_idToclubs.logo_url,
        } : null,
      };
    };

    return {
      incoming: incomingRaw.map(formatOffer),
      outgoing: outgoingRaw.map(formatOffer),
    };
  }

  async respondOffer(offerId: bigint, clubId: bigint, response: 'ACCEPTED' | 'REJECTED') {
    const offer = await this.prisma.transfer_offers.findUnique({
      where: { id: offerId },
      include: {
        players: true,
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

    // 1. Trường hợp TỪ CHỐI (REJECTED)
    if (response === 'REJECTED') {
      await this.prisma.transfer_offers.update({
        where: { id: offerId },
        data: { status: 'REJECTED' },
      });
      return { message: 'Đã từ chối lời đề nghị chuyển nhượng' };
    }

    // 2. Trường hợp ĐỒNG Ý (ACCEPTED): Thực thi toàn bộ quy trình chuyển nhượng / cho mượn
    const isLoan = Boolean(offer.is_loan);
    const amount = isLoan ? 0 : Number(offer.offer_amount);
    const buyerClub = offer.clubs_transfer_offers_from_club_idToclubs;
    const sellerClub = offer.clubs_transfer_offers_to_club_idToclubs;
    const buyerFin = buyerClub?.financial_accounts?.[0];
    const sellerFin = sellerClub?.financial_accounts?.[0];

    if (!buyerFin || !sellerFin) {
      throw new BadRequestException('Tài khoản tài chính của một trong hai CLB không tồn tại');
    }

    if (amount > 0 && Number(buyerFin.balance_cash) < amount) {
      throw new BadRequestException('CLB mua không còn đủ số dư ngân sách để hoàn tất thương vụ');
    }

    // Lấy thông tin mùa giải & timeline hiện tại
    const timeline = await this.prisma.server_timeline.findFirst();
    const seasonId = timeline?.season_id;
    const seasonDay = timeline?.season_day || 1;

    // Lấy đơn vị tiền tệ mặc định
    const defaultCurrency =
      (await this.prisma.currencies.findFirst({ where: { is_active: true } })) ||
      (await this.prisma.currencies.findFirst());
    const currencyId = defaultCurrency ? defaultCurrency.id : BigInt(1);

    const playerName = `${offer.players?.first_name || ''} ${offer.players?.last_name || ''}`.trim() || 'Cầu thủ';

    await this.prisma.$transaction(async (tx) => {
      // BƯỚC 1: Xử lý giao dịch tài chính nếu có phí chuyển nhượng
      if (amount > 0) {
        // Trừ tiền bên mua, cộng tiền bên bán
        await tx.financial_accounts.update({
          where: { id: buyerFin.id },
          data: { balance_cash: { decrement: amount } },
        });

        await tx.financial_accounts.update({
          where: { id: sellerFin.id },
          data: { balance_cash: { increment: amount } },
        });
      }

      // BƯỚC 2: Tạo bản ghi lịch sử chuyển nhượng chính thức (transfers)
      const transferRecord = await tx.transfers.create({
        data: {
          player_id: offer.player_id,
          from_club_id: offer.to_club_id,
          to_club_id: offer.from_club_id,
          transfer_type: offer.transfer_type || 'DOMESTIC',
          transfer_fee: amount,
          currency_type: 'CASH',
          transfer_date: new Date(),
          is_loan: isLoan,
          loan_end_date: isLoan ? offer.loan_end_date : null,
        },
      });

      // Ghi sổ nhật ký kế toán (financial_transactions)
      if (amount > 0) {
        // Log bên mua (EXPENSE)
        await tx.financial_transactions.create({
          data: {
            club_id: offer.from_club_id,
            financial_account_id: buyerFin.id,
            type: 'EXPENSE',
            category: 'TRANSFER_FEE',
            amount: amount,
            currency_type: 'CASH',
            reference_type: 'transfers',
            reference_id: transferRecord.id,
            description: `Chi phí chuyển nhượng mua cầu thủ ${playerName}`,
            season_id: seasonId,
            season_day: seasonDay,
            transaction_date: new Date(),
          },
        });

        // Log bên bán (INCOME)
        await tx.financial_transactions.create({
          data: {
            club_id: offer.to_club_id,
            financial_account_id: sellerFin.id,
            type: 'INCOME',
            category: 'TRANSFER_FEE',
            amount: amount,
            currency_type: 'CASH',
            reference_type: 'transfers',
            reference_id: transferRecord.id,
            description: `Thu về phí chuyển nhượng bán cầu thủ ${playerName}`,
            season_id: seasonId,
            season_day: seasonDay,
            transaction_date: new Date(),
          },
        });
      }

      // BƯỚC 3: Cập nhật CLB hiện tại của cầu thủ
      await tx.players.update({
        where: { id: offer.player_id },
        data: { current_club_id: offer.from_club_id },
      });

      // BƯỚC 4: Gỡ cầu thủ khỏi danh sách rao bán / cho mượn
      await tx.player_status.upsert({
        where: { player_id: offer.player_id },
        update: {
          is_transfer_listed: false,
          is_loan_listed: false,
          asking_price: null,
        },
        create: {
          player_id: offer.player_id,
          is_transfer_listed: false,
          is_loan_listed: false,
        },
      });

      // BƯỚC 5: Gỡ cầu thủ khỏi đội hình chiến thuật của CLB cũ (nếu có)
      const oldClubTactics = await tx.club_tactics.findMany({
        where: { club_id: offer.to_club_id },
        select: { id: true },
      });
      if (oldClubTactics.length > 0) {
        const tacticIds = oldClubTactics.map((t) => t.id);
        await tx.club_tactic_positions.updateMany({
          where: {
            tactic_id: { in: tacticIds },
            player_id: offer.player_id,
          },
          data: {
            player_id: null,
          },
        });
      }

      // BƯỚC 6: Xử lý Hợp đồng cầu thủ (player_contracts)
      const proposedWage = offer.proposed_wage ? Number(offer.proposed_wage) : 1000;
      const contractYears = offer.contract_years || 3;

      if (isLoan) {
        // Hợp đồng cho mượn: tạo mới hợp đồng mượn với parent_club_id là CLB cũ
        await tx.player_contracts.create({
          data: {
            player_id: offer.player_id,
            club_id: offer.from_club_id,
            parent_club_id: offer.to_club_id,
            salary: proposedWage,
            salary_currency_id: currencyId,
            start_date: new Date(),
            status: 'ACTIVE',
            is_loan_contract: true,
            start_season_id: seasonId || BigInt(1),
            start_season_day: seasonDay,
            end_season_id: seasonId || BigInt(1),
            end_season_day: 40,
          },
        });
      } else {
        // Hợp đồng mua đứt: Đóng các hợp đồng cũ
        await tx.player_contracts.updateMany({
          where: {
            player_id: offer.player_id,
            status: 'ACTIVE',
          },
          data: {
            status: 'TERMINATED',
            end_date: new Date(),
          },
        });

        // Tạo hợp đồng mới với CLB mua
        await tx.player_contracts.create({
          data: {
            player_id: offer.player_id,
            club_id: offer.from_club_id,
            salary: proposedWage,
            salary_currency_id: currencyId,
            start_date: new Date(),
            status: 'ACTIVE',
            is_loan_contract: false,
            start_season_id: seasonId || BigInt(1),
            start_season_day: seasonDay,
            end_season_id: seasonId ? BigInt(Number(seasonId) + contractYears) : BigInt(1 + contractYears),
            end_season_day: 40,
          },
        });
      }

      // BƯỚC 7: Cập nhật lịch sử CLB của cầu thủ (player_club_history)
      await tx.player_club_history.updateMany({
        where: {
          player_id: offer.player_id,
          club_id: offer.to_club_id,
          end_date: null,
        },
        data: {
          end_date: new Date(),
        },
      });

      await tx.player_club_history.create({
        data: {
          player_id: offer.player_id,
          club_id: offer.from_club_id,
          start_date: new Date(),
          transfer_id: transferRecord.id,
          appearances: 0,
          goals: 0,
          assists: 0,
        },
      });

      // BƯỚC 8: Cập nhật trạng thái đề nghị này thành ACCEPTED
      await tx.transfer_offers.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED' },
      });

      // BƯỚC 9: Tự động từ chối (REJECTED) tất cả các lời đề nghị PENDING khác cho cùng cầu thủ này
      await tx.transfer_offers.updateMany({
        where: {
          player_id: offer.player_id,
          status: 'PENDING',
          id: { not: offerId },
        },
        data: { status: 'REJECTED' },
      });
    });

    return {
      message: isLoan
        ? `Đã chấp thuận cho mượn cầu thủ ${playerName} thành công!`
        : `Thương vụ chuyển nhượng mua đứt cầu thủ ${playerName} đã hoàn tất thành công!`,
    };
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

  async getStaffDetail(staffId: bigint, clubId?: bigint) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        countries: { select: { id: true, name: true, code: true, flag_url: true } },
        preferred_formation: { select: { id: true, name: true, code: true } },
        secondary_formation: { select: { id: true, name: true, code: true } },
        staff_contracts: {
          include: {
            clubs: {
              select: { id: true, name: true, logo_url: true },
            },
          },
          orderBy: { start_date: 'desc' },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Không tìm thấy thông tin nhân viên');
    }

    const [staffAttributes, roleAttributes] = await Promise.all([
      this.prisma.staff_attributes.findMany({
        where: { staff_id: staffId },
        include: { staff_attribute_types: true },
      }),
      this.prisma.staff_role_attributes.findMany({
        where: { staff_type: staff.staff_type },
      }),
    ]);

    const roleAttrMap = new Map<string, { multiplier: number; is_key: boolean }>();
    roleAttributes.forEach((ra) => {
      roleAttrMap.set(ra.attribute_type_id.toString(), {
        multiplier: Number(ra.multiplier),
        is_key: Boolean(ra.is_key),
      });
    });

    const attributes = staffAttributes.map((sa) => {
      const type = sa.staff_attribute_types;
      const roleConfig = roleAttrMap.get(sa.attribute_id.toString());
      return {
        id: sa.attribute_id.toString(),
        code: type?.code || '',
        name: type?.name || '',
        category: type?.category || 'COACHING',
        description: type?.description || '',
        value: sa.value ?? 50,
        is_key: roleConfig?.is_key ?? false,
        multiplier: roleConfig?.multiplier ?? 1.0,
      };
    });

    const groupedAttributes = {
      coaching: attributes.filter((a) => a.category === 'COACHING'),
      mental: attributes.filter((a) => a.category === 'MENTAL'),
      scouting: attributes.filter((a) => a.category === 'SCOUTING'),
      medical: attributes.filter((a) => a.category === 'MEDICAL'),
    };

    const currentContract = staff.staff_contracts.find((c) => c.status === 'ACTIVE') || null;
    const contractHistory = staff.staff_contracts.map((c) => ({
      id: c.id.toString(),
      club: c.clubs
        ? {
            id: c.clubs.id.toString(),
            name: c.clubs.name,
            logo_url: c.clubs.logo_url,
          }
        : null,
      salary: Number(c.salary),
      startDate: c.start_date,
      endDate: c.end_date,
      status: c.status,
    }));

    let existingOffer: any = null;
    if (clubId) {
      existingOffer = await this.prisma.staff_offers.findFirst({
        where: {
          staff_id: staffId,
          club_id: clubId,
          status: 'PENDING',
        },
      });
    }

    const estimatedWage = Math.round((staff.reputation || 5000) * 1.8);

    return {
      id: staff.id.toString(),
      name: staff.name || 'Staff',
      staffType: staff.staff_type,
      coachingLicense: staff.coaching_license,
      tacticalStyle: staff.tactical_style,
      reputation: staff.reputation,
      photoUrl: staff.photo_url,
      nationality: staff.countries
        ? {
            id: staff.countries.id.toString(),
            name: staff.countries.name,
            code: staff.countries.code,
            flag_url: staff.countries.flag_url,
          }
        : null,
      preferredFormation: staff.preferred_formation
        ? {
            id: staff.preferred_formation.id.toString(),
            name: staff.preferred_formation.name,
            code: staff.preferred_formation.code,
          }
        : null,
      secondaryFormation: staff.secondary_formation
        ? {
            id: staff.secondary_formation.id.toString(),
            name: staff.secondary_formation.name,
            code: staff.secondary_formation.code,
          }
        : null,
      estimatedWage,
      attributes,
      groupedAttributes,
      currentContract: currentContract
        ? {
            id: currentContract.id.toString(),
            club: currentContract.clubs
              ? {
                  id: currentContract.clubs.id.toString(),
                  name: currentContract.clubs.name,
                  logo_url: currentContract.clubs.logo_url,
                }
              : null,
            salary: Number(currentContract.salary),
            startDate: currentContract.start_date,
            endDate: currentContract.end_date,
            status: currentContract.status,
          }
        : null,
      contractHistory,
      existingOffer: existingOffer
        ? {
            id: existingOffer.id.toString(),
            role_offered: existingOffer.role_offered,
            proposed_wage: Number(existingOffer.proposed_wage),
            contract_years: existingOffer.contract_years,
            signing_bonus: Number(existingOffer.signing_bonus),
            status: existingOffer.status,
            createdAt: existingOffer.created_at,
          }
        : null,
    };
  }

  async makeStaffOffer(data: {
    staff_id: string;
    club_id: string;
    role_offered?: string;
    proposed_wage?: number;
    contract_years?: number;
    signing_bonus?: number;
  }) {
    const staffId = BigInt(data.staff_id);
    const clubId = BigInt(data.club_id);

    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        staff_contracts: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Không tìm thấy thông tin nhân viên');
    }

    const currentClubId = staff.staff_contracts[0]?.club_id || null;
    if (currentClubId && currentClubId === clubId) {
      throw new BadRequestException('Nhân sự này đã và đang làm việc tại CLB của bạn!');
    }

    const proposedWage = Number(data.proposed_wage) || Math.round((staff.reputation || 5000) * 1.8);
    const contractYears = Math.min(5, Math.max(1, Number(data.contract_years) || 2));
    const signingBonus = Number(data.signing_bonus) || 0;
    const roleOffered = (data.role_offered as any) || staff.staff_type;

    const existing = await this.prisma.staff_offers.findFirst({
      where: {
        staff_id: staffId,
        club_id: clubId,
        status: 'PENDING',
      },
    });

    if (existing) {
      const updated = await this.prisma.staff_offers.update({
        where: { id: existing.id },
        data: {
          role_offered: roleOffered,
          proposed_wage: proposedWage,
          contract_years: contractYears,
          signing_bonus: signingBonus,
          updated_at: new Date(),
        },
      });
      return {
        message: 'Đã cập nhật lại lời đề nghị tuyển mộ nhân sự!',
        offer: {
          id: updated.id.toString(),
          role_offered: updated.role_offered,
          proposed_wage: Number(updated.proposed_wage),
          contract_years: updated.contract_years,
          status: updated.status,
        },
      };
    }

    const offer = await this.prisma.staff_offers.create({
      data: {
        staff_id: staffId,
        club_id: clubId,
        current_club_id: currentClubId,
        role_offered: roleOffered,
        proposed_wage: proposedWage,
        contract_years: contractYears,
        signing_bonus: signingBonus,
        status: 'PENDING',
      },
    });

    return {
      message: 'Đã gửi lời đề nghị tuyển mộ nhân sự thành công!',
      offer: {
        id: offer.id.toString(),
        role_offered: offer.role_offered,
        proposed_wage: Number(offer.proposed_wage),
        contract_years: offer.contract_years,
        status: offer.status,
      },
    };
  }

  async cancelStaffOffer(offerId: bigint, clubId?: bigint) {
    const offer = await this.prisma.staff_offers.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Không tìm thấy lời đề nghị');
    }

    if (clubId && offer.club_id !== clubId) {
      throw new BadRequestException('Bạn không có quyền hủy lời đề nghị này');
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Lời đề nghị này đã được xử lý trước đó');
    }

    await this.prisma.staff_offers.update({
      where: { id: offerId },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Đã hủy lời đề nghị tuyển mộ nhân sự thành công!' };
  }

  async getStaffOffers(clubId: bigint) {
    const offers = await this.prisma.staff_offers.findMany({
      where: { club_id: clubId },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            staff_type: true,
            coaching_license: true,
            photo_url: true,
            countries: { select: { name: true, code: true, flag_url: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id.toString(),
      staff_id: o.staff_id.toString(),
      staff_name: o.staff.name,
      staff_type: o.staff.staff_type,
      coaching_license: o.staff.coaching_license,
      role_offered: o.role_offered,
      proposed_wage: Number(o.proposed_wage),
      contract_years: o.contract_years,
      signing_bonus: Number(o.signing_bonus),
      status: o.status,
      created_at: o.created_at,
      country: o.staff.countries,
      photo_url: o.staff.photo_url,
    }));
  }


  async getClubStaff(clubId: bigint) {
    const contracts = await this.prisma.staff_contracts.findMany({
      where: {
        club_id: clubId,
        status: 'ACTIVE',
      },
      include: {
        staff: {
          include: {
            countries: { select: { id: true, name: true, code: true, flag_url: true } },
            preferred_formation: { select: { id: true, name: true, code: true } },
            secondary_formation: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: {
        staff: { staff_type: 'asc' },
      },
    });

    return contracts.map((c) => {
      const s = c.staff;
      return {
        id: s.id.toString(),
        contractId: c.id.toString(),
        name: s.name || 'Staff',
        staffType: s.staff_type,
        coachingLicense: s.coaching_license,
        tacticalStyle: s.tactical_style,
        reputation: s.reputation,
        photoUrl: s.photo_url,
        nationality: s.countries?.name || 'Quốc tế',
        countryCode: s.countries?.code || 'INT',
        countryFlag: s.countries?.flag_url || null,
        preferredFormation: s.preferred_formation
          ? {
              id: s.preferred_formation.id.toString(),
              name: s.preferred_formation.name,
              code: s.preferred_formation.code,
            }
          : null,
        secondaryFormation: s.secondary_formation
          ? {
              id: s.secondary_formation.id.toString(),
              name: s.secondary_formation.name,
              code: s.secondary_formation.code,
            }
          : null,
        wage: Number(c.salary),
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
      };
    });
  }

}
