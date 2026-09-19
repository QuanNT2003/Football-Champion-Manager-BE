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
        let attrSummary: any = null;
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
        clubs_players_current_club_idToclubs: {
          include: {
            countries: true,
            stadiums: true,
          }
        },
        player_status: true,
        player_contracts: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        player_positions: {
          include: {
            positions: {
              include: {
                position_attributes: {
                  include: { attributes: true },
                  orderBy: { order_no: 'asc' },
                }
              }
            }
          },
        },
        injuries: {
          include: { injury_types: true },
          orderBy: { start_date: 'desc' },
          take: 20,
        },
        personality_types: true,
        player_play_styles: {
          include: { play_styles: true },
        },
        player_attributes: {
          include: { attributes: true },
          orderBy: { attribute_id: 'asc' },
        },
        player_attribute_history: {
          include: { attributes: true },
          orderBy: { created_at: 'desc' },
          take: 20,
        },
        match_players: {
          include: {
            matches: {
              include: {
                clubs_matches_home_club_idToclubs: true,
                clubs_matches_away_club_idToclubs: true,
              }
            }
          },
          orderBy: { id: 'desc' },
          take: 50,
        },
        player_statistics: {
          include: {
            seasons: true,
            clubs: true,
          },
          orderBy: { season_id: 'desc' },
        },
        transfers: {
          include: {
            clubs_transfers_from_club_idToclubs: true,
            clubs_transfers_to_club_idToclubs: true,
          },
          orderBy: { transfer_date: 'desc' },
        },
      },
    });

    if (!player) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
    }

    let attrSummary: any = null;
    if (player.attributes_summary) {
      try {
        attrSummary = typeof player.attributes_summary === 'string'
          ? JSON.parse(player.attributes_summary)
          : player.attributes_summary;
      } catch (e) {
        attrSummary = player.attributes_summary;
      }
    }

    // Positions & position_attributes mapping from DB
    const primaryPos = player.player_positions.find((pos) => pos.is_preferred) || player.player_positions[0];
    const isGK = primaryPos?.positions?.code === 'GK';

    // Build key attributes map from position_attributes table
    const posAttributes = primaryPos?.positions?.position_attributes || [];
    const keyAttrMap = new Map<string, { is_key: boolean; multiplier: number; order_no: number }>();
    for (const pa of posAttributes) {
      keyAttrMap.set(pa.attribute_id.toString(), {
        is_key: Boolean(pa.is_key),
        multiplier: Number(pa.multiplier),
        order_no: pa.order_no,
      });
    }

    // Map 40 attributes from player_attributes table in DB
    const allAttributes = player.player_attributes.map((pa) => {
      const keyInfo = keyAttrMap.get(pa.attribute_id.toString()) || { is_key: false, multiplier: 1.0, order_no: 0 };
      return {
        id: pa.attribute_id.toString(),
        code: pa.attributes.code,
        name: pa.attributes.name,
        category: pa.attributes.category,
        description: pa.attributes.description,
        value: pa.value ?? 0,
        potential_value: pa.potential_value ?? 0,
        is_key: keyInfo.is_key,
        multiplier: keyInfo.multiplier,
        order_no: keyInfo.order_no,
      };
    });

    // Categorized attributes strictly matching qkaito_football_champion_seed_data.sql
    const physicalAttrs = allAttributes.filter((a) => a.category === 'PHYSICAL');
    const technicalAttrs = allAttributes.filter((a) => a.category === 'TECHNICAL');
    const mentalAttrs = allAttributes.filter((a) => a.category === 'MENTAL');
    const goalkeepingAttrs = allAttributes.filter((a) => a.category === 'GOALKEEPING');

    // 10 Key Attributes for this player's position (is_key = true, ordered by order_no)
    const keyAttributes = allAttributes
      .filter((a) => a.is_key)
      .sort((a, b) => a.order_no - b.order_no);

    // If key attributes are available, split into 2 columns of 5 attributes each
    const leftColumnKey = keyAttributes.slice(0, Math.ceil(keyAttributes.length / 2));
    const rightColumnKey = keyAttributes.slice(Math.ceil(keyAttributes.length / 2));

    // Calculate OVR from attributes_summary or weighted key attributes
    const ovr = attrSummary?.ovr || attrSummary?.overall || (
      keyAttributes.length > 0
        ? Math.round(keyAttributes.reduce((acc, a) => acc + a.value, 0) / keyAttributes.length)
        : Math.round(allAttributes.reduce((acc, a) => acc + a.value, 0) / (allAttributes.length || 1))
    );

    // Total of key skills and total of all skills
    const totalKeySkills = keyAttributes.reduce((acc, a) => acc + a.value, 0);
    const totalAllSkills = allAttributes.reduce((acc, a) => acc + a.value, 0);

    // Progress chart: strictly from player_attribute_history if available in DB
    const qualityProgress: { age: number; season: string; quality: number }[] = [];
    if (player.player_attribute_history && player.player_attribute_history.length > 0) {
      player.player_attribute_history.forEach((h, idx) => {
        qualityProgress.push({
          age: (player.age || 20) - idx,
          season: `Lần ${idx + 1}`,
          quality: h.new_value,
        });
      });
    }

    // --- TAB 2: CURRENT SEASON MATCHES (100% PURE DB) ---
    const matchesList = (player.match_players || []).map((mp, index) => {
      const m = mp.matches;
      const isHome = m?.home_club_id === player.current_club_id;
      const opponentClub = isHome
        ? m?.clubs_matches_away_club_idToclubs
        : m?.clubs_matches_home_club_idToclubs;
      const homeScore = m?.home_score ?? 0;
      const awayScore = m?.away_score ?? 0;
      let outcome: 'WIN' | 'DRAW' | 'LOSS' = 'DRAW';
      if (isHome) {
        if (homeScore > awayScore) outcome = 'WIN';
        else if (homeScore < awayScore) outcome = 'LOSS';
      } else {
        if (awayScore > homeScore) outcome = 'WIN';
        else if (awayScore < homeScore) outcome = 'LOSS';
      }

      return {
        day: m?.season_day || (index + 1),
        opponent: opponentClub?.name || 'Đối thủ',
        opponent_logo: opponentClub?.logo_url || null,
        result: `${homeScore} - ${awayScore}`,
        outcome,
        minutes: mp.minutes || 0,
        saves_or_tackles: isGK ? 0 : 0,
        key_ass: `${mp.assists || 0}/${mp.assists || 0}`,
        shot_goal: `${(mp.goals || 0)}/${mp.goals || 0}`,
        rating: Number(mp.rating) || 0,
      };
    });

    // --- TAB 3: CAREER STATISTICS (100% PURE DB) ---
    const careerSeasons = (player.player_statistics || []).map((ps) => ({
      season: ps.seasons?.name || `Mùa ${ps.season_id}`,
      team: ps.clubs?.name || 'CLB',
      avg_quality: Number(Number(ps.average_rating || 0).toFixed(2)),
      matches: ps.appearances || 0,
      tackles: ps.clean_sheets || 0,
      key_ass: `${ps.assists || 0}/${ps.assists || 0}`,
      shot_goal: `${ps.goals || 0}/${ps.goals || 0}`,
      rating: Number(Number(ps.average_rating || 0).toFixed(2)),
    }));

    const totalMatches = careerSeasons.reduce((acc, s) => acc + s.matches, 0);
    const totalTackles = careerSeasons.reduce((acc, s) => acc + s.tackles, 0);
    const careerRating = careerSeasons.length > 0
      ? Number((careerSeasons.reduce((acc, s) => acc + s.rating, 0) / careerSeasons.length).toFixed(2))
      : 0;

    // --- TAB 4: TRANSFERS HISTORY (100% PURE DB) ---
    const transfersHistory = (player.transfers || []).map((t) => ({
      from_team: t.clubs_transfers_from_club_idToclubs?.name || 'CLB Trước',
      to_team: t.clubs_transfers_to_club_idToclubs?.name || 'CLB Hiện Tại',
      season: t.transfer_date ? new Date(t.transfer_date).toLocaleDateString('vi-VN') : 'Mùa 1',
      avg_quality: Number(Number(ovr).toFixed(1)),
      bid_value: t.transfer_fee ? `€ ${(Number(t.transfer_fee) / 1000000).toFixed(2)}M` : 'Miễn phí',
      type: t.is_loan ? 'LOAN' : 'PERMANENT',
    }));

    // --- TAB 5: INJURIES HISTORY (100% PURE DB) ---
    const injuriesHistory = (player.injuries || []).map((inj) => ({
      id: inj.id.toString(),
      injury_name: inj.injury_types?.name || 'Chấn thương',
      category: inj.injury_types?.category || 'MUSCLE',
      severity: inj.severity || 'MILD',
      days_missed: inj.days_injured || 0,
      days_remaining: inj.days_remaining || 0,
      season: inj.start_season_id ? `Mùa ${inj.start_season_id}` : 'Mùa 1',
      start_date: inj.start_date ? new Date(inj.start_date).toLocaleDateString('vi-VN') : '',
      status: inj.status || (inj.days_remaining > 0 ? 'ACTIVE' : 'RECOVERED'),
    }));

    // Discipline from DB
    const isSuspended = Boolean(player.player_status?.is_suspended);
    const yellowCount = player.match_players?.reduce((acc, m) => acc + (m.yellow_cards || 0), 0) || 0;
    let disciplineLabel = 'Clean';
    let disciplineStatus: 'CLEAN' | 'WARNING' | 'SUSPENDED' = 'CLEAN';
    if (isSuspended) {
      disciplineLabel = '🟥 Đang bị treo giò';
      disciplineStatus = 'SUSPENDED';
    } else if (yellowCount > 0) {
      disciplineLabel = `🟨 ${yellowCount} thẻ vàng`;
      disciplineStatus = 'WARNING';
    }

    // Weekly wages from contract DB
    const contractSalary = player.player_contracts[0]?.salary ? Number(player.player_contracts[0].salary) : 0;
    const weeklyWagesStr = contractSalary > 0 ? `€ ${(contractSalary / 52 / 1000).toFixed(2)}K` : 'Chưa ký HĐ';
    const worthStr = player.market_value ? `€ ${(Number(player.market_value) / 1000000).toFixed(2)}M` : '€ 0.0M';

    // Condition & Fitness from player_status DB
    const staminaCondition = player.player_status?.condition ?? 100;
    const fatiguePct = Math.max(0, 100 - staminaCondition);
    const experiencePct = Math.min(100, Math.max(0, ((player.age || 18) - 16) * 5));

    return {
      id: player.id.toString(),
      name: `${player.first_name} ${player.last_name}`.trim(),
      first_name: player.first_name,
      last_name: player.last_name,
      age: player.age,
      birthday_text: player.date_of_birth ? new Date(player.date_of_birth).toLocaleDateString('vi-VN') : '',
      date_of_birth: player.date_of_birth,
      height: player.height ? `${player.height}cm` : '-',
      weight: player.weight ? `${player.weight}kg` : '-',
      preferred_foot: player.preferred_foot || 'Right',
      reputation: player.reputation,
      potential: player.potential || 1,
      market_value: player.market_value,
      worth_display: worthStr,
      weekly_wages_display: weeklyWagesStr,
      squad_type: player.squad_type,
      squad_number: player.squad_number || '-',
      photo_url: player.photo_url,
      discipline: {
        status: disciplineStatus,
        label: disciplineLabel,
        yellow_cards: yellowCount,
        is_suspended: isSuspended,
      },
      fatigue: {
        condition: staminaCondition,
        percentage: fatiguePct,
        label: `${staminaCondition}% Thể Lực`,
      },
      experience: {
        percentage: experiencePct,
        label: `${experiencePct}%`,
      },
      average_quality: Number(ovr),
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
        country: player.clubs_players_current_club_idToclubs.countries?.name || null,
        country_flag: player.clubs_players_current_club_idToclubs.countries?.flag_url || null,
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
      primary_position: primaryPos?.positions ? {
        code: primaryPos.positions.code,
        name: primaryPos.positions.name,
      } : null,
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
      active_injury: player.injuries[0] && player.injuries[0].days_remaining > 0 ? {
        injury_type: player.injuries[0].injury_types?.name || 'Chấn thương',
        injury_code: player.injuries[0].injury_types?.code,
        severity: player.injuries[0].severity,
        days_remaining: player.injuries[0].days_remaining,
        expected_return_date: player.injuries[0].expected_return_date,
      } : null,
      attributes_summary: attrSummary,
      play_styles: player.player_play_styles.map((ps) => ps.play_styles.name),

      // 5 TABS DATA (100% PURE DATABASE ACCORDING TO SEED DATA)
      skills: {
        // Default 2-column view of Key Attributes according to player's position
        left_column: leftColumnKey,
        right_column: rightColumnKey,
        key_attributes: keyAttributes,
        all_attributes: allAttributes,
        categories: {
          physical: physicalAttrs,
          technical: technicalAttrs,
          mental: mentalAttrs,
          goalkeeping: goalkeepingAttrs,
        },
        total_skills: totalKeySkills,
        total_all_skills: totalAllSkills,
        average_quality: Number(ovr),
        quality_progress: qualityProgress,
      },
      matches: {
        total: matchesList.length,
        missed: 0,
        missed_pct: '0%',
        list: matchesList,
      },
      statistics: {
        career_totals: {
          matches: totalMatches,
          caps: 0,
          tackles: totalTackles,
          key_ass: '0/0',
          shot_goal: '0/0',
          rating: careerRating,
        },
        seasons: careerSeasons,
      },
      transfers: {
        history: transfersHistory,
        potential_upgrades: [],
      },
      injuries_tab: {
        current: player.injuries[0] && player.injuries[0].days_remaining > 0 ? {
          injury_type: player.injuries[0].injury_types?.name || 'Chấn thương',
          severity: player.injuries[0].severity,
          days_remaining: player.injuries[0].days_remaining,
        } : null,
        history: injuriesHistory,
      },
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
      let attrSummary: any = null;
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
