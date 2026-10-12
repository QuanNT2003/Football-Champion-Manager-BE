import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClubs(page: number = 1, limit: number = 20, search?: string, countryId?: string) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 20);
    const skip = (p - 1) * l;
    const where: any = {};

    if (search) {
      where.name = { contains: search };
    }
    if (countryId) {
      where.country_id = BigInt(countryId);
    }

    const [total, clubs] = await Promise.all([
      this.prisma.clubs.count({ where }),
      this.prisma.clubs.findMany({
        where,
        skip,
        take: l,
        orderBy: { reputation: 'desc' },
        include: {
          countries: { select: { id: true, name: true, flag_url: true } },
          cities: { select: { id: true, name: true } },
          stadiums: { select: { id: true, name: true, capacity: true } },
          users: { select: { id: true, username: true } },
        },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      items: clubs.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        short_name: c.short_name,
        country: c.countries?.name,
        countryFlag: c.countries?.flag_url,
        city: c.cities?.name,
        stadium: c.stadiums?.[0] ? {
          id: c.stadiums[0].id.toString(),
          name: c.stadiums[0].name,
          capacity: c.stadiums[0].capacity,
        } : null,
        reputation: c.reputation,
        ranking_points: c.ranking_points,
        manager: c.users ? { id: c.users.id.toString(), username: c.users.username } : null,
        isAiManaged: !c.owner_user_id,
        logo_url: c.logo_url,
      })),
    };
  }

  async getClubById(clubId: bigint) {
    const club = await this.prisma.clubs.findUnique({
      where: { id: clubId },
      include: {
        countries: {
          include: {
            confederations_countries_confederation_idToconfederations: true,
          },
        },
        cities: true,
        stadiums: true,
        users: { select: { id: true, username: true } },
        financial_accounts: true,
        facilities: {
          include: {
            facility_types: true,
            facility_levels: true,
          },
        },
      },
    });

    if (!club) {
      throw new NotFoundException('Không tìm thấy câu lạc bộ');
    }

    const squadCount = await this.prisma.players.count({
      where: { current_club_id: clubId },
    });

    const trophiesCount = await this.prisma.club_trophies.count({ where: { club_id: clubId } });
    const fin = club.financial_accounts?.[0] || null;
    const confed = club.countries?.confederations_countries_confederation_idToconfederations;

    return {
      id: club.id.toString(),
      name: club.name,
      short_name: club.short_name,
      founded_year: club.founded_year,
      reputation: club.reputation,
      ranking_points: club.ranking_points,
      world_rank: club.world_rank,
      logo_url: club.logo_url,
      home_kit_url: club.home_kit_url,
      away_kit_url: club.away_kit_url,
      third_kit_url: club.third_kit_url,
      country_id: club.country_id ? club.country_id.toString() : null,
      current_competition_id: club.current_competition_id ? club.current_competition_id.toString() : null,
      country: club.countries?.name || null,
      confederation: confed ? {
        id: confed.id.toString(),
        name: confed.name,
        code: confed.code,
      } : null,
      country_detail: club.countries ? {
        id: club.countries.id.toString(),
        name: club.countries.name,
        code: club.countries.code,
        flag_url: club.countries.flag_url,
        confederation_id: club.countries.confederation_id ? club.countries.confederation_id.toString() : null,
        confederation: confed ? {
          id: confed.id.toString(),
          name: confed.name,
          code: confed.code,
        } : null,
      } : null,
      city: club.cities?.name,
      stadium: club.stadiums?.[0] ? {
        id: club.stadiums[0].id.toString(),
        name: club.stadiums[0].name,
        capacity: club.stadiums[0].capacity,
      } : null,
      manager: club.users ? {
        id: club.users.id.toString(),
        username: club.users.username,
      } : null,
      finances: fin ? {
        cash: fin.balance_cash,
        gold: fin.balance_gold,
      } : null,
      squadCount,
      facilities: club.facilities.map((f) => ({
        id: f.id.toString(),
        name: f.facility_types?.name,
        code: f.facility_types?.code,
        current_level: f.facility_levels?.level || 1,
        status: f.status,
      })),
    };
  }

  async getMyClub(userId: bigint) {
    const club = await this.prisma.clubs.findFirst({
      where: { owner_user_id: userId },
    });

    if (!club) {
      return null;
    }

    return this.getClubById(club.id);
  }

  async getStarterCountries(search?: string) {
    const s = search && search.trim() ? `%${search.trim()}%` : '%';
    const countries: any[] = await this.prisma.$queryRaw`
      SELECT c.id, c.name, c.code, c.flag_url, COUNT(DISTINCT cl.id) as unclaimed_clubs
      FROM countries c
      JOIN clubs cl ON cl.country_id = c.id
      JOIN competitions comp ON cl.current_competition_id = comp.id
      WHERE comp.tier IN (3, 4) AND cl.owner_user_id IS NULL AND c.name LIKE ${s}
      GROUP BY c.id, c.name, c.code, c.flag_url
      ORDER BY c.name ASC
    `;

    return countries.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      code: c.code,
      flag_url: c.flag_url,
      unclaimed_clubs: Number(c.unclaimed_clubs),
    }));
  }

  async getStarterTiers(countryId: string) {
    const cId = BigInt(countryId);
    const tiers: any[] = await this.prisma.$queryRaw`
      SELECT comp.tier, comp.name as competition_name, COUNT(cl.id) as unclaimed_count
      FROM competitions comp
      JOIN clubs cl ON cl.current_competition_id = comp.id
      WHERE cl.country_id = ${cId} AND comp.tier IN (3, 4) AND cl.owner_user_id IS NULL
      GROUP BY comp.tier, comp.name
      ORDER BY comp.tier ASC
    `;

    return tiers.map((t) => ({
      tier: Number(t.tier),
      competition_name: t.competition_name,
      unclaimed_count: Number(t.unclaimed_count),
    }));
  }

  async claimRandomStarterClub(userId: bigint, countryId: string, tier: number) {
    const existingOwnership = await this.prisma.clubs.findFirst({
      where: { owner_user_id: userId },
    });

    if (existingOwnership) {
      throw new ConflictException(`Bạn đã và đang quản lý CLB '${existingOwnership.name}'.`);
    }

    const t = Number(tier);
    if (![3, 4].includes(t)) {
      throw new BadRequestException('Chỉ được chọn câu lạc bộ khởi nghiệp ở giải Hạng 3 hoặc 4');
    }

    const cId = BigInt(countryId);
    const country = await this.prisma.countries.findUnique({
      where: { id: cId },
    });
    if (!country) {
      throw new NotFoundException('Không tìm thấy quốc gia đã chọn');
    }

    const availableClubs = await this.prisma.clubs.findMany({
      where: {
        country_id: cId,
        owner_user_id: null,
        competitions: {
          tier: t,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!availableClubs.length) {
      throw new NotFoundException('Đã hết câu lạc bộ còn trống ở Hạng đấu này của Quốc gia đã chọn');
    }

    const randomIndex = Math.floor(Math.random() * availableClubs.length);
    const chosenClub = availableClubs[randomIndex];

    const updated = await this.prisma.clubs.updateMany({
      where: {
        id: chosenClub.id,
        owner_user_id: null,
      },
      data: {
        owner_user_id: userId,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException('Câu lạc bộ này vừa được một HLV khác nhận. Vui lòng thử lại!');
    }

    const fin = await this.prisma.financial_accounts.findFirst({
      where: { club_id: chosenClub.id },
    });

    if (!fin) {
      await this.prisma.financial_accounts.create({
        data: {
          club_id: chosenClub.id,
          balance_cash: 1500000.0,
          balance_gold: 200,
          status: 'ACTIVE',
        },
      });
    }

    const clubDetail = await this.getClubById(chosenClub.id);

    return {
      message: `Chúc mừng HLV! Bạn đã chính thức tiếp quản câu lạc bộ ${chosenClub.name}!`,
      club: clubDetail,
    };
  }

  async claimClub(userId: bigint, clubId: bigint) {
    const existingOwnership = await this.prisma.clubs.findFirst({
      where: { owner_user_id: userId },
    });

    if (existingOwnership) {
      throw new ConflictException(`Bạn đã và đang quản lý CLB '${existingOwnership.name}'.`);
    }

    const club = await this.prisma.clubs.findUnique({
      where: { id: clubId },
      include: { financial_accounts: true },
    });

    if (!club) {
      throw new NotFoundException('Không tìm thấy CLB');
    }

    if (club.owner_user_id) {
      throw new ConflictException('CLB này đã được một Huấn Luyện Viên khác quản lý');
    }

    // Set owner and ensure financial account exists
    const updated = await this.prisma.clubs.update({
      where: { id: clubId },
      data: { owner_user_id: userId },
    });

    if (!club.financial_accounts || club.financial_accounts.length === 0) {
      await this.prisma.financial_accounts.create({
        data: {
          club_id: clubId,
          balance_cash: 5000000.0,
          balance_gold: 500,
          status: 'ACTIVE',
        },
      });
    }

    return {
      message: `Chúc mừng! Bạn đã chính thức trở thành Huấn Luyện Viên trưởng của CLB ${updated.name}!`,
      club: await this.getClubById(clubId),
    };
  }

  async getFacilities(clubId: bigint) {
    return this.prisma.facilities.findMany({
      where: { club_id: clubId },
      include: {
        facility_types: true,
        facility_levels: true,
      },
    });
  }

  async upgradeFacility(userId: bigint, clubId: bigint, facilityId: bigint) {
    const club = await this.prisma.clubs.findFirst({
      where: { id: clubId, owner_user_id: userId },
      include: { financial_accounts: true },
    });

    if (!club) {
      throw new BadRequestException('Bạn không có quyền quản lý CLB này');
    }

    const facility = await this.prisma.facilities.findUnique({
      where: { id: facilityId },
      include: { facility_types: true, facility_levels: true },
    });

    if (!facility || facility.club_id !== clubId) {
      throw new NotFoundException('Không tìm thấy cơ sở vật chất');
    }

    const currentLevel = facility.facility_levels?.level || 0;
    const nextLevel = currentLevel + 1;
    const levelConfig = await this.prisma.facility_levels.findFirst({
      where: {
        facility_type_id: facility.facility_type_id,
        level: nextLevel,
      },
    });

    if (!levelConfig) {
      throw new BadRequestException('Cơ sở vật chất này đã đạt cấp độ tối đa');
    }

    const costCash = Number(levelConfig.cost);
    const fin = club.financial_accounts?.[0];
    const currentCash = Number(fin?.balance_cash || 0);

    if (!fin || currentCash < costCash) {
      throw new BadRequestException(
        `Không đủ ngân sách tiền mặt. Cần: ${costCash.toLocaleString()} CASH, Hiện có: ${currentCash.toLocaleString()} CASH`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.financial_accounts.update({
        where: { id: fin.id },
        data: { balance_cash: { decrement: costCash } },
      }),
      this.prisma.facilities.update({
        where: { id: facilityId },
        data: { facility_level_id: levelConfig.id },
      }),
      this.prisma.facility_upgrades.create({
        data: {
          facility_id: facilityId,
          from_level_id: facility.facility_level_id,
          to_level_id: levelConfig.id,
          cost: costCash,
          started_at: new Date(),
          status: 'COMPLETED',
        },
      }),
      this.prisma.financial_transactions.create({
        data: {
          club_id: clubId,
          financial_account_id: fin.id,
          type: 'FACILITY_UPGRADE',
          category: 'INFRASTRUCTURE',
          amount: costCash,
          currency_type: 'CASH',
          reference_type: 'FACILITY',
          reference_id: facilityId,
          description: `Nâng cấp ${facility.facility_types?.name} lên cấp ${nextLevel}`,
          transaction_date: new Date(),
          idempotency_key: `FACILITY_UPGRADE_${facilityId}_LVL_${nextLevel}_${Date.now()}`,
        },
      }),
    ]);

    return {
      message: `Đã nâng cấp thành công ${facility.facility_types?.name} lên Cấp ${nextLevel}!`,
      new_level: nextLevel,
      remaining_cash: currentCash - costCash,
    };
  }

    async getClubDashboard(clubId: bigint) {
    const club = await this.prisma.clubs.findUnique({
      where: { id: clubId },
      include: {
        countries: true,
        cities: true,
        financial_accounts: true,
        stadiums: true,
      },
    });

    if (!club) {
      throw new NotFoundException('Không tìm thấy câu lạc bộ');
    }

    // 1. Squad metrics (OVR, Morale, Players Count)
    const players = await this.prisma.players.findMany({
      where: { current_club_id: clubId },
      include: {
        player_status: true,
      },
    });

    const playersCount = players.length;
    const avgOvr = playersCount > 0
      ? Math.round((players.reduce((sum, p) => {
          const rating = p.reputation ? Math.min(99, Math.max(40, p.reputation / 100)) : (p.potential || 50);
          return sum + rating;
        }, 0) / playersCount) * 10) / 10
      : 50.0;

    const avgMorale = playersCount > 0
      ? Math.round(players.reduce((sum, p) => sum + (p.player_status?.morale ?? 90), 0) / playersCount)
      : 90;

    // 2. Standing in Domestic League
    const leagueStanding = await this.prisma.stage_standings.findFirst({
      where: {
        club_id: clubId,
        competition_stages: {
          competition_seasons: {
            competitions: {
              competition_type: 'DOMESTIC_LEAGUE',
            },
          },
        },
      },
      include: {
        competition_stages: {
          include: {
            competition_seasons: {
              include: {
                competitions: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    const comp = leagueStanding?.competition_stages?.competition_seasons?.competitions;
    const compName = comp?.name || 'Giải Hạng Nhì (Tier 3)';
    const compTier = comp?.tier ?? 3;

    // 3. Next Match
    const nextMatch = await this.prisma.matches.findFirst({
      where: {
        OR: [
          { home_club_id: clubId },
          { away_club_id: clubId },
        ],
        status: { in: ['SCHEDULED', 'NOT_STARTED', 'WAITING', ''] },
      },
      include: {
        clubs_matches_home_club_idToclubs: true,
        clubs_matches_away_club_idToclubs: true,
        competition_seasons: {
          include: {
            competitions: true,
          },
        },
      },
      orderBy: [
        { match_date: 'asc' },
        { kickoff_time: 'asc' },
        { id: 'asc' },
      ],
    });

    // 4. Last Match
    const lastMatch = await this.prisma.matches.findFirst({
      where: {
        OR: [
          { home_club_id: clubId },
          { away_club_id: clubId },
        ],
        status: { in: ['FINISHED', 'COMPLETED'] },
      },
      include: {
        clubs_matches_home_club_idToclubs: true,
        clubs_matches_away_club_idToclubs: true,
        competition_seasons: {
          include: {
            competitions: true,
          },
        },
      },
      orderBy: [
        { match_date: 'desc' },
        { id: 'desc' },
      ],
    });

    // 5. Competitions List
    const allStandings = await this.prisma.stage_standings.findMany({
      where: { club_id: clubId },
      include: {
        competition_stages: {
          include: {
            competition_seasons: {
              include: {
                competitions: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const competitionsList = allStandings.map((s, idx) => {
      const c = s.competition_stages?.competition_seasons?.competitions;
      const isLeague = c?.competition_type === 'DOMESTIC_LEAGUE';
      const isCup = c?.competition_type === 'DOMESTIC_CUP';
      return {
        id: c?.id?.toString() || (idx + 1).toString(),
        name: c?.name || (isLeague ? compName : 'Cúp Quốc Gia'),
        type: isLeague ? 'LEAGUE' : isCup ? 'CUP' : 'CONTINENTAL',
        color: isLeague ? 'gold' : isCup ? 'amber' : 'blue',
        icon: isLeague ? '🏆' : isCup ? '🥇' : '🌍',
        sub_title: isLeague ? (club.countries?.name || 'Việt Nam') : 'Knockout',
        rank: isLeague ? s.position : undefined,
        points: isLeague ? s.points : undefined,
        round_label: isCup ? 'Vòng 1/32' : undefined,
        status_label: isLeague ? `Hạng ${s.position} • ${s.points} Điểm` : 'Vòng 1/32 Knockout',
      };
    });

    // Timeline context
    const timeline = await this.prisma.competition_seasons.findFirst({
      orderBy: { id: 'desc' },
    });

    // Trophies count
    const trophiesCount = await this.prisma.club_trophies.count({
      where: { club_id: clubId },
    });

    const fin = club.financial_accounts?.[0] || null;
    const isHomeNext = nextMatch ? nextMatch.home_club_id === clubId : true;

    let kickoffFormatted = '20:00';
    if (nextMatch?.kickoff_time) {
      const ko = new Date(nextMatch.kickoff_time);
      const hh = String(ko.getUTCHours()).padStart(2, '0');
      const mm = String(ko.getUTCMinutes()).padStart(2, '0');
      kickoffFormatted = `${hh}:${mm}`;
    }

    return {
      club: {
        id: club.id.toString(),
        name: club.name,
        short_name: club.short_name,
        logo_url: club.logo_url,
        country: club.countries?.name || 'Việt Nam',
        country_code: club.countries?.code || 'VN',
        flag_url: club.countries?.flag_url,
        reputation: club.reputation || 3000,
        popularity: Number(((club.reputation ? Math.min(99, Math.max(10, club.reputation / 100)) : 30.0)).toFixed(1)),
        team_morale: avgMorale,
        avg_ovr: avgOvr,
        players_count: playersCount,
        cash: fin ? Number(fin.balance_cash) : 0,
        gold: fin ? Number(fin.balance_gold) : 0,
        league_rank: leagueStanding ? leagueStanding.position : 1,
        league_points: leagueStanding ? leagueStanding.points : 0,
        trophies_count: trophiesCount,
        tier_label: `Tier ${compTier}`,
        competition_name: compName,
      },
      next_match: nextMatch ? {
        id: nextMatch.id.toString(),
        competition_name: nextMatch.competition_seasons?.competitions?.name || compName,
        season_day: nextMatch.season_day,
        match_date: nextMatch.match_date,
        kickoff_time: kickoffFormatted,
        status: nextMatch.status,
        is_home: isHomeNext,
        schedule_label: `${kickoffFormatted} • Ngày ${nextMatch.season_day}`,
        opponent: isHomeNext ? {
          id: nextMatch.clubs_matches_away_club_idToclubs?.id.toString(),
          name: nextMatch.clubs_matches_away_club_idToclubs?.name || 'Đối thủ',
          short_name: nextMatch.clubs_matches_away_club_idToclubs?.short_name,
          logo_url: nextMatch.clubs_matches_away_club_idToclubs?.logo_url,
          is_home: false,
        } : {
          id: nextMatch.clubs_matches_home_club_idToclubs?.id.toString(),
          name: nextMatch.clubs_matches_home_club_idToclubs?.name || 'Đối thủ',
          short_name: nextMatch.clubs_matches_home_club_idToclubs?.short_name,
          logo_url: nextMatch.clubs_matches_home_club_idToclubs?.logo_url,
          is_home: true,
        },
        home_club: {
          id: nextMatch.clubs_matches_home_club_idToclubs?.id.toString(),
          name: nextMatch.clubs_matches_home_club_idToclubs?.name || club.name,
          logo_url: nextMatch.clubs_matches_home_club_idToclubs?.logo_url,
        },
        away_club: {
          id: nextMatch.clubs_matches_away_club_idToclubs?.id.toString(),
          name: nextMatch.clubs_matches_away_club_idToclubs?.name || 'Đối thủ',
          logo_url: nextMatch.clubs_matches_away_club_idToclubs?.logo_url,
        },
      } : null,
      last_match: lastMatch ? {
        id: lastMatch.id.toString(),
        competition_name: lastMatch.competition_seasons?.competitions?.name || 'VĐQG',
        home_club_name: lastMatch.clubs_matches_home_club_idToclubs?.name || '',
        away_club_name: lastMatch.clubs_matches_away_club_idToclubs?.name || '',
        home_score: lastMatch.home_score ?? 0,
        away_score: lastMatch.away_score ?? 0,
      } : null,
      competitions: competitionsList,
      metrics: {
        avg_ovr: avgOvr,
        players_count: playersCount,
        team_morale: avgMorale,
      },
      timeline: {
        season_number: timeline ? Number(timeline.season_id) || 1 : 1,
        current_day: nextMatch ? nextMatch.season_day : 3,
        total_days: 34,
      },
    };
  }

  async getClubTrophies(clubId: bigint) {
    const trophies = await this.prisma.club_trophies.findMany({
      where: { club_id: clubId },
      include: {
        competitions: true,
        seasons: true,
      },
      orderBy: [
        { season_number: 'desc' },
        { achieved_at: 'desc' },
      ],
    });

    return trophies.map((t) => ({
      id: t.id.toString(),
      club_id: t.club_id.toString(),
      competition_id: t.competition_id.toString(),
      competition_name: t.competitions?.name || '',
      season_id: t.season_id.toString(),
      season_number: t.season_number,
      title_type: t.title_type,
      trophy_name: t.trophy_name,
      trophy_url: t.trophy_url || t.competitions?.trophy_url || null,
      rank_position: t.rank_position,
      achieved_at: t.achieved_at,
    }));
  }

}
