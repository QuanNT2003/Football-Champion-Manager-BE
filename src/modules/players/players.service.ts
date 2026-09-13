import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlayers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    clubId?: string,
    nationalityId?: string,
    squadType?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 20);
    const skip = (p - 1) * l;
    const where: any = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search } },
        { last_name: { contains: search } },
      ];
    }
    if (clubId) {
      where.current_club_id = BigInt(clubId);
    }
    if (nationalityId) {
      where.nationality_id = BigInt(nationalityId);
    }
    if (squadType) {
      where.squad_type = squadType;
    }

    const [total, players] = await Promise.all([
      this.prisma.players.count({ where }),
      this.prisma.players.findMany({
        where,
        skip,
        take: l,
        orderBy: { reputation: 'desc' },
        include: {
          countries_players_nationality_idTocountries: { select: { name: true, flag_url: true } },
          clubs_players_current_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
          player_status: true,
          player_positions: {
            include: {
              positions: true,
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
      items: players.map((p) => {
        let attrSummary = null;
        if (p.attributes_summary) {
          try {
            attrSummary = typeof p.attributes_summary === 'string'
              ? JSON.parse(p.attributes_summary)
              : p.attributes_summary;
          } catch (e) {
            attrSummary = p.attributes_summary;
          }
        }

        const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];

        return {
          id: p.id.toString(),
          name: `${p.first_name} ${p.last_name}`.trim(),
          first_name: p.first_name,
          last_name: p.last_name,
          age: p.age,
          reputation: p.reputation,
          potential: p.potential,
          market_value: p.market_value,
          squad_type: p.squad_type,
          squad_number: p.squad_number,
          photo_url: p.photo_url,
          nationality: p.countries_players_nationality_idTocountries?.name,
          nationalityFlag: p.countries_players_nationality_idTocountries?.flag_url,
          club: p.clubs_players_current_club_idToclubs ? {
            id: p.clubs_players_current_club_idToclubs.id.toString(),
            name: p.clubs_players_current_club_idToclubs.name,
            logo_url: p.clubs_players_current_club_idToclubs.logo_url,
          } : null,
          position: primaryPos?.positions ? {
            code: primaryPos.positions.code,
            name: primaryPos.positions.name,
          } : null,
          status: p.player_status ? {
            condition: p.player_status.condition,
            fitness: p.player_status.fitness,
            form: p.player_status.form,
            morale: p.player_status.morale,
            is_injured: Boolean(p.player_status.is_injured),
            is_suspended: Boolean(p.player_status.is_suspended),
            is_transfer_listed: Boolean(p.player_status.is_transfer_listed),
            is_loan_listed: Boolean(p.player_status.is_loan_listed),
            asking_price: p.player_status.asking_price,
          } : null,
          attributes_summary: attrSummary,
        };
      }),
    };
  }

  async getPlayerById(playerId: bigint) {
    const player = await this.prisma.players.findUnique({
      where: { id: playerId },
      include: {
        countries_players_nationality_idTocountries: true,
        clubs_players_current_club_idToclubs: true,
        player_status: true,
        player_contracts: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        player_positions: {
          include: { positions: true },
        },
        injuries: {
          where: { days_remaining: { gt: 0 } },
          take: 1,
        },
        personality_types: true,
        player_play_styles: {
          include: { play_styles: true },
        },
      },
    });

    if (!player) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
    }

    let attrSummary = null;
    if (player.attributes_summary) {
      try {
        attrSummary = typeof player.attributes_summary === 'string'
          ? JSON.parse(player.attributes_summary)
          : player.attributes_summary;
      } catch (e) {
        attrSummary = player.attributes_summary;
      }
    }

    return {
      id: player.id.toString(),
      name: `${player.first_name} ${player.last_name}`.trim(),
      first_name: player.first_name,
      last_name: player.last_name,
      age: player.age,
      date_of_birth: player.date_of_birth,
      height: player.height,
      weight: player.weight,
      preferred_foot: player.preferred_foot,
      reputation: player.reputation,
      potential: player.potential,
      market_value: player.market_value,
      squad_type: player.squad_type,
      squad_number: player.squad_number,
      photo_url: player.photo_url,
      nationality: player.countries_players_nationality_idTocountries?.name || null,
      nationality_detail: player.countries_players_nationality_idTocountries ? {
        id: player.countries_players_nationality_idTocountries.id.toString(),
        name: player.countries_players_nationality_idTocountries.name,
        code: player.countries_players_nationality_idTocountries.code,
        flag_url: player.countries_players_nationality_idTocountries.flag_url,
      } : null,
      club: player.clubs_players_current_club_idToclubs ? {
        id: player.clubs_players_current_club_idToclubs.id.toString(),
        name: player.clubs_players_current_club_idToclubs.name,
        logo_url: player.clubs_players_current_club_idToclubs.logo_url,
      } : null,
      contract: player.player_contracts[0] ? {
        salary: player.player_contracts[0].salary,
        start_date: player.player_contracts[0].start_date,
        end_date: player.player_contracts[0].end_date,
      } : null,
      positions: player.player_positions.map((pp) => ({
        code: pp.positions.code,
        name: pp.positions.name,
        is_preferred: Boolean(pp.is_preferred),
        ability: pp.ability,
      })),
      status: player.player_status ? {
        condition: player.player_status.condition,
        fitness: player.player_status.fitness,
        form: player.player_status.form,
        morale: player.player_status.morale,
        is_injured: Boolean(player.player_status.is_injured),
        is_suspended: Boolean(player.player_status.is_suspended),
        is_transfer_listed: Boolean(player.player_status.is_transfer_listed),
        is_loan_listed: Boolean(player.player_status.is_loan_listed),
        asking_price: player.player_status.asking_price,
      } : null,
      injury: player.injuries[0] ? {
        injury_type: player.injuries[0].type,
        days_remaining: player.injuries[0].days_remaining,
        expected_return_date: player.injuries[0].expected_return_date,
      } : null,
      attributes_summary: attrSummary,
      play_styles: player.player_play_styles.map((ps) => ps.play_styles.name),
    };
  }

  async getClubSquad(clubId: bigint, squadType?: string) {
    const where: any = { current_club_id: clubId };
    if (squadType) {
      where.squad_type = squadType;
    }

    const squad = await this.prisma.players.findMany({
      where,
      orderBy: [{ squad_type: 'asc' }, { squad_number: 'asc' }],
      include: {
        countries_players_nationality_idTocountries: { select: { name: true, flag_url: true } },
        player_status: true,
        player_positions: {
          include: { positions: true },
        },
      },
    });

    return squad.map((p) => {
      let attrSummary = null;
      if (p.attributes_summary) {
        try {
          attrSummary = typeof p.attributes_summary === 'string'
            ? JSON.parse(p.attributes_summary)
            : p.attributes_summary;
        } catch (e) {
          attrSummary = p.attributes_summary;
        }
      }

      const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];

      return {
        id: p.id.toString(),
        name: `${p.first_name} ${p.last_name}`.trim(),
        squad_number: p.squad_number,
        squad_type: p.squad_type,
        age: p.age,
        reputation: p.reputation,
        potential: p.potential,
        market_value: p.market_value,
        position: primaryPos?.positions ? {
          code: primaryPos.positions.code,
          name: primaryPos.positions.name,
        } : null,
        nationality: p.countries_players_nationality_idTocountries?.name,
        nationalityFlag: p.countries_players_nationality_idTocountries?.flag_url,
        status: p.player_status ? {
          condition: p.player_status.condition,
          fitness: p.player_status.fitness,
          form: p.player_status.form,
          morale: p.player_status.morale,
          is_injured: Boolean(p.player_status.is_injured),
          is_suspended: Boolean(p.player_status.is_suspended),
          is_transfer_listed: Boolean(p.player_status.is_transfer_listed),
          is_loan_listed: Boolean(p.player_status.is_loan_listed),
        } : null,
        attributes_summary: attrSummary,
      };
    });
  }

  async updateTransferListing(
    playerId: bigint,
    isTransferListed: boolean,
    isLoanListed: boolean,
    askingPrice?: number,
  ) {
    const status = await this.prisma.player_status.upsert({
      where: { player_id: playerId },
      update: {
        is_transfer_listed: isTransferListed,
        is_loan_listed: isLoanListed,
        ...(askingPrice !== undefined ? { asking_price: askingPrice } : {}),
      },
      create: {
        player_id: playerId,
        is_transfer_listed: isTransferListed,
        is_loan_listed: isLoanListed,
        asking_price: askingPrice || 0,
      },
    });

    return {
      message: 'Cập nhật trạng thái niêm yết chuyển nhượng thành công',
      status: {
        is_transfer_listed: Boolean(status.is_transfer_listed),
        is_loan_listed: Boolean(status.is_loan_listed),
        asking_price: status.asking_price,
      },
    };
  }
}
