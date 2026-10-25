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
        users: { select: { id: true, username: true, email: true, avatar_url: true, created_at: true, status: true } },
        competitions: true,
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

    const squad = await this.prisma.players.findMany({
      where: { current_club_id: clubId },
      select: { ovr: true, reputation: true, potential: true },
    });
    const squadCount = squad.length;
    const avgOvr = squadCount > 0
      ? Math.round((squad.reduce((sum, p) => sum + (p.ovr && p.ovr > 0 ? p.ovr : (p.potential || 50)), 0) / squadCount) * 10) / 10
      : 50.0;

    const trophiesCount = await this.prisma.club_trophies.count({ where: { club_id: clubId } });
    const fin = club.financial_accounts?.[0] || null;
    const confed = club.countries?.confederations_countries_confederation_idToconfederations;

    return {
      id: club.id.toString(),
      name: club.name,
      short_name: club.short_name,
      founded_year: club.founded_year || 1990,
      reputation: club.reputation,
      ranking_points: club.ranking_points,
      world_rank: club.world_rank,
      logo_url: club.logo_url,
      home_kit_url: club.home_kit_url,
      away_kit_url: club.away_kit_url,
      third_kit_url: club.third_kit_url,
      country_id: club.country_id ? club.country_id.toString() : null,
      current_competition_id: club.current_competition_id ? club.current_competition_id.toString() : null,
      current_competition: club.competitions ? {
        id: club.competitions.id.toString(),
        name: club.competitions.name,
        code: club.competitions.code,
        tier: club.competitions.tier,
        competition_type: club.competitions.competition_type,
      } : null,
      country: club.countries?.name || null,
      country_code: club.countries?.code || 'VN',
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
      city: club.cities?.name || 'Trụ sở chính',
      stadium: club.stadiums?.[0] ? {
        id: club.stadiums[0].id.toString(),
        name: club.stadiums[0].name,
        capacity: club.stadiums[0].capacity,
        condition: Number(club.stadiums[0].condition) || 100,
        image_url: club.stadiums[0].image_url || null,
      } : null,
      manager: club.users ? {
        id: club.users.id.toString(),
        username: club.users.username,
        email: club.users.email,
        avatar_url: club.users.avatar_url,
        created_at: club.users.created_at,
        status: club.users.status,
      } : null,
      isAiManaged: !club.owner_user_id,
      finances: fin ? {
        cash: fin.balance_cash,
        gold: fin.balance_gold,
      } : null,
      squadCount,
      trophiesCount,
      avgOvr,
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
          const rating = p.ovr != null && p.ovr > 0
            ? p.ovr
            : (p.reputation ? Math.min(99, Math.max(40, p.reputation / 100)) : (p.potential || 50));
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
        competition_type: c?.competition_type,
        tier: c?.tier,
        type: isLeague ? 'LEAGUE' : isCup ? 'CUP' : 'CONTINENTAL',
        color: isLeague ? 'gold' : isCup ? 'amber' : 'blue',
        icon: isLeague ? '🏆' : isCup ? '🥇' : '🌍',
        sub_title: isLeague ? (club.countries?.name || 'Việt Nam') : 'Knockout',
        country_name: club.countries?.name || 'Việt Nam',
        country_code: club.countries?.code || 'VN',
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

      // 6. Recent club news (Top 5 tin tức mới nhất của CLB)
      const recentNewsRaw = await this.prisma.club_news.findMany({
        where: { club_id: clubId },
        orderBy: { published_at: 'desc' },
        take: 5,
      });

      const recentNews = recentNewsRaw.map((n) => ({
        id: n.id.toString(),
        club_id: n.club_id.toString(),
        season_id: n.season_id ? n.season_id.toString() : null,
        news_type: n.news_type,
        title: n.title,
        thumbnail_url: n.thumbnail_url,
        content: n.content,
        published_at: n.published_at,
      }));

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
          home_club_id: lastMatch.home_club_id ? lastMatch.home_club_id.toString() : undefined,
          home_club_name: lastMatch.clubs_matches_home_club_idToclubs?.name || '',
          away_club_id: lastMatch.away_club_id ? lastMatch.away_club_id.toString() : undefined,
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
        recent_news: recentNews,
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

  async getClubNews(clubId: bigint, page: number = 1, limit: number = 20, newsType?: string, search?: string) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (p - 1) * l;

    const where: any = { club_id: clubId };
    if (newsType && newsType.trim()) {
      where.news_type = newsType.trim();
    }
    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { content: { contains: search.trim() } },
      ];
    }

    const [total, news] = await Promise.all([
      this.prisma.club_news.count({ where }),
      this.prisma.club_news.findMany({
        where,
        skip,
        take: l,
        orderBy: { published_at: 'desc' },
      }),
    ]);

    return {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      items: news.map((n) => ({
        id: n.id.toString(),
        club_id: n.club_id.toString(),
        season_id: n.season_id ? n.season_id.toString() : null,
        news_type: n.news_type,
        title: n.title,
        thumbnail_url: n.thumbnail_url,
        content: n.content,
        published_at: n.published_at,
      })),
    };
  }

  /**
   * 1. TAB PLAYERS: Lấy danh sách cầu thủ gồm 2 list Đội 1 và Đội Trẻ
   */
  async getClubSquadDetailed(clubId: bigint) {
    const rawPlayers = await this.prisma.players.findMany({
      where: { current_club_id: clubId },
      include: {
        countries_players_nationality_idTocountries: { select: { name: true, flag_url: true } },
        player_status: true,
        player_positions: {
          include: {
            positions: true,
          },
        },
        player_contracts: {
          where: { status: 'ACTIVE', is_loan_contract: true },
          take: 1,
        },
      },
      orderBy: [
        { ovr: 'desc' },
        { reputation: 'desc' },
      ],
    });

    const formatPlayer = (p: typeof rawPlayers[0]) => {
      const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];
      const activeLoan = p.player_contracts?.[0];
      const rating = p.ovr && p.ovr > 0 ? p.ovr : (p.potential || 55);

      return {
        id: p.id.toString(),
        name: `${p.first_name} ${p.last_name}`.trim(),
        first_name: p.first_name,
        last_name: p.last_name,
        age: p.age,
        ovr: rating,
        potential: p.potential || 70,
        reputation: p.reputation,
        market_value: Number(p.market_value) || 0,
        squad_type: p.squad_type,
        squad_number: p.squad_number,
        photo_url: p.photo_url,
        is_on_loan: Boolean(activeLoan),
        nationality: p.countries_players_nationality_idTocountries?.name || 'Việt Nam',
        nationalityFlag: p.countries_players_nationality_idTocountries?.flag_url,
        position: primaryPos?.positions ? {
          code: primaryPos.positions.code,
          name: primaryPos.positions.name,
        } : { code: 'CM', name: 'Tiền vệ trung tâm' },
        status: p.player_status ? {
          condition: p.player_status.condition,
          fitness: p.player_status.fitness,
          form: p.player_status.form,
          morale: p.player_status.morale,
          is_injured: Boolean(p.player_status.is_injured),
          is_suspended: Boolean(p.player_status.is_suspended),
          is_transfer_listed: Boolean(p.player_status.is_transfer_listed),
          is_loan_listed: Boolean(p.player_status.is_loan_listed),
          asking_price: Number(p.player_status.asking_price) || 0,
        } : null,
      };
    };

    const firstTeam: any[] = [];
    const youthTeam: any[] = [];

    for (const p of rawPlayers) {
      const formatted = formatPlayer(p);
      const isYouth =
        p.squad_type === 'YOUTH_U19' ||
        p.squad_type === 'YOUTH_U21' ||
        (p.age <= 20 && p.squad_type !== 'FIRST_TEAM');
      if (isYouth) {
        youthTeam.push(formatted);
      } else {
        firstTeam.push(formatted);
      }
    }

    return {
      firstTeam,
      youthTeam,
      totalPlayers: rawPlayers.length,
      firstTeamCount: firstTeam.length,
      youthTeamCount: youthTeam.length,
    };
  }

  /**
   * 2. TAB MATCHES: Lấy danh sách trận đấu mùa này của CLB
   */
  async getClubMatches(clubId: bigint, seasonId?: bigint) {
    const where: any = {
      OR: [
        { home_club_id: clubId },
        { away_club_id: clubId },
      ],
    };

    if (seasonId) {
      where.season_id = seasonId;
    }

    const matches = await this.prisma.matches.findMany({
      where,
      include: {
        clubs_matches_home_club_idToclubs: {
          select: { id: true, name: true, short_name: true, logo_url: true },
        },
        clubs_matches_away_club_idToclubs: {
          select: { id: true, name: true, short_name: true, logo_url: true },
        },
        competition_seasons: {
          include: {
            competitions: {
              select: { id: true, name: true, competition_type: true, tier: true },
            },
          },
        },
        stadiums: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { season_day: 'asc' },
        { match_date: 'asc' },
        { kickoff_time: 'asc' },
        { id: 'asc' },
      ],
    });

    return matches.map((m) => {
      const isHome = m.home_club_id === clubId;
      const opponent = isHome
        ? m.clubs_matches_away_club_idToclubs
        : m.clubs_matches_home_club_idToclubs;

      let result: 'W' | 'D' | 'L' | null = null;
      if (m.status === 'FINISHED' || m.status === 'COMPLETED') {
        const homeScore = m.home_score ?? 0;
        const awayScore = m.away_score ?? 0;
        if (homeScore === awayScore) {
          result = 'D';
        } else if ((isHome && homeScore > awayScore) || (!isHome && awayScore > homeScore)) {
          result = 'W';
        } else {
          result = 'L';
        }
      }

      let kickoffTime = '20:00';
      if (m.kickoff_time) {
        const ko = new Date(m.kickoff_time);
        const hh = String(ko.getUTCHours()).padStart(2, '0');
        const mm = String(ko.getUTCMinutes()).padStart(2, '0');
        kickoffTime = `${hh}:${mm}`;
      }

      return {
        id: m.id.toString(),
        season_day: m.season_day,
        match_date: m.match_date,
        kickoff_time: kickoffTime,
        status: m.status,
        is_home: isHome,
        home_team: {
          id: m.clubs_matches_home_club_idToclubs?.id.toString(),
          name: m.clubs_matches_home_club_idToclubs?.name || 'Đội nhà',
          short_name: m.clubs_matches_home_club_idToclubs?.short_name,
          logo_url: m.clubs_matches_home_club_idToclubs?.logo_url,
        },
        away_team: {
          id: m.clubs_matches_away_club_idToclubs?.id.toString(),
          name: m.clubs_matches_away_club_idToclubs?.name || 'Đội khách',
          short_name: m.clubs_matches_away_club_idToclubs?.short_name,
          logo_url: m.clubs_matches_away_club_idToclubs?.logo_url,
        },
        opponent: {
          id: opponent?.id.toString(),
          name: opponent?.name || 'Đối thủ',
          short_name: opponent?.short_name,
          logo_url: opponent?.logo_url,
        },
        home_score: m.home_score,
        away_score: m.away_score,
        result,
        competition_name: m.competition_seasons?.competitions?.name || 'VĐQG',
        competition_type: m.competition_seasons?.competitions?.competition_type || 'DOMESTIC_LEAGUE',
        stadium_name: m.stadiums?.name || 'Sân vận động',
      };
    });
  }

  /**
   * 3. TAB TRANSFERS: Lấy lịch sử chuyển nhượng liên quan đến CLB
   */
  async getClubTransfers(clubId: bigint) {
    const transfers = await this.prisma.transfers.findMany({
      where: {
        OR: [
          { from_club_id: clubId },
          { to_club_id: clubId },
        ],
      },
      include: {
        players: {
          include: {
            countries_players_nationality_idTocountries: { select: { name: true, flag_url: true } },
            player_positions: {
              include: { positions: true },
            },
          },
        },
        clubs_transfers_from_club_idToclubs: {
          select: { id: true, name: true, logo_url: true },
        },
        clubs_transfers_to_club_idToclubs: {
          select: { id: true, name: true, logo_url: true },
        },
        seasons: {
          select: { id: true, season_number: true },
        },
      },
      orderBy: [
        { transfer_date: 'desc' },
        { id: 'desc' },
      ],
    });

    const formatTransfer = (tr: typeof transfers[0], isArrival: boolean) => {
      const p = tr.players;
      const primaryPos = p.player_positions.find((pos) => pos.is_preferred) || p.player_positions[0];
      const otherClub = isArrival
        ? tr.clubs_transfers_from_club_idToclubs
        : tr.clubs_transfers_to_club_idToclubs;

      return {
        id: tr.id.toString(),
        transfer_type: tr.transfer_type,
        is_loan: tr.is_loan,
        transfer_fee: Number(tr.transfer_fee) || 0,
        currency_type: tr.currency_type,
        transfer_date: tr.transfer_date,
        season_number: tr.seasons?.season_number || 1,
        player: {
          id: p.id.toString(),
          name: `${p.first_name} ${p.last_name}`.trim(),
          age: p.age,
          ovr: p.ovr || p.potential || 55,
          photo_url: p.photo_url,
          position: primaryPos?.positions?.code || 'CM',
          nationalityFlag: p.countries_players_nationality_idTocountries?.flag_url,
        },
        other_club: {
          id: otherClub?.id.toString(),
          name: otherClub?.name || 'Tự do',
          logo_url: otherClub?.logo_url,
        },
      };
    };

    const arrivals: any[] = [];
    const departures: any[] = [];

    for (const tr of transfers) {
      if (tr.to_club_id === clubId) {
        arrivals.push(formatTransfer(tr, true));
      } else {
        departures.push(formatTransfer(tr, false));
      }
    }

    return {
      arrivals,
      departures,
      totalTransfers: transfers.length,
      totalSpend: arrivals.reduce((sum, a) => sum + (a.is_loan ? 0 : a.transfer_fee), 0),
      totalIncome: departures.reduce((sum, d) => sum + (d.is_loan ? 0 : d.transfer_fee), 0),
    };
  }

  /**
   * 4. TAB SEASON HISTORY: Danh hiệu trên đầu, thành tích các mùa giải phía dưới
   */
  async getClubSeasonHistory(clubId: bigint) {
    // A. Danh hiệu
    const trophies = await this.getClubTrophies(clubId);

    // B. Thành tích qua các mùa giải từ stage_standings
    const standings = await this.prisma.stage_standings.findMany({
      where: {
        club_id: clubId,
        competition_stages: {
          stage_type: 'LEAGUE',
        },
      },
      include: {
        competition_stages: {
          include: {
            competition_seasons: {
              include: {
                competitions: true,
                seasons: true,
              },
            },
          },
        },
      },
      orderBy: [
        { id: 'desc' },
      ],
    });

    const seasons = standings.map((s) => {
      const cs = s.competition_stages?.competition_seasons;
      const c = cs?.competitions;
      const seasonNum = cs?.seasons?.season_number || Number(cs?.season_id) || 1;
      const pos = s.position;

      let achievement = 'MID_TABLE';
      let achievementLabel = `Hạng ${pos}`;
      if (pos === 1) {
        achievement = 'CHAMPION';
        achievementLabel = '🏆 Vô Địch';
      } else if (pos <= 3) {
        achievement = 'TOP_3';
        achievementLabel = '🥉 Top 3 (Thăng hạng)';
      } else if (pos >= 15) {
        achievement = 'RELEGATED';
        achievementLabel = '⬇️ Xuống hạng';
      }

      return {
        id: s.id.toString(),
        season_id: cs?.season_id?.toString() || '1',
        season_number: seasonNum,
        competition_id: c?.id?.toString() || '1',
        competition_name: c?.name || `League Tier ${c?.tier || 1}`,
        competition_type: c?.competition_type || 'DOMESTIC_LEAGUE',
        tier: c?.tier || 1,
        position: s.position,
        played: s.played,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        goals_for: s.goals_for,
        goals_against: s.goals_against,
        goal_difference: s.goal_difference,
        points: s.points,
        achievement,
        achievement_label: achievementLabel,
      };
    });

    return {
      trophies,
      seasons,
      totalTrophies: trophies.length,
      championshipsCount: trophies.filter((t) => t.title_type === 'CHAMPION').length,
    };
  }

  /**
   * 5. TAB STADIUM: Thông tin sân vận động & Cơ sở vật chất CLB từ CSDL
   */
  async getClubStadium(clubId: bigint) {
    const stadium = await this.prisma.stadiums.findFirst({
      where: { club_id: clubId },
    });

    const recentMatchesCount = await this.prisma.matches.count({
      where: {
        home_club_id: clubId,
        status: { in: ['FINISHED', 'COMPLETED'] },
      },
    });

    const capacity = stadium?.capacity || 25000;
    const condition = Number(stadium?.condition) || 98.5;

    // 1. Lấy danh sách cơ sở vật chất từ bảng facilities
    let dbFacilities = await this.prisma.facilities.findMany({
      where: { club_id: clubId },
      include: {
        facility_types: true,
        facility_levels: true,
      },
      orderBy: { facility_type_id: 'asc' },
    });

    // Nếu CLB chưa có dữ liệu facilities, nạp từ tất cả facility_types với level 1
    if (!dbFacilities || dbFacilities.length === 0) {
      const allTypes = await this.prisma.facility_types.findMany({
        orderBy: { id: 'asc' },
      });

      for (const t of allTypes) {
        const lvl1 = await this.prisma.facility_levels.findFirst({
          where: { facility_type_id: t.id, level: 1 },
        });

        if (lvl1) {
          try {
            const created = await this.prisma.facilities.create({
              data: {
                club_id: clubId,
                facility_type_id: t.id,
                facility_level_id: lvl1.id,
                status: 'OPERATIONAL',
              },
              include: {
                facility_types: true,
                facility_levels: true,
              },
            });
            dbFacilities.push(created);
          } catch (e) {
            // Ignore duplicate if race condition
          }
        }
      }
    }

    // Helper map icons & badge colors theo mã cơ sở vật chất
    const getFacilityMeta = (code: string) => {
      switch (code) {
        case 'TRAINING_GROUND':
          return { icon: '🏋️‍♂️', badgeColor: 'emerald', effect: '+15% Tốc độ tăng trưởng chỉ số OVR' };
        case 'YOUTH_ACADEMY':
          return { icon: '🌱', badgeColor: 'green', effect: 'Tăng cơ hội xuất hiện Thần đồng tiềm năng 85+' };
        case 'MEDICAL_CENTRE':
          return { icon: '🏥', badgeColor: 'rose', effect: '-30% Thời gian điều trị chấn thương & Giảm rủi ro' };
        case 'DATA_ANALYTICS':
          return { icon: '📊', badgeColor: 'blue', effect: 'Mở khóa dữ liệu trinh sát và phân tích chiến thuật đối thủ' };
        case 'COMMERCIAL_OFFICE':
          return { icon: '🏢', badgeColor: 'amber', effect: '+25% Doanh thu bán vé, áo đấu & Hợp đồng tài trợ' };
        default:
          return { icon: '🏛️', badgeColor: 'slate', effect: 'Nâng cao chất lượng cơ sở hạ tầng CLB' };
      }
    };

    const formattedFacilities = await Promise.all(
      dbFacilities.map(async (f) => {
        const currentLevel = f.facility_levels?.level || 1;
        const meta = getFacilityMeta(f.facility_types?.code || '');

        // Lấy thông tin cấp tiếp theo
        const nextLevelConfig = await this.prisma.facility_levels.findFirst({
          where: {
            facility_type_id: f.facility_type_id,
            level: currentLevel + 1,
          },
        });

        return {
          id: f.id.toString(),
          type_id: f.facility_type_id.toString(),
          code: f.facility_types?.code || 'FACILITY',
          name: f.facility_types?.name || 'Cơ sở hạ tầng',
          description: f.facility_types?.description || '',
          level: currentLevel,
          max_level: 10,
          level_name: f.facility_levels?.name || `Cấp ${currentLevel}`,
          cost: Number(f.facility_levels?.cost || 0),
          upgrade_days: f.facility_levels?.upgrade_days || 7,
          next_cost: nextLevelConfig ? Number(nextLevelConfig.cost) : null,
          next_upgrade_days: nextLevelConfig ? nextLevelConfig.upgrade_days : null,
          status: f.status || 'OPERATIONAL',
          icon: meta.icon,
          badgeColor: meta.badgeColor,
          effect: meta.effect,
        };
      }),
    );

    return {
      id: stadium?.id ? stadium.id.toString() : '1',
      club_id: clubId.toString(),
      name: stadium?.name || 'Sân Vận Động Trung Tâm',
      capacity,
      condition,
      image_url: stadium?.image_url || 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
      pitch_type: 'Mặt cỏ tự nhiên lai ghép (Hybrid Grass)',
      lighting_system: 'Hệ thống đèn LED 2500 Lux chuẩn FIFA',
      stands: [
        { name: 'Khán đài A (Main Stand)', capacity: Math.round(capacity * 0.4), vipSeats: 1500, covered: true },
        { name: 'Khán đài B (Opposite Stand)', capacity: Math.round(capacity * 0.3), vipSeats: 200, covered: true },
        { name: 'Khán đài C (North Goal End)', capacity: Math.round(capacity * 0.15), vipSeats: 0, covered: false },
        { name: 'Khán đài D (South Goal End)', capacity: Math.round(capacity * 0.15), vipSeats: 0, covered: false },
      ],
      avgAttendanceThisSeason: Math.round(capacity * 0.82),
      totalMatchesHosted: recentMatchesCount,
      facilities: formattedFacilities,
    };
  }

}
