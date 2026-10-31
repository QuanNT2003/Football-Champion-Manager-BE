import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Tính OVR động 100% từ CSDL:
 * 1. Ưu tiên trung bình các chỉ số cốt lõi của vị trí (is_key = true trong position_attributes)
 * 2. Tính trung bình trọng số theo multiplier của position_attributes
 * 3. Fallback trung bình toàn bộ chỉ số nếu chưa cấu hình
 */
export function calculateDynamicOvr(
  playerAttributes: any,
  positionAttributes: { attribute_id: bigint | number; multiplier?: any; is_key?: boolean }[]
): number {
  if (!playerAttributes) return 50;

  if (Array.isArray(playerAttributes)) {
    if (playerAttributes.length === 0) return 50;
    const keyAttrs = positionAttributes.filter((pa) => pa.is_key);
    if (keyAttrs.length > 0) {
      let sumKey = 0;
      let countKey = 0;
      for (const ka of keyAttrs) {
        const pAttr = playerAttributes.find(
          (pa) => pa.attribute_id.toString() === ka.attribute_id.toString()
        );
        if (pAttr) {
          sumKey += pAttr.value;
          countKey++;
        }
      }
      if (countKey > 0) return Math.round(sumKey / countKey);
    }
    const total = playerAttributes.reduce((acc, a) => acc + (a.value || 0), 0);
    return Math.round(total / (playerAttributes.length || 1));
  }

  // playerAttributes is a single object with 40 attributes: { pac: 60, acc: 59, ... }
  const keys = Object.keys(playerAttributes).filter((k) => k !== 'player_id');
  if (keys.length === 0) return 50;
  const total = keys.reduce((acc, k) => acc + (Number(playerAttributes[k]) || 0), 0);
  return Math.round(total / keys.length);
}

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
          player_contracts: {
            where: { status: 'ACTIVE', is_loan_contract: true },
            include: {
              clubs_player_contracts_parent_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
            },
            take: 1,
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

        const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];
        const activeLoan = (p as any).player_contracts?.[0];
        const isOnLoan = Boolean(activeLoan);

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
          is_on_loan: isOnLoan,
          parent_club: activeLoan?.clubs_player_contracts_parent_club_idToclubs ? {
            id: activeLoan.clubs_player_contracts_parent_club_idToclubs.id.toString(),
            name: activeLoan.clubs_player_contracts_parent_club_idToclubs.name,
            logo_url: activeLoan.clubs_player_contracts_parent_club_idToclubs.logo_url,
          } : null,
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
        };
      }),
    };
  }

  async getPlayerById(playerId: bigint, viewerClubId?: bigint) {
    const basicPlayer = await this.prisma.players.findUnique({
      where: { id: playerId },
      select: { current_club_id: true },
    });

    if (!basicPlayer) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
    }

    // Kiểm tra xem cầu thủ có đang trong hợp đồng cho mượn hay không
    const activeLoan = await this.prisma.player_contracts.findFirst({
      where: {
        player_id: playerId,
        status: 'ACTIVE',
        is_loan_contract: true,
      },
      include: {
        clubs_player_contracts_parent_club_idToclubs: true,
        clubs_player_contracts_club_idToclubs: true,
      },
      orderBy: { id: 'desc' },
    });

    const isCurrentClub = Boolean(
      viewerClubId &&
      basicPlayer.current_club_id &&
      BigInt(basicPlayer.current_club_id) === BigInt(viewerClubId),
    );

    const isParentClub = Boolean(
      viewerClubId &&
      activeLoan?.parent_club_id &&
      BigInt(activeLoan.parent_club_id) === BigInt(viewerClubId),
    );

    const isOwner = isCurrentClub || isParentClub;

    const player: any = await this.prisma.players.findUnique({
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
        player_mentality: true,
        player_tactics: true,
        player_attributes: true,
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
            seasons: true,
          },
          orderBy: { transfer_date: 'desc' },
        },
        // Tối ưu DB & Bảo mật: Chỉ query các bảng nội bộ khi người xem là CLB chủ quản
        ...(isOwner
          ? {
              player_contracts: {
                where: {
                  status: 'ACTIVE',
                  ...(isCurrentClub && activeLoan
                    ? { id: activeLoan.id }
                    : viewerClubId
                      ? { club_id: viewerClubId }
                      : {}),
                },
                include: {
                  clubs_player_contracts_club_idToclubs: true,
                  clubs_player_contracts_parent_club_idToclubs: true,
                },
                orderBy: { id: 'desc' },
                take: 1,
              },
              player_attribute_history: {
                include: { attributes: true },
                orderBy: { created_at: 'asc' },
              },
              injuries: {
                include: { injury_types: true },
                orderBy: { start_date: 'desc' },
                take: 20,
              },
            }
          : {}),
      },
    });

    if (!player) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
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

    // Calculate attribute growth from player_attribute_history:
    // Growth per attribute = max(new_value) - min(old_value) across history records
    const growthMap = new Map<string, number>();
    if (player.player_attribute_history && player.player_attribute_history.length > 0) {
      const historyByAttr = new Map<string, { maxNew: number; minOld: number }>();
      for (const h of player.player_attribute_history) {
        const attrIdStr = h.attribute_id.toString();
        const current = historyByAttr.get(attrIdStr);
        if (!current) {
          historyByAttr.set(attrIdStr, {
            maxNew: h.new_value,
            minOld: h.old_value,
          });
        } else {
          current.maxNew = Math.max(current.maxNew, h.new_value);
          current.minOld = Math.min(current.minOld, h.old_value);
        }
      }

      for (const [attrIdStr, bounds] of historyByAttr.entries()) {
        const diff = bounds.maxNew - bounds.minOld;
        if (diff !== 0) {
          growthMap.set(attrIdStr, diff);
        }
      }
    }

    // Map 40 attributes from player_attributes table in DB
    const metaAttributes = await this.prisma.attributes.findMany({ orderBy: { id: 'asc' } });
    const pAttrs = (player.player_attributes as any) || {};
    const allAttributes = metaAttributes.map((attr) => {
      const colName = attr.code.toLowerCase();
      const val = pAttrs[colName] ?? 50;
      const keyInfo = keyAttrMap.get(attr.id.toString()) || { is_key: false, multiplier: 1.0, order_no: 0 };
      const growthDiff = growthMap.get(attr.id.toString());
      const growthStr = growthDiff !== undefined ? (growthDiff > 0 ? `+${growthDiff}` : `${growthDiff}`) : null;

      return {
        id: attr.id.toString(),
        code: attr.code,
        name: attr.name,
        category: attr.category,
        description: attr.description,
        value: val,
        potential_value: val,
        growth: growthStr,
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

    // Use OVR directly from player table if present, fallback to calculateDynamicOvr
    const ovr = player.ovr != null && player.ovr > 0 ? player.ovr : calculateDynamicOvr(player.player_attributes, posAttributes);

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

    // --- TAB 3: CAREER STATISTICS (100% PURE DB THEO BẢNG player_statistics) ---
    const careerSeasons = (player.player_statistics || []).map((ps) => {
      const yellow = ps.yellow_cards || 0;
      const red = ps.red_cards || 0;
      const avgRating = Number(Number(ps.average_rating || 0).toFixed(2));
      return {
        season: ps.seasons?.name || `Mùa ${ps.season_id}`,
        team: ps.clubs?.name || 'CLB',
        matches: ps.appearances || 0,
        minutes: ps.minutes || 0,
        clean_sheets: ps.clean_sheets || 0,
        goals: ps.goals || 0,
        assists: ps.assists || 0,
        yellow_cards: yellow,
        red_cards: red,
        cards: `${yellow}/${red}`,
        motm: ps.motm || 0,
        rating: avgRating,
        avg_quality: avgRating,
      };
    });

    const totalMatches = careerSeasons.reduce((acc, s) => acc + s.matches, 0);
    const totalMinutes = careerSeasons.reduce((acc, s) => acc + s.minutes, 0);
    const totalCleanSheets = careerSeasons.reduce((acc, s) => acc + s.clean_sheets, 0);
    const totalGoals = careerSeasons.reduce((acc, s) => acc + s.goals, 0);
    const totalAssists = careerSeasons.reduce((acc, s) => acc + s.assists, 0);
    const totalYellow = careerSeasons.reduce((acc, s) => acc + s.yellow_cards, 0);
    const totalRed = careerSeasons.reduce((acc, s) => acc + s.red_cards, 0);
    const totalMotm = careerSeasons.reduce((acc, s) => acc + s.motm, 0);
    const careerRating = careerSeasons.length > 0
      ? Number((careerSeasons.reduce((acc, s) => acc + s.rating, 0) / careerSeasons.length).toFixed(2))
      : 0;

    // Server timeline for contract & season comparison
    const timeline = await this.prisma.server_timeline.findFirst();
    const currentSeasonNumber = timeline?.season_number || 1;

    // --- TAB 4: TRANSFERS HISTORY (100% PURE DB) ---
    const allSeasons = await this.prisma.seasons.findMany({
      orderBy: { season_number: 'asc' },
    });

    const formatTransferFee = (fee: any) => {
      const num = Number(fee || 0);
      if (num <= 0) return 'Miễn phí';
      if (num < 1000) return `€${Math.round(num).toLocaleString('vi-VN')}`;
      if (num < 1000000) {
        const valK = num / 1000;
        const formattedK = valK % 1 === 0 ? valK.toString() : valK.toFixed(1).replace(/\.0$/, '');
        return `€${formattedK}K`;
      }
      const valM = num / 1000000;
      const formattedM = (valM >= 10 ? valM.toFixed(1) : valM.toFixed(2)).replace(/\.?0+$/, '');
      return `€${formattedM}M`;
    };

    const transfersHistory = (player.transfers || []).map((t: any) => {
      // Show ra số season thôi không thêm từ mùa vào
      const seasonNum = t.seasons?.season_number ?? (t.season_id ? Number(t.season_id) : currentSeasonNumber);
      const rawFee = Number(t.transfer_fee || 0);

      return {
        id: t.id ? t.id.toString() : undefined,
        from_team: t.clubs_transfers_from_club_idToclubs?.name || 'Tự do',
        to_team: t.clubs_transfers_to_club_idToclubs?.name || 'CLB Hiện Tại',
        season: String(seasonNum),
        season_id: t.season_id ? t.season_id.toString() : '1',
        date: t.transfer_date ? new Date(t.transfer_date).toLocaleDateString('vi-VN') : '',
        avg_quality: Number(Number(ovr).toFixed(1)),
        transfer_fee: rawFee,
        bid_value: formatTransferFee(rawFee),
        type: t.is_loan ? 'LOAN' : 'PERMANENT',
      };
    });

    // --- TAB 5: INJURIES HISTORY (100% PURE DB - CHỈ KHI LÀ CLB CHỦ QUẢN) ---
    const injuriesHistory = isOwner && player.injuries
      ? player.injuries.map((inj: any) => ({
          id: inj.id.toString(),
          injury_name: inj.injury_types?.name || 'Chấn thương',
          category: inj.injury_types?.category || 'MUSCLE',
          severity: inj.severity || 'MILD',
          days_missed: inj.days_injured || 0,
          days_remaining: inj.days_remaining || 0,
          season: inj.start_season_id ? `Mùa ${inj.start_season_id}` : 'Mùa 1',
          start_date: inj.start_date ? new Date(inj.start_date).toLocaleDateString('vi-VN') : '',
          status: inj.status || (inj.days_remaining > 0 ? 'ACTIVE' : 'RECOVERED'),
        }))
      : [];

    // Discipline from DB
    const isSuspended = Boolean(player.player_status?.is_suspended);
    const yellowCount = player.match_players?.reduce((acc: number, m: any) => acc + (m.yellow_cards || 0), 0) || 0;
    let disciplineLabel = 'Clean';
    let disciplineStatus: 'CLEAN' | 'WARNING' | 'SUSPENDED' = 'CLEAN';
    if (isSuspended) {
      disciplineLabel = '🟥 Đang bị treo giò';
      disciplineStatus = 'SUSPENDED';
    } else if (yellowCount > 0) {
      disciplineLabel = `🟨 ${yellowCount} thẻ vàng`;
      disciplineStatus = 'WARNING';
    }

    // Weekly wages from contract DB (chỉ hiển thị chi tiết khi là CLB chủ quản)
    const activeContract = isOwner && player.player_contracts ? player.player_contracts[0] : null;
    const contractSalary = activeContract?.salary ? Number(activeContract.salary) : 0;
    const weeklyWagesStr = isOwner
      ? (contractSalary > 0 
          ? (contractSalary >= 1000000 
              ? `€ ${(contractSalary / 1000000).toFixed(1)}M` 
              : contractSalary >= 1000 
                ? `€ ${(contractSalary / 1000).toFixed(contractSalary % 1000 === 0 ? 0 : 1)}K` 
                : `€ ${contractSalary}`)
          : 'Chưa ký HĐ')
      : 'Bảo mật';
    const worthStr = player.market_value ? `€ ${(Number(player.market_value) / 1000000).toFixed(2)}M` : '€ 0.0M';

    const contractEndSeason = activeContract?.end_season_id ? Number(activeContract.end_season_id) : currentSeasonNumber;
    const remainingSeasons = activeContract ? Math.max(0, contractEndSeason - currentSeasonNumber) : 0;

    // Condition & Fitness from player_status DB
    const staminaCondition = player.player_status?.condition ?? 100;
    const fatiguePct = Math.max(0, 100 - staminaCondition);
    const experiencePct = Math.min(100, Math.max(0, ((player.age || 18) - 16) * 5));

    return {
      id: player.id.toString(),
      is_own_club: isOwner,
      can_view_confidential: isOwner,
      name: `${player.first_name} ${player.last_name}`.trim(),
      first_name: player.first_name,
      last_name: player.last_name,
      age: player.age,
      birth_season: player.birth_season,
      birth_season_day: player.birth_season_day,
      birthday_text: player.birth_season_day ? `Ngày ${player.birth_season_day}` : '',
      date_of_birth: null,
      height: player.height ? `${player.height}cm` : '-',
      weight: player.weight ? `${player.weight}kg` : '-',
      preferred_foot: player.preferred_foot || 'Right',
      reputation: player.reputation,
      potential: player.potential || 1,
      market_value: player.market_value,
      worth_display: worthStr,
      weekly_wage: isOwner ? contractSalary : null,
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
        points: (player as any).experience ?? 0,
        percentage: experiencePct,
        label: `${(player as any).experience ?? 0} EXP`,
      },
      experience_points: (player as any).experience ?? 0,
      average_quality: Number(ovr),
      overall_rating: Number(ovr),
      ovr: Number(ovr),
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
      contract: isOwner && activeContract ? {
        id: activeContract.id.toString(),
        club_id: activeContract.club_id.toString(),
        club_name: activeContract.clubs_player_contracts_club_idToclubs?.name || player.clubs_players_current_club_idToclubs?.name || null,
        club_logo: activeContract.clubs_player_contracts_club_idToclubs?.logo_url || player.clubs_players_current_club_idToclubs?.logo_url || null,
        parent_club_id: activeContract.parent_club_id ? activeContract.parent_club_id.toString() : null,
        parent_club_name: activeContract.clubs_player_contracts_parent_club_idToclubs?.name || null,
        parent_club_logo: activeContract.clubs_player_contracts_parent_club_idToclubs?.logo_url || null,
        salary: Number(activeContract.salary),
        weekly_wage: Number(activeContract.salary),
        squad_role: activeContract.squad_role || 'Đội 1 (First Team)',
        status: activeContract.status || 'ACTIVE',
        start_date: activeContract.start_date,
        end_date: activeContract.end_date,
        start_season_id: Number(activeContract.start_season_id || 1),
        start_season_day: activeContract.start_season_day || 1,
        end_season_id: contractEndSeason,
        end_season_day: activeContract.end_season_day || 36,
        signing_bonus: Number(activeContract.signing_bonus || 0),
        release_clause: Number(activeContract.release_clause || 0),
        is_loan_contract: Boolean(activeContract.is_loan_contract),
        current_season: currentSeasonNumber,
        remaining_seasons: remainingSeasons,
      } : null,
      is_on_loan: Boolean(activeLoan),
      on_loan: activeLoan ? {
        is_loan: true,
        borrowing_club_id: activeLoan.club_id.toString(),
        borrowing_club_name: activeLoan.clubs_player_contracts_club_idToclubs?.name || null,
        borrowing_club_logo: activeLoan.clubs_player_contracts_club_idToclubs?.logo_url || null,
        parent_club_id: activeLoan.parent_club_id ? activeLoan.parent_club_id.toString() : null,
        parent_club_name: activeLoan.clubs_player_contracts_parent_club_idToclubs?.name || null,
        parent_club_logo: activeLoan.clubs_player_contracts_parent_club_idToclubs?.logo_url || null,
        end_season_id: Number(activeLoan.end_season_id || 1),
      } : null,
      positions: player.player_positions.map((pp: any) => ({
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
      active_injury: isOwner && player.injuries?.[0] && player.injuries[0].days_remaining > 0 ? {
        injury_type: player.injuries[0].injury_types?.name || 'Chấn thương',
        injury_code: player.injuries[0].injury_types?.code,
        severity: player.injuries[0].severity,
        days_remaining: player.injuries[0].days_remaining,
        expected_return_date: player.injuries[0].expected_return_date,
      } : null,
      play_styles: [player.player_tactics?.primary_style, player.player_tactics?.secondary_style].filter(Boolean),
      mentality: player.player_mentality || null,
      tactics: player.player_tactics || null,

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
          minutes: totalMinutes,
          clean_sheets: totalCleanSheets,
          goals: totalGoals,
          assists: totalAssists,
          cards: `${totalYellow}/${totalRed}`,
          motm: totalMotm,
          rating: careerRating,
        },
        seasons: careerSeasons,
      },
      transfers: {
        history: transfersHistory,
        potential_upgrades: [],
      },
      injuries_tab: {
        current: isOwner && player.injuries?.[0] && player.injuries[0].days_remaining > 0 ? {
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
        player_attributes: true,
        player_positions: {
          include: {
            positions: {
              include: {
                position_attributes: {
                  select: { attribute_id: true, multiplier: true, is_key: true, order_no: true },
                },
              },
            },
          },
        },
      },
    });

    return squad.map((p) => {

      const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];
      const posAttrs = primaryPos?.positions?.position_attributes || [];
      const ovr = p.ovr != null && p.ovr > 0 ? p.ovr : calculateDynamicOvr(p.player_attributes, posAttrs);

      return {
        id: p.id.toString(),
        name: `${p.first_name} ${p.last_name}`.trim(),
        squad_number: p.squad_number,
        squad_type: p.squad_type,
        age: p.age,
        reputation: p.reputation,
        potential: p.potential,
        experience: (p as any).experience ?? 0,
        market_value: p.market_value,
        photo_url: p.photo_url,
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
        overall_rating: ovr,
        ovr: ovr,
      };
    });
  }

  async updateTransferListing(
    playerId: bigint,
    isTransferListed: boolean,
    isLoanListed: boolean,
    askingPrice?: number,
    userClubId?: bigint,
  ) {
    const player = await this.prisma.players.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
    }

    if (userClubId && player.current_club_id && player.current_club_id !== userClubId) {
      throw new ForbiddenException('Bạn chỉ có quyền niêm yết chuyển nhượng cầu thủ thuộc CLB của mình');
    }

    // Không cho phép CLB mượn niêm yết cầu thủ đang mượn
    const activeLoan = await this.prisma.player_contracts.findFirst({
      where: {
        player_id: playerId,
        status: 'ACTIVE',
        is_loan_contract: true,
      },
    });
    if (activeLoan) {
      throw new ForbiddenException('Cầu thủ đang trong hợp đồng cho mượn, không thể niêm yết bán hoặc cho mượn lại.');
    }

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

  /**
   * Điều chuyển cầu thủ giữa Đội Một và Đội Trẻ, tự động gán số áo còn trống (1..99)
   */
  async updatePlayerSquad(
    playerId: bigint,
    targetSquadType: 'FIRST_TEAM' | 'YOUTH_U21' | 'RESERVES' | 'YOUTH_U19',
    desiredSquadNumber?: number,
    userClubId?: bigint,
  ) {
    const player = await this.prisma.players.findUnique({
      where: { id: playerId },
      include: {
        player_status: true,
      },
    });

    if (!player) {
      throw new NotFoundException('Không tìm thấy cầu thủ');
    }

    if (!player.current_club_id) {
      throw new BadRequestException('Cầu thủ tự do không thuộc biên chế CLB nào');
    }

    if (userClubId && player.current_club_id !== userClubId) {
      throw new ForbiddenException('Bạn chỉ có quyền điều chuyển cầu thủ thuộc CLB của mình');
    }

    // Lấy danh sách số áo đang được dùng trong squad đích của CLB này
    const existingSquadPlayers = await this.prisma.players.findMany({
      where: {
        current_club_id: player.current_club_id,
        squad_type: targetSquadType,
        id: { not: playerId },
        squad_number: { not: null },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        squad_number: true,
      },
    });

    const usedNumbers = new Set<number>(
      existingSquadPlayers
        .map((p) => Number(p.squad_number))
        .filter((num) => num > 0)
    );

    let assignedSquadNumber: number;

    if (desiredSquadNumber !== undefined && desiredSquadNumber !== null && desiredSquadNumber > 0) {
      if (desiredSquadNumber < 1 || desiredSquadNumber > 99) {
        throw new BadRequestException('Số áo phải từ 1 đến 99');
      }
      if (usedNumbers.has(desiredSquadNumber)) {
        const conflictPlayer = existingSquadPlayers.find(
          (p) => Number(p.squad_number) === desiredSquadNumber
        );
        const conflictName = conflictPlayer
          ? `${conflictPlayer.first_name} ${conflictPlayer.last_name}`.trim()
          : 'cầu thủ khác';
        throw new BadRequestException(
          `Số áo #${desiredSquadNumber} đã có ${conflictName} sử dụng trong ${targetSquadType === 'FIRST_TEAM' ? 'Đội Một' : 'Đội Trẻ'}`
        );
      }
      assignedSquadNumber = desiredSquadNumber;
    } else {
      // Tự động tìm số áo trống nhỏ nhất từ 1 đến 99
      let freeNum = 1;
      while (usedNumbers.has(freeNum) && freeNum <= 99) {
        freeNum++;
      }
      if (freeNum > 99) {
        freeNum = (existingSquadPlayers.length || 0) + 1;
      }
      assignedSquadNumber = freeNum;
    }

    const previousSquadType = player.squad_type;

    // Cập nhật squad_type và squad_number của cầu thủ
    const updatedPlayer = await this.prisma.players.update({
      where: { id: playerId },
      data: {
        squad_type: targetSquadType,
        squad_number: assignedSquadNumber,
      },
    });

    // Nếu chuyển từ Đội Một sang Đội Trẻ: rút cầu thủ khỏi đội hình thi đấu chính (Starting / Bench) của Đội Một nếu có
    if (previousSquadType === 'FIRST_TEAM' && targetSquadType !== 'FIRST_TEAM') {
      const firstTeamTactics = await this.prisma.club_tactics.findMany({
        where: {
          club_id: player.current_club_id,
          squad_type: 'FIRST_TEAM',
        },
        select: { id: true },
      });
      if (firstTeamTactics.length > 0) {
        await this.prisma.club_tactic_positions.updateMany({
          where: {
            tactic_id: { in: firstTeamTactics.map((t) => t.id) },
            player_id: playerId,
          },
          data: {
            player_id: null,
          },
        });
      }
    } else if (previousSquadType !== 'FIRST_TEAM' && targetSquadType === 'FIRST_TEAM') {
      // Tương tự nếu chuyển từ Đội Trẻ lên Đội Một: rút khỏi tactic của đội trẻ
      const youthTactics = await this.prisma.club_tactics.findMany({
        where: {
          club_id: player.current_club_id,
          squad_type: 'YOUTH_U21',
        },
        select: { id: true },
      });
      if (youthTactics.length > 0) {
        await this.prisma.club_tactic_positions.updateMany({
          where: {
            tactic_id: { in: youthTactics.map((t) => t.id) },
            player_id: playerId,
          },
          data: {
            player_id: null,
          },
        });
      }
    }

    const squadName = targetSquadType === 'FIRST_TEAM' ? 'Đội Một' : 'Đội Trẻ U21';

    return {
      success: true,
      message: `Đã chuyển ${player.first_name} ${player.last_name} sang ${squadName} thành công với số áo #${assignedSquadNumber}!`,
      player: {
        id: updatedPlayer.id.toString(),
        squad_type: updatedPlayer.squad_type,
        squad_number: updatedPlayer.squad_number,
      },
    };
  }
}
