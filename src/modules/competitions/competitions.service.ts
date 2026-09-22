import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GenerateFixturesDto } from './dto/generate-fixtures.dto';
import { InitializeSeasonDto } from './dto/initialize-season.dto';
import { ProcessSeasonTransitionDto } from './dto/process-season-transition.dto';
import { ContinentalCoefficientService } from './continental-coefficient.service';

@Injectable()
export class CompetitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly continentalCoefficientService: ContinentalCoefficientService,
  ) {}


  private readonly leagueLocalKickoffSlots = ['19:30', '20:00', '20:30', '21:00', '21:30'];
  private readonly cupLocalKickoffSlots = ['10:00', '10:30', '11:00', '11:30', '12:00'];
  private readonly youthLocalKickoffSlots = ['17:00', '17:15', '17:30'];
  private readonly serverUtcOffset = 7 * 60;
  // 34 match days: First half Day 3-19 (17 days), Mid-season break Day 20-21, Second half Day 22-38 (17 days)
  // 30 match days (Season 36 days): First half Day 3-17 (15 days), Mid-season break Day 18-19, Second half Day 20-34 (15 days)
  private readonly leagueSeasonDays = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
  ];
  private readonly cupBusySeasonDays = new Set([3, 5, 6, 7, 11, 17, 23, 29, 35]);

  private readonly countryUtcOffsetByCode: Record<string, number> = {
    ARG: -180,
    BRA: -180,
    CHL: -240,
    COL: -300,
    MEX: -360,
    USA: -300,
    CAN: -300,
    ENG: 0,
    FRA: 60,
    GER: 60,
    ESP: 60,
    ITA: 60,
    NED: 60,
    POR: 0,
    RUS: 180,
    TUR: 180,
    VIE: 420,
    THA: 420,
    IDN: 420,
    MAS: 480,
    SIN: 480,
    CHN: 480,
    JPN: 540,
    KOR: 540,
    AUS: 600,
    NZL: 720,
    EGY: 120,
    RSA: 120,
    NGA: 60,
    MAR: 60,
  };

  private readonly continentUtcOffset: Record<string, number> = {
    ASIA: 420,
    EUROPE: 60,
    AFRICA: 120,
    'NORTH AMERICA': -300,
    'SOUTH AMERICA': -180,
    OCEANIA: 600,
  };

  
  async getCountries(search?: string) {
    const where: any = {};
    if (search && search.trim()) {
      where.name = { contains: search.trim() };
    }
    const countries = await this.prisma.countries.findMany({
      where,
      include: {
        confederations_countries_confederation_idToconfederations: {
          select: { code: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return countries.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      code: c.code,
      flag_url: c.flag_url,
      confederation: c.confederations_countries_confederation_idToconfederations
        ? {
            code: c.confederations_countries_confederation_idToconfederations.code,
            name: c.confederations_countries_confederation_idToconfederations.name,
          }
        : null,
    }));
  }

  async getCompetitions(countryId?: string, tier?: number) {
    let country: any = null;
    let confederation: any = null;

    if (countryId) {
      try {
        country = await this.prisma.countries.findUnique({
          where: { id: BigInt(countryId) },
          include: { confederations_countries_confederation_idToconfederations: true },
        });
        confederation = country?.confederations_countries_confederation_idToconfederations;
      } catch (e) {
        // ignore error
      }
    }

    const where: any = {};
    if (tier) where.tier = Number(tier);

    const comps = await this.prisma.competitions.findMany({
      where,
      orderBy: [{ id: 'asc' }],
    });

    return comps.map((comp) => {
      const isDomestic = comp.scope === 'DOMESTIC';
      const isContinental = comp.scope === 'CONTINENTAL' || comp.scope === 'REGIONAL';
      const isInternational = comp.scope === 'INTERNATIONAL';

      let displayName = comp.name;
      let groupLabel = '🏆 Đấu Trường Quốc Tế';
      let regionName = 'Toàn Cầu';

      let formatType: 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT' = 'LEAGUE';
      let formatLabel = 'Vòng tròn tính điểm';
      if (comp.competition_type === 'DOMESTIC_LEAGUE') {
        formatType = 'LEAGUE';
        formatLabel = 'Vòng tròn tính điểm (League)';
      } else if (comp.competition_type === 'DOMESTIC_CUP' || comp.competition_type === 'DOMESTIC_SUPER_CUP') {
        formatType = 'KNOCKOUT';
        formatLabel = comp.competition_type === 'DOMESTIC_SUPER_CUP' ? 'Tranh Siêu Cúp' : 'Cúp Loại Trực Tiếp (Knockout)';
      } else if (
        comp.competition_type?.startsWith('CONTINENTAL_CLUB') ||
        comp.competition_type?.startsWith('WORLD') ||
        comp.competition_type?.startsWith('CONTINENTAL_NATIONAL')
      ) {
        formatType = 'GROUP_KNOCKOUT';
        formatLabel = 'Vòng Bảng & Loại Trực Tiếp (Knockout)';
      }

      if (isDomestic && country) {
        groupLabel = `🇻🇳 Giải Đấu Quốc Nội (${country.name})`;
        regionName = country.name;
        displayName = `${comp.name} - ${country.name}`;
      } else if (isContinental && confederation) {
        groupLabel = `🌏 Cúp Châu Lục (${confederation.code})`;
        regionName = confederation.name;
        const code = confederation.code;
        if (comp.id === 8n) {
          if (code === 'AFC') displayName = 'Cúp C1 Châu Lục (AFC Champions League Elite)';
          else if (code === 'UEFA') displayName = 'Cúp C1 Châu Lục (UEFA Champions League)';
          else if (code === 'CONMEBOL') displayName = 'Cúp C1 Châu Lục (Copa Libertadores)';
          else displayName = `${comp.name} (${code})`;
        } else if (comp.id === 9n) {
          if (code === 'AFC') displayName = 'Cúp C2 Châu Lục (AFC Champions League Two)';
          else if (code === 'UEFA') displayName = 'Cúp C2 Châu Lục (UEFA Europa League)';
          else if (code === 'CONMEBOL') displayName = 'Cúp C2 Châu Lục (Copa Sudamericana)';
          else displayName = `${comp.name} (${code})`;
        } else if (comp.id === 10n) {
          if (code === 'AFC') displayName = 'Cúp C3 Châu Lục (AFC Challenge League)';
          else if (code === 'UEFA') displayName = 'Cúp C3 Châu Lục (UEFA Conference League)';
          else displayName = `${comp.name} (${code})`;
        } else {
          displayName = `${comp.name} (${code})`;
        }
      }

      return {
        id: comp.id.toString(),
        code: comp.code,
        name: comp.name,
        displayName,
        groupLabel,
        regionName,
        scope: comp.scope,
        tier: comp.tier,
        format_type: comp.format_type,
        formatType,
        formatLabel,
        total_teams: comp.total_teams,
        country_id: country ? country.id.toString() : null,
        confederation_id: confederation ? confederation.id.toString() : null,
        country: country
          ? {
              id: country.id.toString(),
              name: country.name,
              code: country.code,
              flag_url: country.flag_url,
            }
          : null,
        confederation: confederation
          ? {
              id: confederation.id.toString(),
              name: confederation.name,
              code: confederation.code,
            }
          : null,
      };
    });
  }

  async getCompetitionById(id: bigint) {
    const comp = await this.prisma.competitions.findUnique({
      where: { id },
      include: {
        countries: true,
        competition_seasons: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });

    if (!comp) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    return comp;
  }

  async getStandings(competitionId: bigint, seasonId?: bigint, countryId?: string) {
    const comp = await this.prisma.competitions.findUnique({
      where: { id: competitionId },
    });

    const isDomestic = comp?.scope === 'DOMESTIC';
    const isContinental = comp?.scope === 'CONTINENTAL' || comp?.scope === 'REGIONAL';

    // 1. Find active competition_season
    const whereCs: any = {
      competition_id: competitionId,
      ...(seasonId ? { season_id: seasonId } : {}),
    };
    if (isDomestic && countryId) {
      whereCs.country_id = BigInt(countryId);
    } else if (isContinental && countryId) {
      const country = await this.prisma.countries.findUnique({
        where: { id: BigInt(countryId) },
        select: { confederation_id: true },
      });
      if (country?.confederation_id) {
        whereCs.confederation_id = country.confederation_id;
      }
    }

    let compSeason = await this.prisma.competition_seasons.findFirst({
      where: whereCs,
      orderBy: { id: 'desc' },
      include: {
        competition_stages: {
          include: {
            stage_groups: {
              orderBy: { order_no: 'asc' },
              include: {
                stage_standings: {
                  include: {
                    clubs: {
                      select: { id: true, name: true, short_name: true, logo_url: true },
                    },
                  },
                  orderBy: [{ points: 'desc' }, { goal_difference: 'desc' }, { goals_for: 'desc' }],
                },
              },
            },
            stage_standings: {
              include: {
                clubs: {
                  select: { id: true, name: true, short_name: true, logo_url: true },
                },
              },
              orderBy: [{ points: 'desc' }, { goal_difference: 'desc' }, { goals_for: 'desc' }],
            },
          },
        },
      },
    });

    // If not found with country_id (for domestic), fallback to finding any matching season
    if (!compSeason && !seasonId && !isContinental) {
      compSeason = await this.prisma.competition_seasons.findFirst({
        where: { competition_id: competitionId },
        orderBy: { id: 'desc' },
        include: {
          competition_stages: {
            include: {
              stage_groups: {
                orderBy: { order_no: 'asc' },
                include: {
                  stage_standings: {
                    include: {
                      clubs: {
                        select: { id: true, name: true, short_name: true, logo_url: true },
                      },
                    },
                    orderBy: [{ points: 'desc' }, { goal_difference: 'desc' }, { goals_for: 'desc' }],
                  },
                },
              },
              stage_standings: {
                include: {
                  clubs: {
                    select: { id: true, name: true, short_name: true, logo_url: true },
                  },
                },
                orderBy: [{ points: 'desc' }, { goal_difference: 'desc' }, { goals_for: 'desc' }],
              },
            },
          },
        },
      });
    }

    const stage = compSeason?.competition_stages?.[0];
    const standings = stage?.stage_standings || [];

    let formatType: 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT' = 'LEAGUE';
    let formatLabel = 'Vòng tròn tính điểm';
    if (comp?.competition_type === 'DOMESTIC_LEAGUE') {
      formatType = 'LEAGUE';
      formatLabel = 'Vòng tròn tính điểm (League)';
    } else if (comp?.competition_type === 'DOMESTIC_CUP' || comp?.competition_type === 'DOMESTIC_SUPER_CUP') {
      formatType = 'KNOCKOUT';
      formatLabel = comp?.competition_type === 'DOMESTIC_SUPER_CUP' ? 'Tranh Siêu Cúp' : 'Cúp Loại Trực Tiếp (Knockout)';
    } else if (
      comp?.competition_type?.startsWith('CONTINENTAL_CLUB') ||
      comp?.competition_type?.startsWith('WORLD') ||
      comp?.competition_type?.startsWith('CONTINENTAL_NATIONAL')
    ) {
      formatType = 'GROUP_KNOCKOUT';
      formatLabel = 'Vòng Bảng & Loại Trực Tiếp (Knockout)';
    }

    // Extract groups if competition has multiple groups (e.g. Continental Cup Group Stage: Group A to H)
    const rawGroups = stage?.stage_groups || [];
    const groups = rawGroups
      .map((g) => ({
        id: g.id.toString(),
        name: g.name,
        orderNo: g.order_no,
        standings: (g.stage_standings || []).map((s, idx) => ({
          id: s.id.toString(),
          position: idx + 1,
          club: s.clubs
            ? {
                id: s.clubs.id.toString(),
                name: s.clubs.name,
                short_name: s.clubs.short_name,
                logo_url: s.clubs.logo_url,
              }
            : null,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goals_for: s.goals_for,
          goals_against: s.goals_against,
          goal_difference: s.goal_difference,
          points: s.points,
        })),
      }))
      .filter((g) => g.standings.length > 0);

    if (standings.length > 0 || groups.length > 0) {
      return {
        competitionId: competitionId.toString(),
        stageName: stage?.name || 'Vòng Bảng',
        formatType,
        formatLabel,
        groups: groups.length > 0 ? groups : undefined,
        standings: standings.map((s, idx) => ({
          id: s.id.toString(),
          position: idx + 1,
          club: s.clubs
            ? {
                id: s.clubs.id.toString(),
                name: s.clubs.name,
                short_name: s.clubs.short_name,
                logo_url: s.clubs.logo_url,
              }
            : null,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goals_for: s.goals_for,
          goals_against: s.goals_against,
          goal_difference: s.goal_difference,
          points: s.points,
        })),
      };
    }

    // Fallback if stage_standings has no records: Populate from participating clubs
    let participatingClubs: any[] = [];
    if (isDomestic && countryId) {
      const cId = BigInt(countryId);
      participatingClubs = await this.prisma.clubs.findMany({
        where: {
          country_id: cId,
          ...(comp?.tier && comp.tier > 0 ? { current_competition_id: competitionId } : {}),
        },
        take: 20,
        orderBy: { reputation: 'desc' },
        select: { id: true, name: true, short_name: true, logo_url: true, reputation: true },
      });
    } else if (isContinental && countryId) {
      const country = await this.prisma.countries.findUnique({
        where: { id: BigInt(countryId) },
        select: { confederation_id: true },
      });
      if (country?.confederation_id) {
        participatingClubs = await this.prisma.clubs.findMany({
          where: {
            countries: { confederation_id: country.confederation_id },
          },
          take: 32,
          orderBy: { reputation: 'desc' },
          select: { id: true, name: true, short_name: true, logo_url: true, reputation: true },
        });
      }
    }

    if (participatingClubs.length === 0) {
      participatingClubs = await this.prisma.clubs.findMany({
        take: 16,
        orderBy: { reputation: 'desc' },
        select: { id: true, name: true, short_name: true, logo_url: true, reputation: true },
      });
    }

    return {
      competitionId: competitionId.toString(),
      stageName: 'Mùa giải mới',
      standings: participatingClubs.map((c, idx) => ({
        id: c.id.toString(),
        position: idx + 1,
        club: {
          id: c.id.toString(),
          name: c.name,
          short_name: c.short_name,
          logo_url: c.logo_url,
        },
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      })),
    };
  }

  async getTopScorers(competitionId: bigint, limit: number = 10, countryId?: string) {
    const l = Math.max(1, Number(limit) || 10);
    const whereCs: any = { competition_id: competitionId };
    if (countryId) whereCs.country_id = BigInt(countryId);

    let compSeason = await this.prisma.competition_seasons.findFirst({
      where: whereCs,
      orderBy: { id: 'desc' },
    });

    if (!compSeason) {
      compSeason = await this.prisma.competition_seasons.findFirst({
        where: { competition_id: competitionId },
        orderBy: { id: 'desc' },
      });
    }

    if (compSeason) {
      const stats = await this.prisma.player_statistics.findMany({
        where: {
          competition_season_id: compSeason.id,
          goals: { gt: 0 },
        },
        take: l,
        orderBy: [{ goals: 'desc' }, { assists: 'desc' }],
        include: {
          players: {
            select: { id: true, first_name: true, last_name: true, photo_url: true },
          },
          clubs: {
            select: { id: true, name: true, logo_url: true },
          },
        },
      });

      if (stats.length > 0) {
        return stats.map((s, idx) => ({
          rank: idx + 1,
          player: s.players
            ? {
                id: s.players.id.toString(),
                name: `${s.players.first_name} ${s.players.last_name}`.trim(),
                photo_url: s.players.photo_url,
              }
            : null,
          club: s.clubs
            ? {
                id: s.clubs.id.toString(),
                name: s.clubs.name,
                logo_url: s.clubs.logo_url,
              }
            : null,
          goals: s.goals,
          assists: s.assists,
          appearances: s.appearances,
          rating: s.average_rating,
        }));
      }
    }

    // Fallback: Top forwards from clubs in this competition
    const clubs = await this.getCompetitionTeams(competitionId, countryId);
    const clubIds = clubs.slice(0, 10).map((c) => BigInt(c.id));
    if (clubIds.length === 0) return [];

    const topPlayers = await this.prisma.players.findMany({
      where: {
        current_club_id: { in: clubIds },
      },
      take: l,
      orderBy: [{ reputation: 'desc' }],
      include: {
        clubs_players_current_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
      },
    });

    return topPlayers.map((p, idx) => ({
      rank: idx + 1,
      player: {
        id: p.id.toString(),
        name: `${p.first_name} ${p.last_name}`.trim(),
        photo_url: p.photo_url,
      },
      club: p.clubs_players_current_club_idToclubs
        ? {
            id: p.clubs_players_current_club_idToclubs.id.toString(),
            name: p.clubs_players_current_club_idToclubs.name,
            logo_url: p.clubs_players_current_club_idToclubs.logo_url,
          }
        : null,
      goals: 0,
      assists: 0,
      appearances: 0,
      rating: ((p.reputation || 7000) / 1000).toFixed(1),
    }));
  }

  async getTopAssists(competitionId: bigint, limit: number = 10, countryId?: string) {
    const l = Math.max(1, Number(limit) || 10);
    const whereCs: any = { competition_id: competitionId };
    if (countryId) whereCs.country_id = BigInt(countryId);

    let compSeason = await this.prisma.competition_seasons.findFirst({
      where: whereCs,
      orderBy: { id: 'desc' },
    });

    if (!compSeason) {
      compSeason = await this.prisma.competition_seasons.findFirst({
        where: { competition_id: competitionId },
        orderBy: { id: 'desc' },
      });
    }

    if (compSeason) {
      const stats = await this.prisma.player_statistics.findMany({
        where: {
          competition_season_id: compSeason.id,
          assists: { gt: 0 },
        },
        take: l,
        orderBy: [{ assists: 'desc' }, { goals: 'desc' }],
        include: {
          players: {
            select: { id: true, first_name: true, last_name: true, photo_url: true },
          },
          clubs: {
            select: { id: true, name: true, logo_url: true },
          },
        },
      });

      if (stats.length > 0) {
        return stats.map((s, idx) => ({
          rank: idx + 1,
          player: s.players
            ? {
                id: s.players.id.toString(),
                name: `${s.players.first_name} ${s.players.last_name}`.trim(),
                photo_url: s.players.photo_url,
              }
            : null,
          club: s.clubs
            ? {
                id: s.clubs.id.toString(),
                name: s.clubs.name,
                logo_url: s.clubs.logo_url,
              }
            : null,
          goals: s.goals,
          assists: s.assists,
          appearances: s.appearances,
          rating: s.average_rating,
        }));
      }
    }

    // Fallback: Top midfielders/playmakers
    const clubs = await this.getCompetitionTeams(competitionId, countryId);
    const clubIds = clubs.slice(0, 10).map((c) => BigInt(c.id));
    if (clubIds.length === 0) return [];

    const topPlayers = await this.prisma.players.findMany({
      where: {
        current_club_id: { in: clubIds },
      },
      take: l,
      orderBy: [{ reputation: 'desc' }],
      include: {
        clubs_players_current_club_idToclubs: { select: { id: true, name: true, logo_url: true } },
      },
    });

    return topPlayers.map((p, idx) => ({
      rank: idx + 1,
      player: {
        id: p.id.toString(),
        name: `${p.first_name} ${p.last_name}`.trim(),
        photo_url: p.photo_url,
      },
      club: p.clubs_players_current_club_idToclubs
        ? {
            id: p.clubs_players_current_club_idToclubs.id.toString(),
            name: p.clubs_players_current_club_idToclubs.name,
            logo_url: p.clubs_players_current_club_idToclubs.logo_url,
          }
        : null,
      goals: 0,
      assists: 0,
      appearances: 0,
      rating: ((p.reputation || 7000) / 1000).toFixed(1),
    }));
  }

  private mapClubToTeamDto(c: any) {
    return {
      id: c.id.toString(),
      name: c.name,
      short_name: c.short_name,
      logo_url: c.logo_url,
      city: c.cities?.name,
      country: c.countries?.name,
      stadium: c.stadiums?.[0]
        ? {
            name: c.stadiums[0].name,
            capacity: c.stadiums[0].capacity,
          }
        : null,
      reputation: c.reputation,
      manager: c.users ? { id: c.users.id.toString(), username: c.users.username } : null,
    };
  }

  async getCompetitionTeams(competitionId: bigint, countryId?: string) {
    const comp = await this.prisma.competitions.findUnique({
      where: { id: competitionId },
    });

    const isDomestic = comp?.scope === 'DOMESTIC';
    const isContinental = comp?.scope === 'CONTINENTAL' || comp?.scope === 'REGIONAL';

    // 1. If domestic and countryId provided: return clubs of this country
    if (isDomestic && countryId) {
      const cId = BigInt(countryId);
      const clubs = await this.prisma.clubs.findMany({
        where: {
          country_id: cId,
          ...(comp?.tier && comp.tier > 0 ? { current_competition_id: competitionId } : {}),
        },
        include: {
          stadiums: true,
          cities: true,
          countries: true,
          users: { select: { id: true, username: true } },
        },
        orderBy: { reputation: 'desc' },
      });

      if (clubs.length > 0) {
        return clubs.map((c) => this.mapClubToTeamDto(c));
      }
    }

    // 2. If continental and countryId provided: return clubs of this confederation
    if (isContinental && countryId) {
      const country = await this.prisma.countries.findUnique({
        where: { id: BigInt(countryId) },
        select: { confederation_id: true },
      });

      if (country?.confederation_id) {
        const clubs = await this.prisma.clubs.findMany({
          where: {
            countries: { confederation_id: country.confederation_id },
          },
          take: 32,
          include: {
            stadiums: true,
            cities: true,
            countries: true,
            users: { select: { id: true, username: true } },
          },
          orderBy: { reputation: 'desc' },
        });

        if (clubs.length > 0) {
          return clubs.map((c) => this.mapClubToTeamDto(c));
        }
      }
    }

    // 3. Try competition_seasons stage_teams
    let confedIdForFilter: bigint | null = null;
    if (isContinental && countryId) {
      const country = await this.prisma.countries.findUnique({
        where: { id: BigInt(countryId) },
        select: { confederation_id: true },
      });
      confedIdForFilter = country?.confederation_id || null;
    }

    const compSeason = await this.prisma.competition_seasons.findFirst({
      where: {
        competition_id: competitionId,
        ...(countryId && isDomestic ? { country_id: BigInt(countryId) } : {}),
        ...(confedIdForFilter ? { confederation_id: confedIdForFilter } : {}),
      },
      orderBy: { id: 'desc' },
      include: {
        competition_stages: {
          include: {
            stage_teams: {
              include: {
                clubs: {
                  include: {
                    stadiums: true,
                    cities: true,
                    countries: true,
                    users: { select: { id: true, username: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const stageTeams = compSeason?.competition_stages?.[0]?.stage_teams || [];
    if (stageTeams.length > 0) {
      return stageTeams.map((st) => this.mapClubToTeamDto(st.clubs));
    }

    // 4. Default fallback: take top 20 clubs
    const clubs = await this.prisma.clubs.findMany({
      take: 20,
      include: {
        stadiums: true,
        cities: true,
        countries: true,
        users: { select: { id: true, username: true } },
      },
      orderBy: { reputation: 'desc' },
    });

    return clubs.map((c) => this.mapClubToTeamDto(c));
  }

  /**
   * Thuật toán Berger Tables (Round-Robin Fixture Generator)
   * Sinh danh sách các cặp đấu vòng tròn 2 lượt (Lượt đi & Lượt về)
   */
  private generateBergerPairings(teamIds: bigint[]): Array<{ round: number; home: bigint; away: bigint }> {
    if (teamIds.length < 2) return [];

    const teams: (bigint | null)[] = [...teamIds];
    if (teams.length % 2 !== 0) {
      teams.push(null); // Dummy bye nếu số đội lẻ
    }

    const n = teams.length;
    const numRounds = n - 1;
    const pairings: Array<{ round: number; home: bigint; away: bigint }> = [];

    // 1. Lượt đi (First Leg): Sử dụng công thức Berger chính thống
    for (let r = 1; r <= numRounds; r++) {
      const roundMatches: Array<{ home: number; away: number }> = [];

      // Trận đấu có đội thứ n (Pivot match)
      if (r % 2 === 1) {
        const opp = (r + 1) / 2;
        roundMatches.push({ home: opp, away: n });
      } else {
        const opp = (r + n) / 2;
        roundMatches.push({ home: n, away: opp });
      }

      // Các cặp đấu còn lại trong vòng r
      for (let k = 1; k < n / 2; k++) {
        let t1: number;
        let t2: number;
        if (r % 2 === 1) {
          t1 = (r + 1) / 2 - k;
          t2 = (r + 1) / 2 + k;
        } else {
          t1 = (r + n) / 2 - k;
          t2 = (r + n) / 2 + k;
        }

        if (t1 < 1) t1 += n - 1;
        if (t2 > n - 1) t2 -= n - 1;

        // Phân bổ Sân Nhà / Sân Khách theo chuẩn Berger
        if ((t1 + t2) % 2 === 1) {
          if (t1 < t2) {
            roundMatches.push({ home: t1, away: t2 });
          } else {
            roundMatches.push({ home: t2, away: t1 });
          }
        } else {
          if (t1 > t2) {
            roundMatches.push({ home: t1, away: t2 });
          } else {
            roundMatches.push({ home: t2, away: t1 });
          }
        }
      }

      // Ánh xạ chỉ số (1..n) sang CLB thực tế
      for (const m of roundMatches) {
        const homeTeam = teams[m.home - 1];
        const awayTeam = teams[m.away - 1];
        if (homeTeam !== null && awayTeam !== null) {
          pairings.push({ round: r, home: homeTeam, away: awayTeam });
        }
      }
    }

    // 2. Lượt về (Second Leg / Return Leg): Đảo ngược sân nhà - sân khách
    // Sử dụng thứ tự vòng xoay [2, 3, ..., numRounds, 1] giúp loại bỏ chuỗi nhiều trận cùng sân
    // Đảm bảo 100% các đội đều có lịch thi đấu xen kẽ H-A-H-A (tối đa 2 trận cùng sân)
    const leg2RoundOrder: number[] = [];
    for (let r = 2; r <= numRounds; r++) {
      leg2RoundOrder.push(r);
    }
    leg2RoundOrder.push(1);

    for (let idx = 0; idx < leg2RoundOrder.length; idx++) {
      const origRound = leg2RoundOrder[idx];
      const newRound = numRounds + idx + 1;
      const origMatches = pairings.filter((m) => m.round === origRound);
      for (const m of origMatches) {
        pairings.push({
          round: newRound,
          home: m.away, // Đảo sân cho lượt về
          away: m.home,
        });
      }
    }

    return pairings;
  }

  private getSeasonDate(season: { start_date: Date }, seasonDay: number) {
    return new Date(season.start_date.getTime() + (seasonDay - 1) * 24 * 60 * 60 * 1000);
  }

  private getCountryUtcOffset(country?: { code?: string | null; continent?: string | null } | null) {
    const code = country?.code?.toUpperCase();
    if (code && this.countryUtcOffsetByCode[code] !== undefined) {
      return this.countryUtcOffsetByCode[code];
    }

    const continent = country?.continent?.toUpperCase();
    return continent && this.continentUtcOffset[continent] !== undefined
      ? this.continentUtcOffset[continent]
      : this.serverUtcOffset;
  }

  private getKickoffTimeFromLocalSlot(
    slots: string[],
    slotSeed: number,
    country?: { code?: string | null; continent?: string | null } | null,
  ) {
    const slot = slots[Math.abs(slotSeed) % slots.length];
    const [localHour, localMinute] = slot.split(':').map(Number);
    const localMinutes = localHour * 60 + localMinute;
    const countryOffset = this.getCountryUtcOffset(country);
    const serverMinutes = (localMinutes - countryOffset + this.serverUtcOffset + 24 * 60) % (24 * 60);
    const serverHour = Math.floor(serverMinutes / 60);
    const serverMinute = serverMinutes % 60;

    return new Date(Date.UTC(1970, 0, 1, serverHour, serverMinute, 0));
  }

  private getLeagueRoundDays(teamCount: number, totalRounds: number): number[] {
    const baseDays = [...this.leagueSeasonDays];
    // Mỗi giải 16 đội thi đấu đúng 30 vòng khớp hoàn hảo với 30 ngày trong leagueSeasonDays
    return baseDays.slice(0, totalRounds);
  }

  private canScheduleMatch(
    teamDailyLoad: Map<string, number>,
    seasonDay: number,
    homeClubId: bigint,
    awayClubId: bigint,
  ) {
    const homeKey = `${homeClubId.toString()}:${seasonDay}`;
    const awayKey = `${awayClubId.toString()}:${seasonDay}`;
    return (teamDailyLoad.get(homeKey) || 0) < 2 && (teamDailyLoad.get(awayKey) || 0) < 2;
  }

  private reserveMatchDay(
    teamDailyLoad: Map<string, number>,
    seasonDay: number,
    homeClubId: bigint,
    awayClubId: bigint,
  ) {
    const homeKey = `${homeClubId.toString()}:${seasonDay}`;
    const awayKey = `${awayClubId.toString()}:${seasonDay}`;
    teamDailyLoad.set(homeKey, (teamDailyLoad.get(homeKey) || 0) + 1);
    teamDailyLoad.set(awayKey, (teamDailyLoad.get(awayKey) || 0) + 1);
  }

  private findSchedulableCupDay(
    preferredDays: number[],
    teamDailyLoad: Map<string, number>,
    homeClubId: bigint,
    awayClubId: bigint,
  ) {
    for (const day of preferredDays) {
      if (this.canScheduleMatch(teamDailyLoad, day, homeClubId, awayClubId)) {
        return day;
      }
    }

    for (const day of this.leagueSeasonDays) {
      if (this.canScheduleMatch(teamDailyLoad, day, homeClubId, awayClubId)) {
        return day;
      }
    }

    return preferredDays[0];
  }

  private async ensureServerTimeline(worldId: bigint, season: any) {
    return this.prisma.server_timeline.upsert({
      where: { world_id: worldId },
      update: {
        season_id: season.id,
        season_number: season.season_number,
        season_day: season.current_day || 1,
        total_season_days: season.total_days || 40,
        real_date: season.start_date,
        season_status: 'IN_PROGRESS',
        is_transfer_window_open: season.is_transfer_window_open ?? true,
        is_paused: false,
      },
      create: {
        world_id: worldId,
        season_id: season.id,
        season_number: season.season_number,
        season_day: season.current_day || 1,
        total_season_days: season.total_days || 40,
        world_day: 1,
        real_date: season.start_date,
        season_status: 'IN_PROGRESS',
        is_transfer_window_open: season.is_transfer_window_open ?? true,
        is_paused: false,
      },
    });
  }

  private async ensureStageGroup(stageId: bigint, name = 'Main Table', code = 'MAIN', orderNo = 1) {
    const existing = await this.prisma.stage_groups.findFirst({
      where: { stage_id: stageId, code },
      orderBy: { id: 'asc' },
    });

    if (existing) return existing;

    return this.prisma.stage_groups.create({
      data: {
        stage_id: stageId,
        name,
        code,
        order_no: orderNo,
      },
    });
  }

  private async ensureStageRound(
    stageId: bigint,
    season: { start_date: Date },
    roundNo: number,
    seasonDay: number,
    name = `Round ${roundNo}`,
  ) {
    const existing = await this.prisma.stage_rounds.findFirst({
      where: { stage_id: stageId, round_no: roundNo },
      orderBy: { id: 'asc' },
    });

    if (existing) return existing;

    const roundDate = this.getSeasonDate(season, seasonDay);
    return this.prisma.stage_rounds.create({
      data: {
        stage_id: stageId,
        name,
        round_no: roundNo,
        round_season_day: seasonDay,
        start_date: roundDate,
        end_date: roundDate,
      },
    });
  }

  private async ensureStageParticipants(
    stageId: bigint,
    clubs: Array<{ id: bigint; country_id: bigint | null }>,
    groupId: bigint | null,
    qualificationSource: string,
  ) {
    if (clubs.length === 0) return 0;

    const teamWhere: any = { stage_id: stageId };
    const standingWhere: any = { stage_id: stageId };
    if (groupId) {
      teamWhere.group_id = groupId;
      standingWhere.group_id = groupId;
    }

    const existingTeamsCount = await this.prisma.stage_teams.count({ where: teamWhere });
    if (existingTeamsCount === 0) {
      await this.prisma.stage_teams.createMany({
        data: clubs.map((c, idx) => ({
          stage_id: stageId,
          group_id: groupId,
          club_id: c.id,
          country_id: c.country_id,
          seed: idx + 1,
          status: 'ACTIVE',
          qualification_source: qualificationSource,
        })),
      });
    }

    const existingStandingsCount = await this.prisma.stage_standings.count({ where: standingWhere });
    if (existingStandingsCount === 0) {
      await this.prisma.stage_standings.createMany({
        data: clubs.map((c, idx) => ({
          stage_id: stageId,
          group_id: groupId,
          club_id: c.id,
          country_id: c.country_id,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          goal_difference: 0,
          points: 0,
          position: idx + 1,
        })),
      });
    }

    return existingTeamsCount === 0 ? clubs.length : 0;
  }

  /**
   * Sinh Lịch Thi Đấu (Fixtures) cho các giải đấu trong Mùa Giải
   */
  async generateSeasonFixtures(dto: GenerateFixturesDto) {
    // 1. Xác định Season
    let season: any = null;
    if (dto.seasonId) {
      season = await this.prisma.seasons.findUnique({ where: { id: BigInt(dto.seasonId) } });
    } else {
      season = await this.prisma.seasons.findFirst({ where: { status: 'ACTIVE' }, orderBy: { id: 'desc' } });
    }

    if (!season) {
      throw new NotFoundException('Không tìm thấy mùa giải hợp lệ để sinh lịch thi đấu');
    }

    // Pre-load map sân vận động cho các CLB
    const stadiums = await this.prisma.stadiums.findMany({ select: { id: true, club_id: true } });
    const stadiumMap = new Map<string, bigint>();
    stadiums.forEach((s) => stadiumMap.set(s.club_id.toString(), s.id));

    const clubCountries = await this.prisma.clubs.findMany({
      select: {
        id: true,
        countries: { select: { code: true, continent: true } },
      },
    });
    const clubCountryMap = new Map<string, { code: string | null; continent: string | null } | null>();
    clubCountries.forEach((club) => clubCountryMap.set(club.id.toString(), club.countries || null));

    const BATCH_SIZE = 10000;
    let totalLeagueMatches = 0;
    let totalSuperCupMatches = 0;
    let totalCupMatches = 0;
    let totalContMatches = 0;
    let totalYouthMatches = 0;
    const teamDailyLoad = new Map<string, number>();

    const loadExistingScheduledMatches = async () => {
      const existingScheduledMatches = await this.prisma.matches.findMany({
        where: { season_id: season.id, status: 'SCHEDULED' },
        select: { season_day: true, home_club_id: true, away_club_id: true },
      });
      existingScheduledMatches.forEach((match) => {
        if (match.home_club_id && match.away_club_id) {
          this.reserveMatchDay(teamDailyLoad, match.season_day, match.home_club_id, match.away_club_id);
        }
      });
    };

    // A. NẾU YÊU CẦU REGENERATE: XÓA CÁC TRẬN SCHEDULED CŨ
    if (dto.regenerate) {
      const deleteWhere: any = { season_id: season.id, status: 'SCHEDULED' };
      if (dto.countryId) {
        deleteWhere.competition_seasons = { country_id: BigInt(dto.countryId) };
      }
      if (dto.competitionSeasonId) {
        deleteWhere.competition_season_id = BigInt(dto.competitionSeasonId);
      }
      await this.prisma.matches.deleteMany({ where: deleteWhere });
      teamDailyLoad.clear();
    }

    await loadExistingScheduledMatches();

    // =========================================================================
    // 1. FULL LỊCH GIẢI LEAGUE (TẤT CẢ TIER 1..5 Ở TẤT CẢ QUỐC GIA)
    // =========================================================================
    const whereLeagueCS: any = {
      season_id: season.id,
      competitions: { competition_type: 'DOMESTIC_LEAGUE' },
    };
    if (dto.competitionSeasonId) whereLeagueCS.id = BigInt(dto.competitionSeasonId);
    if (dto.countryId) whereLeagueCS.country_id = BigInt(dto.countryId);

    const leagueCompSeasons = await this.prisma.competition_seasons.findMany({
      where: whereLeagueCS,
      include: {
        competition_stages: {
          include: {
            stage_groups: { orderBy: { order_no: 'asc' } },
            stage_teams: { where: { status: 'ACTIVE' }, select: { club_id: true, group_id: true } },
          },
        },
        competitions: { select: { tier: true } },
      },
    });

    const allLeagueMatches: any[] = [];
    for (const cs of leagueCompSeasons) {
      for (const stage of cs.competition_stages) {
        const groups = (stage as any).stage_groups?.length > 0
          ? (stage as any).stage_groups
          : [await this.ensureStageGroup(stage.id)];

        for (const group of groups) {
          const clubIds = stage.stage_teams
            .filter((st: any) => !st.group_id || st.group_id === group.id)
            .map((st) => st.club_id)
            .filter((id): id is bigint => id !== null);

          if (clubIds.length < 2) continue;

          // Bỏ qua nếu đã có trận đấu rồi trong group này (trừ khi regenerate)
          if (!dto.regenerate) {
            const matchCount = await this.prisma.matches.count({
              where: { competition_season_id: cs.id, stage_id: stage.id, group_id: group.id },
            });
            if (matchCount > 0) continue;
          }

          const pairings = this.generateBergerPairings(clubIds);
          const maxRound = Math.max(...pairings.map((p) => p.round));
          const roundDays = this.getLeagueRoundDays(clubIds.length, maxRound);
          const rounds = new Map<number, any>();
          for (let roundNo = 1; roundNo <= maxRound; roundNo++) {
            const seasonDay = roundDays[roundNo - 1] || this.leagueSeasonDays[this.leagueSeasonDays.length - 1];
            const round = await this.ensureStageRound(stage.id, season, roundNo, seasonDay, `Vòng ${roundNo}`);
            rounds.set(roundNo, round);
          }

          for (const p of pairings) {
            const seasonDay = roundDays[p.round - 1] || this.leagueSeasonDays[this.leagueSeasonDays.length - 1];
            const matchDate = this.getSeasonDate(season, seasonDay);
            const homeId = p.home;
            const awayId = p.away;
            const sId = stadiumMap.get(homeId.toString()) || null;
            const country = clubCountryMap.get(homeId.toString());
            const kickoff_time = this.getKickoffTimeFromLocalSlot(this.leagueLocalKickoffSlots, Number(homeId + awayId + BigInt(p.round)), country);

            this.reserveMatchDay(teamDailyLoad, seasonDay, homeId, awayId);

            allLeagueMatches.push({
              competition_season_id: cs.id,
              stage_id: stage.id,
              round_id: rounds.get(p.round)?.id,
              group_id: group.id,
              season_id: season.id,
              season_day: seasonDay,
              match_date: matchDate,
              kickoff_time,
              home_club_id: homeId,
              away_club_id: awayId,
              stadium_id: sId,
              status: 'SCHEDULED',
              match_type: 'COMPETITIVE' as any,
              result_type: 'REGULAR' as any,
            });
          }
        }
      }
    }

    if (allLeagueMatches.length > 0) {
      for (let i = 0; i < allLeagueMatches.length; i += BATCH_SIZE) {
        await this.prisma.matches.createMany({ data: allLeagueMatches.slice(i, i + BATCH_SIZE) });
      }
      totalLeagueMatches = allLeagueMatches.length;
    }

    // Danh sách quốc gia cần xử lý cúp
    const countryWhere: any = {};
    if (dto.countryId) countryWhere.id = BigInt(dto.countryId);
    const countries = await this.prisma.countries.findMany({ where: countryWhere, select: { id: true, name: true } });

    // =========================================================================
    // 2. SIÊU CÚP QUỐC GIA (DOMESTIC_SUPER_CUP - DAY 3 MỞ MÀN MÙA GIẢI)
    // =========================================================================
    if (!dto.competitionSeasonId || dto.competitionId === '7') {
      const superCupMatches: any[] = [];
      for (const c of countries) {
        const topClubs = await this.prisma.clubs.findMany({
          where: { country_id: c.id, current_competition_id: 1n },
          take: 2,
          orderBy: { reputation: 'desc' },
        });

        if (topClubs.length === 2) {
          let cs = await this.prisma.competition_seasons.findFirst({
            where: { competition_id: 7n, season_id: season.id, country_id: c.id },
          });
          if (!cs) {
            cs = await this.prisma.competition_seasons.create({
              data: {
                competition_id: 7n,
                season_id: season.id,
                country_id: c.id,
                name: `${c.name} Super Cup - ${season.name}`,
                status: 'ACTIVE',
              },
            });
          }

          let stage = await this.prisma.competition_stages.findFirst({
            where: { competition_season_id: cs.id },
          });
          if (!stage) {
            stage = await this.prisma.competition_stages.create({
              data: {
                competition_season_id: cs.id,
                name: 'Chung Kết Siêu Cúp',
                stage_type: 'KNOCKOUT',
                order_no: 1,
                status: 'ACTIVE',
              },
            });
          }

          const matchCount = await this.prisma.matches.count({ where: { competition_season_id: cs.id } });
          if (matchCount === 0 || dto.regenerate) {
            const group = await this.ensureStageGroup(stage.id);
            await this.ensureStageParticipants(stage.id, topClubs, group.id, 'Super Cup Berth');
            const seasonDay = 3; // Cố định Day 3 Siêu Cúp Quốc Gia
            const round = await this.ensureStageRound(stage.id, season, 1, seasonDay, 'Chung kết Siêu Cúp');
            const matchDate = this.getSeasonDate(season, seasonDay);
            const kickoff_time = this.getKickoffTimeFromLocalSlot(
              this.cupLocalKickoffSlots,
              Number(topClubs[0].id + topClubs[1].id),
              clubCountryMap.get(topClubs[0].id.toString()),
            );
            this.reserveMatchDay(teamDailyLoad, seasonDay, topClubs[0].id, topClubs[1].id);
            superCupMatches.push({
              competition_season_id: cs.id,
              stage_id: stage.id,
              round_id: round.id,
              group_id: group.id,
              season_id: season.id,
              season_day: seasonDay,
              match_date: matchDate,
              kickoff_time,
              home_club_id: topClubs[0].id,
              away_club_id: topClubs[1].id,
              stadium_id: stadiumMap.get(topClubs[0].id.toString()) || null,
              status: 'SCHEDULED',
              match_type: 'COMPETITIVE' as any,
              result_type: 'REGULAR' as any,
            });
          }
        }
      }

      if (superCupMatches.length > 0) {
        await this.prisma.matches.createMany({ data: superCupMatches });
        totalSuperCupMatches = superCupMatches.length;
      }
    }

    // =========================================================================
    // 3. CÚP QUỐC GIA (DOMESTIC_CUP - VÒNG 1 KNOCKOUT - DAY 6)
    // =========================================================================
    if (!dto.competitionSeasonId || dto.competitionId === '6') {
      const cupMatches: any[] = [];
      for (const c of countries) {
        let tier4Clubs = await this.prisma.clubs.findMany({
          where: { country_id: c.id, current_competition_id: 4n },
          select: { id: true, name: true, country_id: true, reputation: true },
          orderBy: { id: 'asc' },
        });

        // Fallback nếu chưa gán current_competition_id: lấy 128 CLB có thứ hạng thấp nhất (hạng 113-240)
        if (tier4Clubs.length < 128) {
          tier4Clubs = await this.prisma.clubs.findMany({
            where: { country_id: c.id },
            skip: 112,
            take: 128,
            select: { id: true, name: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          });
        }

        if (tier4Clubs.length >= 2) {
          let cs = await this.prisma.competition_seasons.findFirst({
            where: { competition_id: 6n, season_id: season.id, country_id: c.id },
          });
          if (!cs) {
            cs = await this.prisma.competition_seasons.create({
              data: {
                competition_id: 6n,
                season_id: season.id,
                country_id: c.id,
                name: `${c.name} Cup - ${season.name}`,
                status: 'ACTIVE',
              },
            });
          }

          let stage = await this.prisma.competition_stages.findFirst({
            where: { competition_season_id: cs.id },
          });
          if (!stage) {
            stage = await this.prisma.competition_stages.create({
              data: {
                competition_season_id: cs.id,
                name: 'Cúp Quốc Gia (Knockout Stage)',
                stage_type: 'KNOCKOUT',
                order_no: 1,
                status: 'ACTIVE',
              },
            });
          }

          const matchCount = await this.prisma.matches.count({ where: { competition_season_id: cs.id } });
          if (matchCount === 0 || dto.regenerate) {
            const group = await this.ensureStageGroup(stage.id, 'Main Bracket', 'MAIN', 1);
            await this.ensureStageParticipants(stage.id, tier4Clubs, group.id, 'Domestic Cup Entry');

            // Khởi tạo trước 9 rounds chuẩn Master Calendar cho Cúp Quốc Gia
            const cupRoundsSpec = [
              { roundNo: 1, day: 4, name: 'Vòng 1 (Tier 4)' },
              { roundNo: 2, day: 7, name: 'Vòng 2 (+ Tier 3)' },
              { roundNo: 3, day: 10, name: 'Vòng 3 (+ Tier 2)' },
              { roundNo: 4, day: 13, name: 'Vòng 4 (Tier 1 Xuất Trận - Vòng 64)' },
              { roundNo: 5, day: 16, name: 'Vòng 5 (Vòng 32 Đội)' },
              { roundNo: 6, day: 21, name: 'Vòng 6 (Vòng 1/8)' },
              { roundNo: 7, day: 24, name: 'Vòng 7 (Tứ Kết)' },
              { roundNo: 8, day: 27, name: 'Vòng 8 (Bán Kết)' },
              { roundNo: 9, day: 33, name: 'Vòng 9 (Chung Kết Cúp QG)' },
            ];
            const round1 = await this.ensureStageRound(stage.id, season, 1, 4, 'Vòng 1 (Tier 4)');
            for (let rIdx = 1; rIdx < cupRoundsSpec.length; rIdx++) {
              await this.ensureStageRound(stage.id, season, cupRoundsSpec[rIdx].roundNo, cupRoundsSpec[rIdx].day, cupRoundsSpec[rIdx].name);
            }

            const seasonDay = 4; // Cố định Day 4 cho Vòng 1 Cúp QG (128 CLB Tier 4 -> 64 trận)
            const matchDate = this.getSeasonDate(season, seasonDay);
            const numMatches = Math.floor(tier4Clubs.length / 2);

            for (let i = 0; i < numMatches; i++) {
              const home = tier4Clubs[i];
              const away = tier4Clubs[tier4Clubs.length - 1 - i];
              const kickoff_time = this.getKickoffTimeFromLocalSlot(
                this.cupLocalKickoffSlots,
                i + Number(home.id + away.id),
                clubCountryMap.get(home.id.toString()),
              );
              this.reserveMatchDay(teamDailyLoad, seasonDay, home.id, away.id);
              cupMatches.push({
                competition_season_id: cs.id,
                stage_id: stage.id,
                round_id: round1.id,
                group_id: group.id,
                season_id: season.id,
                season_day: seasonDay,
                match_date: matchDate,
                kickoff_time,
                home_club_id: home.id,
                away_club_id: away.id,
                stadium_id: stadiumMap.get(home.id.toString()) || null,
                status: 'SCHEDULED',
                match_type: 'COMPETITIVE' as any,
                result_type: 'REGULAR' as any,
              });
            }
          }
        }
      }

      if (cupMatches.length > 0) {
        for (let i = 0; i < cupMatches.length; i += BATCH_SIZE) {
          await this.prisma.matches.createMany({ data: cupMatches.slice(i, i + BATCH_SIZE) });
        }
        totalCupMatches = cupMatches.length;
      }
    }

    // =========================================================================
    // 4. VÒNG BẢNG CÚP CHÂU LỤC C1, C2, C3 (6 LƯỢT TRẬN VÒNG BẢNG - DAYS 5, 11, 17, 23, 29, 35)
    // =========================================================================
    if (!dto.countryId && (!dto.competitionSeasonId || ['8', '9', '10'].includes(dto.competitionId || ''))) {
      // Continental Group Stage (6 matchdays): Days [5, 9, 13, 17, 23, 26]
    const contCupDays = [5, 8, 11, 14, 17, 22];
      const contMatches: any[] = [];
      const whereContinentalCS: any = {
        season_id: season.id,
        competitions: {
          competition_type: {
            in: ['CONTINENTAL_CLUB_C1', 'CONTINENTAL_CLUB_C2', 'CONTINENTAL_CLUB_C3'],
          },
        },
      };
      if (dto.competitionId) whereContinentalCS.competition_id = BigInt(dto.competitionId);
      if (dto.competitionSeasonId) whereContinentalCS.id = BigInt(dto.competitionSeasonId);

      const continentalCompSeasons = await this.prisma.competition_seasons.findMany({
        where: whereContinentalCS,
        include: {
          competition_stages: {
            include: {
              stage_groups: { orderBy: { order_no: 'asc' } },
              stage_teams: { where: { status: 'ACTIVE' }, orderBy: { seed: 'asc' } },
            },
          },
        },
      });

      for (const cs of continentalCompSeasons) {
        const stage = cs.competition_stages[0];
        if (!stage) continue;

        const matchCount = await this.prisma.matches.count({ where: { competition_season_id: cs.id } });
        if (matchCount > 0 && !dto.regenerate) continue;

        const groups = stage.stage_groups.length > 0
          ? stage.stage_groups
          : [await this.ensureStageGroup(stage.id)];

        const rounds = new Map<number, any>();
        for (let roundNo = 1; roundNo <= contCupDays.length; roundNo++) {
          const round = await this.ensureStageRound(stage.id, season, roundNo, contCupDays[roundNo - 1], `Lượt ${roundNo}`);
          rounds.set(roundNo, round);
        }

        // Đảm bảo Knockout Stage và các rounds đã được khởi tạo
        let knockoutStage: any = cs.competition_stages.find((s) => s.stage_type === 'KNOCKOUT');
        if (!knockoutStage) {
          knockoutStage = await this.prisma.competition_stages.create({
            data: {
              competition_season_id: cs.id,
              name: 'Knockout Stage',
              stage_type: 'KNOCKOUT',
              order_no: 2,
              status: 'ACTIVE',
            },
          });
        }
        const contKnockoutRoundsSpec = [
          { roundNo: 1, day: 25, name: 'Vòng 1/8 - Lượt Đi' },
          { roundNo: 2, day: 26, name: 'Vòng 1/8 - Lượt Về' },
          { roundNo: 3, day: 28, name: 'Tứ Kết - Lượt Đi' },
          { roundNo: 4, day: 29, name: 'Tứ Kết - Lượt Về' },
          { roundNo: 5, day: 31, name: 'Bán Kết - Lượt Đi' },
          { roundNo: 6, day: 32, name: 'Bán Kết - Lượt Về' },
          { roundNo: 7, day: 34, name: 'Chung Kết Cúp Châu Lục' },
        ];
        for (const r of contKnockoutRoundsSpec) {
          await this.ensureStageRound(knockoutStage.id, season, r.roundNo, r.day, r.name);
        }

        for (const group of groups) {
          const groupClubIds = stage.stage_teams
            .filter((st) => st.group_id === group.id)
            .map((st) => st.club_id)
            .filter((id): id is bigint => id !== null);

          if (groupClubIds.length < 2) continue;

          const pairings = this.generateBergerPairings(groupClubIds);
          for (const p of pairings) {
            const matchDay = contCupDays[p.round - 1] || contCupDays[0];
            const kickoff_time = this.getKickoffTimeFromLocalSlot(
              this.cupLocalKickoffSlots,
              Number(p.home + p.away + BigInt(p.round)),
              clubCountryMap.get(p.home.toString()),
            );
            this.reserveMatchDay(teamDailyLoad, matchDay, p.home, p.away);
            contMatches.push({
              competition_season_id: cs.id,
              stage_id: stage.id,
              round_id: rounds.get(p.round)?.id,
              group_id: group.id,
              season_id: season.id,
              season_day: matchDay,
              match_date: this.getSeasonDate(season, matchDay),
              kickoff_time,
              home_club_id: p.home,
              away_club_id: p.away,
              stadium_id: stadiumMap.get(p.home.toString()) || null,
              status: 'SCHEDULED',
              match_type: 'COMPETITIVE' as any,
              result_type: 'REGULAR' as any,
            });
          }
        }
      }

      if (contMatches.length > 0) {
        for (let i = 0; i < contMatches.length; i += BATCH_SIZE) {
          await this.prisma.matches.createMany({ data: contMatches.slice(i, i + BATCH_SIZE) });
        }
        totalContMatches = contMatches.length;
      }
    }

    // =========================================================================
    // 5. CÚP TRẺ U21 QUỐC NỘI (DOMESTIC_YOUTH_CUP - VÒNG 1 KNOCKOUT - DAY 7)
    // =========================================================================
    if (!dto.competitionSeasonId || dto.competitionId === '13') {
      const youthMatches: any[] = [];
      for (const c of countries) {
        const clubs32 = await this.prisma.clubs.findMany({
          where: { country_id: c.id },
          take: 32,
          orderBy: { id: 'asc' },
        });

        if (clubs32.length >= 32) {
          let cs = await this.prisma.competition_seasons.findFirst({
            where: { competition_id: 13n, season_id: season.id, country_id: c.id },
          });
          if (!cs) {
            cs = await this.prisma.competition_seasons.create({
              data: {
                competition_id: 13n,
                season_id: season.id,
                country_id: c.id,
                name: `${c.name} U21 Cup - ${season.name}`,
                status: 'ACTIVE',
              },
            });
          }

          let stage = await this.prisma.competition_stages.findFirst({
            where: { competition_season_id: cs.id },
          });
          if (!stage) {
            stage = await this.prisma.competition_stages.create({
              data: {
                competition_season_id: cs.id,
                name: 'Vòng 1 (Vòng 32 Đội Trẻ)',
                stage_type: 'KNOCKOUT',
                order_no: 1,
                status: 'ACTIVE',
              },
            });
          }

          const matchCount = await this.prisma.matches.count({ where: { competition_season_id: cs.id } });
          if (matchCount === 0 || dto.regenerate) {
            const group = await this.ensureStageGroup(stage.id);
            await this.ensureStageParticipants(stage.id, clubs32, group.id, 'Youth Cup Entry');
            for (let i = 0; i < 16; i++) {
              const home = clubs32[i];
              const away = clubs32[31 - i];
              const seasonDay = 7; // Cố định Day 7 cho Vòng 1 Cúp Trẻ U21
              const round = await this.ensureStageRound(stage.id, season, 1, seasonDay, 'Vòng 1 (Vòng 32 Đội)');
              const matchDate = this.getSeasonDate(season, seasonDay);
              const kickoff_time = this.getKickoffTimeFromLocalSlot(
                this.youthLocalKickoffSlots,
                i + Number(home.id + away.id),
                clubCountryMap.get(home.id.toString()),
              );
              this.reserveMatchDay(teamDailyLoad, seasonDay, home.id, away.id);
              youthMatches.push({
                competition_season_id: cs.id,
                stage_id: stage.id,
                round_id: round.id,
                group_id: group.id,
                season_id: season.id,
                season_day: seasonDay,
                match_date: matchDate,
                kickoff_time,
                home_club_id: home.id,
                away_club_id: away.id,
                stadium_id: stadiumMap.get(home.id.toString()) || null,
                status: 'SCHEDULED',
                match_type: 'COMPETITIVE' as any,
                result_type: 'REGULAR' as any,
              });
            }
          }
        }
      }

      if (youthMatches.length > 0) {
        for (let i = 0; i < youthMatches.length; i += BATCH_SIZE) {
          await this.prisma.matches.createMany({ data: youthMatches.slice(i, i + BATCH_SIZE) });
        }
        totalYouthMatches = youthMatches.length;
      }
    }

    const grandTotal = totalLeagueMatches + totalSuperCupMatches + totalCupMatches + totalContMatches + totalYouthMatches;

    return {
      message: `Sinh thành công tổng cộng ${grandTotal.toLocaleString()} trận đấu vào Day 1 cho Mùa ${season.season_number}`,
      seasonId: season.id.toString(),
      seasonNumber: season.season_number,
      breakdown: {
        leagueMatches: totalLeagueMatches,
        superCupMatches: totalSuperCupMatches,
        domesticCupMatches: totalCupMatches,
        continentalGroupStageMatches: totalContMatches,
        youthCupMatches: totalYouthMatches,
        totalMatches: grandTotal,
      },
      matchesGenerated: grandTotal,
    };
  }


  async initializeNewSeason(dto: InitializeSeasonDto, continentalQualifications: any[] = []) {
    const worldId = dto.worldId ? BigInt(dto.worldId) : 1n;

    // 1. Lấy mùa giải hiện tại
    const currentSeason = await this.prisma.seasons.findFirst({
      where: { world_id: worldId },
      orderBy: { season_number: 'desc' },
    });

    let targetSeason: any = null;

    if (!currentSeason) {
      // Tạo Season 1 đầu tiên nếu chưa có mùa nào
      targetSeason = await this.prisma.seasons.create({
        data: {
          world_id: worldId,
          name: 'Season 1',
          season_number: 1,
          total_days: 36,
          current_day: 1,
          start_date: new Date(),
          status: 'ACTIVE',
          is_transfer_window_open: true,
        },
      });
    } else if (dto.seasonNumber && dto.seasonNumber > currentSeason.season_number) {
      // Tạo season mới theo yêu cầu số mùa
      targetSeason = await this.prisma.seasons.create({
        data: {
          world_id: worldId,
          name: `Season ${dto.seasonNumber}`,
          season_number: dto.seasonNumber,
          total_days: 36,
          current_day: 1,
          start_date: new Date(currentSeason.start_date.getTime() + 36 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          is_transfer_window_open: true,
        },
      });
    } else {
      targetSeason = currentSeason;
    }

    await this.ensureServerTimeline(worldId, targetSeason);

    // 2. Phân loại giải đấu: Quốc nội (Domestic Tiers 1..5) và Châu lục (Continental C1, C2, C3)
    const domesticComps = await this.prisma.competitions.findMany({
      where: { scope: 'DOMESTIC', competition_type: 'DOMESTIC_LEAGUE', tier: { in: [1, 2, 3, 4, 5] } },
      orderBy: { tier: 'asc' },
    });

    const domesticCupComps = await this.prisma.competitions.findMany({
      where: {
        scope: 'DOMESTIC',
        competition_type: { in: ['DOMESTIC_CUP', 'DOMESTIC_SUPER_CUP', 'DOMESTIC_YOUTH_CUP'] },
      },
      orderBy: { id: 'asc' },
    });

    const continentalComps = await this.prisma.competitions.findMany({
      where: { scope: 'CONTINENTAL' },
      orderBy: { id: 'asc' },
    });

    // Lấy danh sách các quốc gia cần khởi tạo
    const whereCountry: any = {};
    if (dto.countryId) {
      whereCountry.id = BigInt(dto.countryId);
    }
    const countries = await this.prisma.countries.findMany({
      where: whereCountry,
      select: { id: true, name: true, confederation_id: true },
    });

    let activatedCompSeasons = 0;
    let enrolledClubsCount = 0;

    // 2a. Khởi tạo giải Quốc nội cho từng quốc gia
    for (const country of countries) {
      for (const comp of domesticComps) {
        // Tìm hoặc tạo competition_seasons
        let compSeason = await this.prisma.competition_seasons.findFirst({
          where: {
            competition_id: comp.id,
            season_id: targetSeason.id,
            country_id: country.id,
          },
        });

        if (!compSeason) {
          compSeason = await this.prisma.competition_seasons.create({
            data: {
              competition_id: comp.id,
              season_id: targetSeason.id,
              country_id: country.id,
              confederation_id: country.confederation_id,
              name: `${country.name} League ${comp.tier} - ${targetSeason.name}`,
              status: 'ACTIVE',
            },
          });
          activatedCompSeasons++;
        }

        // Tạo stage chính (Regular Season)
        let stage = await this.prisma.competition_stages.findFirst({
          where: { competition_season_id: compSeason.id },
        });
        if (!stage) {
          stage = await this.prisma.competition_stages.create({
            data: {
              competition_season_id: compSeason.id,
              name: 'Regular Season',
              stage_type: 'LEAGUE',
              order_no: 1,
              status: 'ACTIVE',
            },
          });
        }

        // Lấy danh sách CLB thuộc quốc gia này có current_competition_id = comp.id
        const clubs = await this.prisma.clubs.findMany({
          where: {
            country_id: country.id,
            current_competition_id: comp.id,
          },
          select: { id: true, country_id: true, reputation: true },
          orderBy: { reputation: 'desc' },
        });

        if (clubs.length > 0) {
          const tierGroupsCount: { [tier: number]: number } = { 1: 1, 2: 2, 3: 4, 4: 8 };
          const groupsCount = tierGroupsCount[comp.tier] || 1;
          const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

          // Phân bổ CLB đều vào các bảng A, B, C... (mỗi bảng 16 đội)
          const groupsClubs: Array<typeof clubs> = Array.from({ length: groupsCount }, () => []);
          for (let i = 0; i < clubs.length; i++) {
            const roundIdx = Math.floor(i / groupsCount);
            const posInRound = i % groupsCount;
            const gIdx = roundIdx % 2 === 0 ? posInRound : groupsCount - 1 - posInRound;
            groupsClubs[gIdx].push(clubs[i]);
          }

          for (let gIdx = 0; gIdx < groupsCount; gIdx++) {
            const letter = groupLetters[gIdx];
            const groupName = groupsCount > 1 ? `Bảng ${letter}` : 'Main Table';
            const groupCode = groupsCount > 1 ? `GROUP_${letter}` : 'MAIN';
            const group = await this.ensureStageGroup(stage.id, groupName, groupCode, gIdx + 1);

            const thisGroupClubs = groupsClubs[gIdx];
            if (thisGroupClubs.length > 0) {
              enrolledClubsCount += await this.ensureStageParticipants(stage.id, thisGroupClubs, group.id, 'Direct Entry');

              const pairings = this.generateBergerPairings(thisGroupClubs.map((c) => c.id));
              const maxRound = pairings.length > 0 ? Math.max(...pairings.map((p) => p.round)) : 0;
              const roundDays = this.getLeagueRoundDays(thisGroupClubs.length, maxRound);
              for (let roundNo = 1; roundNo <= maxRound; roundNo++) {
                const seasonDay = roundDays[roundNo - 1] || this.leagueSeasonDays[this.leagueSeasonDays.length - 1];
                await this.ensureStageRound(stage.id, targetSeason, roundNo, seasonDay, `Vòng ${roundNo}`);
              }
            }
          }

          // Gán competition_season_qualification_rules bám sát theo thứ hạng châu lục của quốc gia
          await this.assignQualificationRulesForSeason(compSeason.id, comp.id, country.id, country.confederation_id);
        }
      }
    }

    // 2b. Khởi tạo Cúp Quốc nội, Siêu Cúp và Cúp Trẻ cho từng quốc gia
    for (const country of countries) {
      for (const comp of domesticCupComps) {
        let compSeason = await this.prisma.competition_seasons.findFirst({
          where: {
            competition_id: comp.id,
            season_id: targetSeason.id,
            country_id: country.id,
          },
        });

        if (!compSeason) {
          const compName =
            comp.competition_type === 'DOMESTIC_SUPER_CUP'
              ? `${country.name} Super Cup - ${targetSeason.name}`
              : comp.competition_type === 'DOMESTIC_YOUTH_CUP'
                ? `${country.name} U21 Cup - ${targetSeason.name}`
                : `${country.name} Cup - ${targetSeason.name}`;

          compSeason = await this.prisma.competition_seasons.create({
            data: {
              competition_id: comp.id,
              season_id: targetSeason.id,
              country_id: country.id,
              confederation_id: country.confederation_id,
              name: compName,
              status: 'ACTIVE',
            },
          });
          activatedCompSeasons++;
        }

        let stage = await this.prisma.competition_stages.findFirst({
          where: { competition_season_id: compSeason.id },
        });

        if (!stage) {
          const stageName =
            comp.competition_type === 'DOMESTIC_SUPER_CUP'
              ? 'Chung Kết Siêu Cúp'
              : comp.competition_type === 'DOMESTIC_YOUTH_CUP'
                ? 'Vòng 1 (Vòng 32 Đội Trẻ)'
                : 'Vòng 1 (Vòng Loại Trực Tiếp)';

          stage = await this.prisma.competition_stages.create({
            data: {
              competition_season_id: compSeason.id,
              name: stageName,
              stage_type: 'KNOCKOUT',
              order_no: 1,
              status: 'ACTIVE',
            },
          });
        }

        const group = await this.ensureStageGroup(stage.id);
        if (comp.competition_type === 'DOMESTIC_SUPER_CUP') {
          const clubs = await this.prisma.clubs.findMany({
            where: { country_id: country.id, current_competition_id: 1n },
            take: 2,
            select: { id: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          });
          if (clubs.length > 0) {
            enrolledClubsCount += await this.ensureStageParticipants(stage.id, clubs, group.id, 'Super Cup Berth');
            await this.ensureStageRound(stage.id, targetSeason, 1, 3, 'Chung kết');
          }
        } else if (comp.competition_type === 'DOMESTIC_YOUTH_CUP') {
          const clubs = await this.prisma.clubs.findMany({
            where: { country_id: country.id },
            take: 32,
            select: { id: true, country_id: true, reputation: true },
            orderBy: { id: 'asc' },
          });
          if (clubs.length > 0) {
            enrolledClubsCount += await this.ensureStageParticipants(stage.id, clubs, group.id, 'Youth Cup Entry');
            await this.ensureStageRound(stage.id, targetSeason, 1, 7, 'Vòng 1 (Vòng 32 Đội)');
          }
        } else {
          // DOMESTIC_CUP: Đăng ký toàn bộ 240 CLB của quốc gia và khởi tạo đủ 9 rounds chuẩn Master Calendar
          const allClubs = await this.prisma.clubs.findMany({
            where: { country_id: country.id },
            select: { id: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          });
          if (allClubs.length > 0) {
            enrolledClubsCount += await this.ensureStageParticipants(stage.id, allClubs, group.id, 'Domestic Cup Entry');
            const cupRoundsSpec = [
              { roundNo: 1, day: 4, name: 'Vòng 1 (Tier 4)' },
              { roundNo: 2, day: 7, name: 'Vòng 2 (+ Tier 3)' },
              { roundNo: 3, day: 10, name: 'Vòng 3 (+ Tier 2)' },
              { roundNo: 4, day: 13, name: 'Vòng 4 (Tier 1 Xuất Trận - Vòng 64)' },
              { roundNo: 5, day: 16, name: 'Vòng 5 (Vòng 32 Đội)' },
              { roundNo: 6, day: 21, name: 'Vòng 6 (Vòng 1/8)' },
              { roundNo: 7, day: 24, name: 'Vòng 7 (Tứ Kết)' },
              { roundNo: 8, day: 27, name: 'Vòng 8 (Bán Kết)' },
              { roundNo: 9, day: 33, name: 'Vòng 9 (Chung Kết Cúp QG)' },
            ];
            for (const r of cupRoundsSpec) {
              await this.ensureStageRound(stage.id, targetSeason, r.roundNo, r.day, r.name);
            }
          }
        }

        // Gán competition_season_qualification_rules cho Cúp Quốc Gia / Siêu Cúp
        await this.assignQualificationRulesForSeason(compSeason.id, comp.id, country.id, country.confederation_id);
      }
    }

    // 2c. Khởi tạo giải Châu lục (Cúp C1, Cúp C2, Cúp C3) theo từng Châu Lục (Confederations)
    const mainConfederations = await this.prisma.confederations.findMany({
      where: { id: { in: [1n, 2n, 3n, 5n] } },
      orderBy: { id: 'asc' },
    });

    for (const confed of mainConfederations) {
      // Nếu dto.countryId được truyền, chỉ khởi tạo Cúp Châu Lục của liên đoàn chứa quốc gia đó
      if (dto.countryId) {
        const ctry = countries.find((c) => c.id.toString() === dto.countryId);
        if (ctry && ctry.confederation_id !== confed.id) {
          continue;
        }
      }

      for (const comp of continentalComps) {
        const levelName = comp.id === 8n ? 'Champions League' : comp.id === 9n ? 'Cup 2' : comp.id === 10n ? 'Cup 3' : comp.name;
        const cupName = `${confed.name} ${levelName} - ${targetSeason.name}`;

        let compSeason = await this.prisma.competition_seasons.findFirst({
          where: {
            competition_id: comp.id,
            season_id: targetSeason.id,
            confederation_id: confed.id,
          },
        });

        if (!compSeason) {
          compSeason = await this.prisma.competition_seasons.create({
            data: {
              competition_id: comp.id,
              season_id: targetSeason.id,
              country_id: null,
              confederation_id: confed.id,
              name: cupName,
              status: 'ACTIVE',
            },
          });
          activatedCompSeasons++;
        }

        let stage = await this.prisma.competition_stages.findFirst({
          where: { competition_season_id: compSeason.id },
        });
        if (!stage) {
          stage = await this.prisma.competition_stages.create({
            data: {
              competition_season_id: compSeason.id,
              name: 'Group Stage',
              stage_type: 'GROUP',
              order_no: 1,
              status: 'ACTIVE',
            },
          });
        }

        let groups = await this.prisma.stage_groups.findMany({
          where: { stage_id: stage.id },
          orderBy: { order_no: 'asc' },
        });

        if (groups.length === 0) {
          const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let g = 0; g < 8; g++) {
            groups.push(await this.ensureStageGroup(stage.id, `Bảng ${groupLetters[g]}`, `GROUP_${groupLetters[g]}`, g + 1));
          }
        }

        const qualifiedClubIds = continentalQualifications
          .filter((q) => q.targetCompetitionId === comp.id.toString())
          .map((q) => BigInt(q.clubId));

        let candidateClubs = qualifiedClubIds.length > 0
          ? await this.prisma.clubs.findMany({
            where: {
              id: { in: qualifiedClubIds },
              countries: {
                OR: [
                  { confederation_id: confed.id },
                  { confederations_countries_confederation_idToconfederations: { parent_id: confed.id } },
                ],
              },
            },
            take: comp.total_teams > 0 ? comp.total_teams : 32,
            select: { id: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          })
          : [];

        if (candidateClubs.length === 0) {
          candidateClubs = await this.prisma.clubs.findMany({
            where: {
              countries: {
                OR: [
                  { confederation_id: confed.id },
                  { confederations_countries_confederation_idToconfederations: { parent_id: confed.id } },
                ],
              },
              current_competition_id: 1n,
            },
            take: comp.total_teams > 0 ? comp.total_teams : 32,
            select: { id: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          });
        }

        // Gán rule vô địch Cúp Châu Lục
        await this.assignQualificationRulesForSeason(compSeason.id, comp.id, null, confed.id);

        if (candidateClubs.length > 0) {
          // 100% 32 đội vào thẳng 8 bảng đấu (4 đội / bảng), 0 đá sơ loại
          const tournament32Clubs = candidateClubs.slice(0, 32);
          const groupSize = 4;
          for (let g = 0; g < groups.length; g++) {
            const groupClubs = tournament32Clubs.slice(g * groupSize, g * groupSize + groupSize);
            enrolledClubsCount += await this.ensureStageParticipants(
              stage.id,
              groupClubs,
              groups[g].id,
              'Continental Berth',
            );
          }

          // Vòng bảng 6 lượt: Days [5, 8, 11, 14, 17, 22]
          const contGroupDays = [5, 8, 11, 14, 17, 22];
          for (let roundNo = 1; roundNo <= 6; roundNo++) {
            const seasonDay = contGroupDays[roundNo - 1];
            await this.ensureStageRound(stage.id, targetSeason, roundNo, seasonDay, `Lượt ${roundNo}`);
          }

          // Tạo Knockout Stage và 7 rounds loại trực tiếp chuẩn Master Calendar
          let knockoutStage = await this.prisma.competition_stages.findFirst({
            where: { competition_season_id: compSeason.id, stage_type: 'KNOCKOUT' },
          });
          if (!knockoutStage) {
            knockoutStage = await this.prisma.competition_stages.create({
              data: {
                competition_season_id: compSeason.id,
                name: 'Knockout Stage',
                stage_type: 'KNOCKOUT',
                order_no: 2,
                status: 'ACTIVE',
              },
            });
          }
          const contKnockoutRoundsSpec = [
            { roundNo: 1, day: 25, name: 'Vòng 1/8 - Lượt Đi' },
            { roundNo: 2, day: 26, name: 'Vòng 1/8 - Lượt Về' },
            { roundNo: 3, day: 28, name: 'Tứ Kết - Lượt Đi' },
            { roundNo: 4, day: 29, name: 'Tứ Kết - Lượt Về' },
            { roundNo: 5, day: 31, name: 'Bán Kết - Lượt Đi' },
            { roundNo: 6, day: 32, name: 'Bán Kết - Lượt Về' },
            { roundNo: 7, day: 34, name: 'Chung Kết Cúp Châu Lục' },
          ];
          for (const r of contKnockoutRoundsSpec) {
            await this.ensureStageRound(knockoutStage.id, targetSeason, r.roundNo, r.day, r.name);
          }
        }
      }
    }

    // 4. Nếu bật autoGenerateFixtures, tự động sinh lịch thi đấu
    let matchesGenerated = 0;
    if (dto.autoGenerateFixtures !== false) {
      const fixtureRes = await this.generateSeasonFixtures({
        seasonId: targetSeason.id.toString(),
        countryId: dto.countryId,
      });
      matchesGenerated = fixtureRes.matchesGenerated;
    }

    return {
      message: `Khởi tạo thành công Mùa giải ${targetSeason.season_number} (${targetSeason.name})`,
      season: {
        id: targetSeason.id.toString(),
        name: targetSeason.name,
        seasonNumber: targetSeason.season_number,
        startDate: targetSeason.start_date,
        currentDay: targetSeason.current_day,
        totalDays: targetSeason.total_days,
      },
      activatedCompSeasons,
      enrolledClubsCount,
      matchesGenerated,
    };
  }

  /**
   * Xử lý chuyển giao mùa giải (Season Transition Engine):
   * 1. Quét BXH mùa vừa hoàn tất của các giải Tier 1..5
   * 2. Xử lý Thăng hạng / Xuống hạng giữa các Tier (cập nhật clubs.current_competition_id)
   * 3. Phân bổ suất tham dự Cúp C1 / C2 Châu Lục
   * 4. Lão hóa cầu thủ (age + 1) và reset thẻ phạt
   * 5. Khởi tạo Mùa giải mới & sinh lịch thi đấu
   */


  /**
   * Gán các quy tắc thăng hạng, xuống hạng, và phân bổ suất Cúp Châu Lục (competition_qualification_rules)
   * vào competition_season_qualification_rules bám sát theo thứ hạng châu lục của quốc gia.
   */
  async assignQualificationRulesForSeason(
    compSeasonId: bigint,
    competitionId: bigint,
    countryId: bigint | null,
    confedId: bigint | null,
  ): Promise<number> {
    try {
      let applicableRules: any[] = [];

      if (competitionId === 1n && countryId) {
        // Giải VĐQG Tier 1: Lấy rank Hệ số giải VĐQG (LEAGUE_COEFFICIENT)
        const countryRankInfo = await this.prisma.country_rankings.findFirst({
          where: { country_id: countryId, ranking_type: 'LEAGUE_COEFFICIENT' },
          orderBy: { ranking_date: 'desc' },
        });
        const cRank = countryRankInfo?.rank || 1;

        applicableRules = await this.prisma.competition_qualification_rules.findMany({
          where: {
            competition_id: 1n,
            country_rank_min: { lte: cRank },
            country_rank_max: { gte: cRank },
          },
        });
      } else {
        // Các giải Tier 2..5, Cúp Quốc Gia, Siêu Cúp, Cúp C1, C2, C3
        applicableRules = await this.prisma.competition_qualification_rules.findMany({
          where: {
            competition_id: competitionId,
          },
        });
      }

      let count = 0;
      for (const r of applicableRules) {
        await this.prisma.competition_season_qualification_rules.upsert({
          where: {
            competition_season_id_rule_id: {
              competition_season_id: compSeasonId,
              rule_id: r.id,
            },
          },
          update: {},
          create: {
            competition_season_id: compSeasonId,
            rule_id: r.id,
          },
        });
        count++;
      }
      return count;
    } catch (err) {
      console.warn(`[assignQualificationRulesForSeason] compSeasonId=${compSeasonId} error:`, err);
      return 0;
    }
  }

  /**
   * Tính toán số suất tham dự Cúp Châu Lục (C1, C2, C3) cho từng quốc gia
   * dựa trên thứ hạng Hệ số giải VĐQG (LEAGUE_COEFFICIENT) trong liên đoàn châu lục.
   */
  async getContinentalSlotsByCountry(countryId: bigint): Promise<{
    c1: number;
    c2: number;
    c3: number;
    isQualifyingC3: boolean;
    rank: number;
    confedCode: string;
  }> {
    const country = await this.prisma.countries.findUnique({
      where: { id: countryId },
      include: {
        confederations_countries_confederation_idToconfederations: true,
        country_rankings: {
          where: { ranking_type: 'LEAGUE_COEFFICIENT' },
          orderBy: { ranking_date: 'desc' },
          take: 1,
        },
      },
    });

    const confed = country?.confederations_countries_confederation_idToconfederations;
    const confedCode = confed?.code || 'UEFA';
    const rank = country?.country_rankings?.[0]?.rank || 1;

    // LIÊN ĐOÀN 16 QUỐC GIA (AMERICAS: 16 QG, CAF: 16 QG): 4 nhóm hạt giống
    // 32 C1, 32 C2, 32 C3 vào thẳng Vòng Bảng (0 sơ loại)
    if (confedCode === 'AMERICAS' || confedCode === 'CONMEBOL' || confedCode === 'CAF') {
      if (rank <= 4) return { c1: 3, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode };
      if (rank <= 8) return { c1: 2, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode };
      if (rank <= 12) return { c1: 2, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode };
      return { c1: 1, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode };
    }

    // LIÊN ĐOÀN 32 QUỐC GIA (UEFA: 32 QG, AFC: 32 QG)
    // 32 C1, 32 C2, 32 C3 vào thẳng Vòng Bảng (0 sơ loại)
    // Nhóm 1: Top 1-4 (Có đủ 3 C1, 2 C2, 1 C3)
    if (rank <= 4) {
      return { c1: 3, c2: 2, c3: 1, isQualifyingC3: false, rank, confedCode };
    }
    // Nhóm 2: Top 5-10 (Có đủ 2 C1, 2 C2, 1 C3)
    if (rank <= 10) {
      return { c1: 2, c2: 2, c3: 1, isQualifyingC3: false, rank, confedCode };
    }
    // Nhóm 3: Top 11-18 (Có đủ 1 C1, 1 C2, 1 C3)
    if (rank <= 18) {
      return { c1: 1, c2: 1, c3: 1, isQualifyingC3: false, rank, confedCode };
    }
    // Nhóm 4: Top 19-22 (Có 0 C1, 1 C2, 1 C3)
    if (rank <= 22) {
      return { c1: 0, c2: 1, c3: 1, isQualifyingC3: false, rank, confedCode };
    }
    // Nhóm 5: Top 23-32 (Nhà vô địch VĐQG vào thẳng Cúp C3)
    return { c1: 0, c2: 0, c3: 1, isQualifyingC3: false, rank, confedCode };
  }

  // =========================================================================
  // 1. KHÂU THĂNG HẠNG / XUỐNG HẠNG VÀ CẤP VÉ CÚP CHÂU LỤC
  // =========================================================================
  async processPromotionsAndRelegations(completedSeasonId: bigint, countryId?: string) {
    const whereCs: any = {
      season_id: completedSeasonId,
      competitions: {
        scope: 'DOMESTIC',
        tier: { in: [1, 2, 3, 4] },
      },
    };
    if (countryId) {
      whereCs.country_id = BigInt(countryId);
    }

    const domesticCompSeasons = await this.prisma.competition_seasons.findMany({
      where: whereCs,
      include: {
        competitions: true,
        countries: true,
        competition_stages: {
          include: {
            stage_standings: {
              include: { clubs: true },
              orderBy: [
                { points: 'desc' },
                { goal_difference: 'desc' },
                { goals_for: 'desc' },
              ],
            },
          },
        },
      },
      orderBy: [{ country_id: 'asc' }, { competitions: { tier: 'asc' } }],
    });

    const promotions: any[] = [];
    const relegations: any[] = [];
    const continentalQualifications: any[] = [];

    // Nhóm theo quốc gia
    const byCountry: { [countryId: string]: typeof domesticCompSeasons } = {};
    for (const cs of domesticCompSeasons) {
      const cId = cs.country_id ? cs.country_id.toString() : '0';
      if (!byCountry[cId]) byCountry[cId] = [];
      byCountry[cId].push(cs);
    }

    for (const [cId, seasonsList] of Object.entries(byCountry)) {
      const tier1 = seasonsList.find((s) => s.competitions.tier === 1);
      const tier2 = seasonsList.find((s) => s.competitions.tier === 2);
      const tier3 = seasonsList.find((s) => s.competitions.tier === 3);
      const tier4 = seasonsList.find((s) => s.competitions.tier === 4);

      // --- TIER 1: VĐQG ---
      if (tier1) {
        const standings = tier1.competition_stages?.[0]?.stage_standings || [];
        if (standings.length > 0) {
          const countryIdBigInt = BigInt(cId);
          const slots = await this.getContinentalSlotsByCountry(countryIdBigInt);

          let currentPointer = 0;
          if (slots.c1 > 0) {
            const c1Teams = standings.slice(currentPointer, currentPointer + slots.c1);
            c1Teams.forEach((s, idx) => {
              continentalQualifications.push({
                clubId: s.club_id.toString(),
                clubName: s.clubs?.name,
                tier: 1,
                position: currentPointer + idx + 1,
                targetCompetitionId: '8',
                targetCompetitionName: 'Cúp C1 Châu Lục (Champions League)',
                countryRank: slots.rank,
                confedCode: slots.confedCode,
              });
            });
            currentPointer += slots.c1;
          }

          if (slots.c2 > 0) {
            const c2Teams = standings.slice(currentPointer, currentPointer + slots.c2);
            c2Teams.forEach((s, idx) => {
              continentalQualifications.push({
                clubId: s.club_id.toString(),
                clubName: s.clubs?.name,
                tier: 1,
                position: currentPointer + idx + 1,
                targetCompetitionId: '9',
                targetCompetitionName: 'Cúp C2 Châu Lục',
                countryRank: slots.rank,
                confedCode: slots.confedCode,
              });
            });
            currentPointer += slots.c2;
          }

          if (slots.c3 > 0) {
            const c3Teams = standings.slice(currentPointer, currentPointer + slots.c3);
            c3Teams.forEach((s, idx) => {
              continentalQualifications.push({
                clubId: s.club_id.toString(),
                clubName: s.clubs?.name,
                tier: 1,
                position: currentPointer + idx + 1,
                targetCompetitionId: '10',
                targetCompetitionName: slots.isQualifyingC3 ? 'Cúp C3 Châu Lục (Vòng Sơ Loại)' : 'Cúp C3 Châu Lục (Vòng Bảng)',
                isQualifying: slots.isQualifyingC3,
                countryRank: slots.rank,
                confedCode: slots.confedCode,
              });
            });
            currentPointer += slots.c3;
          }

          // Hạng 15, 16 rớt xuống Tier 2 (League 16 đội)
          const relegated = standings.slice(14, 16);
          for (const s of relegated) {
            await this.prisma.clubs.update({
              where: { id: s.club_id },
              data: { current_competition_id: 2n },
            });
            relegations.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              fromTier: 1,
              toTier: 2,
              position: s.position,
            });
          }
        }
      }

      const getTierGroupsStandings = (compSeason: any) => {
        const stage = compSeason?.competition_stages?.[0];
        if (!stage) return [];
        if (stage.stage_groups && stage.stage_groups.length > 0) {
          const list = stage.stage_groups.map((g: any) => g.stage_standings || []).filter((arr: any) => arr.length > 0);
          if (list.length > 0) return list;
        }
        return stage.stage_standings?.length > 0 ? [stage.stage_standings] : [];
      };

      // --- TIER 2: Hạng Nhất (2 bảng A, B) ---
      if (tier2) {
        const groupsStandings = getTierGroupsStandings(tier2);
        for (const standings of groupsStandings) {
          if (standings.length > 0) {
            // Đội Vô Địch bảng thăng hạng lên Tier 1
            const champ = standings[0];
            if (champ) {
              await this.prisma.clubs.update({
                where: { id: champ.club_id },
                data: { current_competition_id: 1n },
              });
              promotions.push({
                clubId: champ.club_id.toString(),
                clubName: champ.clubs?.name,
                fromTier: 2,
                toTier: 1,
                position: 1,
              });
            }

            // 2 đội cuối bảng rớt xuống Tier 3
            const relegated = standings.slice(14, 16);
            for (const s of relegated) {
              await this.prisma.clubs.update({
                where: { id: s.club_id },
                data: { current_competition_id: 3n },
              });
              relegations.push({
                clubId: s.club_id.toString(),
                clubName: s.clubs?.name,
                fromTier: 2,
                toTier: 3,
                position: s.position,
              });
            }
          }
        }
      }

      // --- TIER 3: Hạng Nhì (4 bảng A..D) ---
      if (tier3) {
        const groupsStandings = getTierGroupsStandings(tier3);
        for (const standings of groupsStandings) {
          if (standings.length > 0) {
            // Đội Vô Địch bảng thăng hạng lên Tier 2
            const champ = standings[0];
            if (champ) {
              await this.prisma.clubs.update({
                where: { id: champ.club_id },
                data: { current_competition_id: 2n },
              });
              promotions.push({
                clubId: champ.club_id.toString(),
                clubName: champ.clubs?.name,
                fromTier: 3,
                toTier: 2,
                position: 1,
              });
            }

            // 2 đội cuối bảng rớt xuống Tier 4
            const relegated = standings.slice(14, 16);
            for (const s of relegated) {
              await this.prisma.clubs.update({
                where: { id: s.club_id },
                data: { current_competition_id: 4n },
              });
              relegations.push({
                clubId: s.club_id.toString(),
                clubName: s.clubs?.name,
                fromTier: 3,
                toTier: 4,
                position: s.position,
              });
            }
          }
        }
      }

      // --- TIER 4: Hạng Ba (8 bảng A..H) ---
      if (tier4) {
        const groupsStandings = getTierGroupsStandings(tier4);
        for (const standings of groupsStandings) {
          if (standings.length > 0) {
            // Đội Vô Địch bảng thăng hạng lên Tier 3
            const champ = standings[0];
            if (champ) {
              await this.prisma.clubs.update({
                where: { id: champ.club_id },
                data: { current_competition_id: 3n },
              });
              promotions.push({
                clubId: champ.club_id.toString(),
                clubName: champ.clubs?.name,
                fromTier: 4,
                toTier: 3,
                position: 1,
              });
            }

            // 2 đội cuối bảng rớt xuống phong trào / nghiệp dư
            const relegated = standings.slice(14, 16);
            for (const s of relegated) {
              await this.prisma.clubs.update({
                where: { id: s.club_id },
                data: { current_competition_id: null },
              });
              relegations.push({
                clubId: s.club_id.toString(),
                clubName: s.clubs?.name,
                fromTier: 4,
                toTier: 0,
                position: s.position,
              });
            }
          }
        }
      }


    }

    return {
      promotions,
      relegations,
      continentalQualifications,
      domesticCompSeasons,
    };
  }

  // =========================================================================
  // 2. KHÂU HỢP ĐỒNG CẦU THỦ, CHO MƯỢN & GIẢI NGHỆ (MỤC 1)
  // =========================================================================
  async processContractsAndRetirements(worldId: bigint, completedSeasonId: bigint) {
    let expiredLoansCount = 0;
    let expiredContractsCount = 0;
    let retiredPlayersCount = 0;

    // 1. Cầu thủ hết hạn hợp đồng cho mượn (trả về CLB mẹ parent_club_id)
    const expiredLoanContracts = await this.prisma.player_contracts.findMany({
      where: {
        is_loan_contract: true,
        status: 'ACTIVE',
        end_season_id: { lte: completedSeasonId },
      },
    });

    for (const contract of expiredLoanContracts) {
      await this.prisma.player_contracts.update({
        where: { id: contract.id },
        data: { status: 'EXPIRED', end_date: new Date() },
      });

      if (contract.parent_club_id) {
        await this.prisma.players.update({
          where: { id: contract.player_id },
          data: { current_club_id: contract.parent_club_id },
        });
      }
      expiredLoansCount++;
    }

    // 2. Cầu thủ hết hạn hợp đồng chính thức (chuyển thành tự do)
    const expiredRegularContracts = await this.prisma.player_contracts.findMany({
      where: {
        is_loan_contract: false,
        status: 'ACTIVE',
        end_season_id: { lte: completedSeasonId },
      },
    });

    for (const contract of expiredRegularContracts) {
      await this.prisma.player_contracts.update({
        where: { id: contract.id },
        data: { status: 'EXPIRED', end_date: new Date() },
      });

      await this.prisma.players.update({
        where: { id: contract.player_id },
        data: { current_club_id: null },
      });
      expiredContractsCount++;
    }

    // 3. Cầu thủ giải nghệ do tuổi cao (age >= 38)
    const veteranPlayers = await this.prisma.players.findMany({
      where: {
        world_id: worldId,
        age: { gte: 38 },
        current_club_id: { not: null },
      },
      select: { id: true, age: true },
    });

    for (const p of veteranPlayers) {
      const shouldRetire = p.age >= 40 || Math.random() < 0.4;
      if (shouldRetire) {
        await this.prisma.players.update({
          where: { id: p.id },
          data: { current_club_id: null },
        });

        await this.prisma.player_contracts.updateMany({
          where: { player_id: p.id, status: 'ACTIVE' },
          data: { status: 'TERMINATED', end_date: new Date() },
        });
        retiredPlayersCount++;
      }
    }

    return {
      expiredLoansCount,
      expiredContractsCount,
      retiredPlayersCount,
    };
  }

  // =========================================================================
  // 3. KHÂU XỬ LÝ LỊCH SỬ ÁN TREO GIÒ MÙA CŨ (MỤC 3)
  // =========================================================================
  async cleanPlayerSuspensions(completedSeasonId: bigint) {
    // 1. Reset cờ nhanh cấm thi đấu
    await this.prisma.$executeRaw`
      UPDATE player_status
      SET is_suspended = 0
    `;

    // 2. Chuyển các án phạt cũ / đang active sang EXPIRED
    const result = await this.prisma.player_suspensions.updateMany({
      where: {
        OR: [
          { status: 'ACTIVE' },
          { status: 'PENDING' },
          { competition_seasons: { season_id: completedSeasonId } },
        ],
      },
      data: {
        status: 'EXPIRED',
        end_date: new Date(),
      },
    });

    return {
      expiredSuspensionsCount: result.count,
    };
  }

  // =========================================================================
  // 4. KHÂU TÀI CHÍNH, TIỀN THƯỞNG THÀNH TÍCH & MỤC TIÊU CLB (MỤC 4)
  // =========================================================================
  async distributeSeasonFinancesAndObjectives(
    completedSeason: any,
    nextSeason: any,
    domesticCompSeasons: any[],
  ) {
    let totalPrizesDistributed = 0;
    let clubsRewardedCount = 0;
    let objectivesProcessedCount = 0;

    const defaultCurrency = await this.prisma.currencies.findFirst({
      where: { is_active: true },
      orderBy: { id: 'asc' },
    });
    const currencyId = defaultCurrency?.id || 1n;

    // Định mức tiền thưởng (CASH) theo thứ hạng giải đấu
    const prizeScaleByTier: Record<number, { first: number; second: number; top4: number; rest: number }> = {
      1: { first: 20000000, second: 12000000, top4: 8000000, rest: 2000000 },
      2: { first: 10000000, second: 6000000, top4: 4000000, rest: 1000000 },
      3: { first: 5000000, second: 3000000, top4: 2000000, rest: 500000 },
      4: { first: 2500000, second: 1500000, top4: 1000000, rest: 300000 },
      5: { first: 1000000, second: 600000, top4: 400000, rest: 100000 },
    };

    for (const cs of domesticCompSeasons) {
      const tier = cs.competitions?.tier || 1;
      const standings = cs.competition_stages?.[0]?.stage_standings || [];
      const scale = prizeScaleByTier[tier] || prizeScaleByTier[1];

      // Hệ số tiền thưởng giải Quốc nội biến động theo thứ hạng quốc gia mùa này
      const countryMultiplier = cs.country_id
        ? await this.continentalCoefficientService.getCountryPrizeMultiplier(cs.country_id)
        : 1.0;

      for (let i = 0; i < standings.length; i++) {
        const s = standings[i];
        const rank = i + 1;
        let basePrize = scale.rest;
        if (rank === 1) basePrize = scale.first;
        else if (rank === 2) basePrize = scale.second;
        else if (rank <= 4) basePrize = scale.top4;

        // Tiền thưởng thực tế = Định mức gốc x Hệ số quốc gia
        const prizeAmount = Math.round(basePrize * countryMultiplier);

        if (prizeAmount > 0 && s.club_id) {
          // 1. Đảm bảo financial_accounts cho CLB
          let account = await this.prisma.financial_accounts.findFirst({
            where: { club_id: s.club_id },
          });
          if (!account) {
            account = await this.prisma.financial_accounts.create({
              data: {
                club_id: s.club_id,
                balance_cash: 0,
                balance_gold: 0,
                status: 'ACTIVE',
              },
            });
          }

          // 2. Cộng tiền thưởng và ghi transaction
          await this.prisma.financial_accounts.update({
            where: { id: account.id },
            data: { balance_cash: { increment: prizeAmount } },
          });

          const idempotencyKey = `PRIZE_${account.id}_${completedSeason.id}_${cs.id}_${rank}`;
          try {
            await this.prisma.financial_transactions.create({
              data: {
                club_id: s.club_id,
                financial_account_id: account.id,
                type: 'PRIZE_MONEY',
                category: 'SEASON_REWARDS',
                amount: prizeAmount,
                currency_type: 'CASH',
                reference_type: 'COMPETITION_SEASON',
                reference_id: cs.id,
                season_id: completedSeason.id,
                season_day: completedSeason.total_days || 40,
                description: `Tiền thưởng Hạng ${rank} giải ${cs.name} (Hệ số QG x${countryMultiplier}) - Mùa ${completedSeason.season_number}`,
                transaction_date: new Date(),
                idempotency_key: idempotencyKey,
              },
            });

            await this.prisma.club_bonuses.create({
              data: {
                club_id: s.club_id,
                season_id: completedSeason.id,
                bonus_type: 'SEASON_RANK_PRIZE',
                condition_value: rank,
                amount: prizeAmount,
                currency_id: currencyId,
                status: 'PAID',
              },
            });
          } catch (e) {
            // Bỏ qua nếu trùng idempotency key
          }

          totalPrizesDistributed += prizeAmount;
          clubsRewardedCount++;
        }

        // 3. Đánh giá và khởi tạo mục tiêu CLB (club_objectives)
        const oldObjectives = await this.prisma.club_objectives.findMany({
          where: { club_id: s.club_id, season_id: completedSeason.id, status: 'ACTIVE' },
        });
        for (const obj of oldObjectives) {
          const targetRank = Number(obj.target_value) || 1;
          const isAchieved = rank <= targetRank;
          await this.prisma.club_objectives.update({
            where: { id: obj.id },
            data: { status: isAchieved ? 'ACHIEVED' : 'FAILED' },
          });
          objectivesProcessedCount++;
        }

        // Khởi tạo mục tiêu mùa mới nếu có nextSeason
        if (nextSeason) {
          const nextTargetRank = tier === 1 ? 4 : 2;
          try {
            await this.prisma.club_objectives.create({
              data: {
                club_id: s.club_id,
                season_id: BigInt(nextSeason.id),
                objective_type: tier === 1 ? 'LEAGUE_FINISH_TOP4' : 'LEAGUE_PROMOTION',
                target_value: nextTargetRank,
                reward: tier === 1 ? 5000000 : 3000000,
                status: 'ACTIVE',
              },
            });
          } catch (e) {
            // bỏ qua nếu đã tồn tại
          }
        }
      }
    }

    // Chi trả tiền thưởng Cúp Châu Lục CỐ ĐỊNH 100% (C1, C2, C3 - không nhân hệ số quốc gia)
    const contPrizeResult = await this.continentalCoefficientService.distributeContinentalFixedPrizes(completedSeason);
    totalPrizesDistributed += contPrizeResult.totalContinentalPrizes;
    clubsRewardedCount += contPrizeResult.clubsRewardedCount;

    return {
      totalPrizesDistributed,
      clubsRewardedCount,
      objectivesProcessedCount,
      continentalPrizesDistributed: contPrizeResult.totalContinentalPrizes,
    };
  }

  // =========================================================================
  // 5. KHÂU LỄ TRAO GIẢI VINH DANH DAY 39 & THỐNG KÊ CÁ NHÂN (MỤC 5)
  // =========================================================================
  async processSeasonIndividualAwards(worldId: bigint, completedSeason: any) {
    // 1. Đảm bảo category INDIVIDUAL_SEASON
    let category = await this.prisma.award_categories.findUnique({
      where: { code: 'INDIVIDUAL_SEASON' },
    });
    if (!category) {
      category = await this.prisma.award_categories.create({
        data: {
          code: 'INDIVIDUAL_SEASON',
          name: 'Giải Thưởng Cá Nhân Mùa Giải',
          scope: 'SEASONAL',
          description: 'Các danh hiệu cá nhân xuất sắc nhất mùa giải bóng đá',
        },
      });
    }

    // Danh sách 4 danh hiệu
    const awardDefs = [
      { code: 'GOLDEN_BOOT', name: 'Chiếc Giày Vàng (Vua Phá Lưới)', sortField: 'goals' },
      { code: 'PLAYMAKER_AWARD', name: 'Vua Kiến Tạo (Chân Chuyền Xuất Sắc)', sortField: 'assists' },
      { code: 'GOLDEN_GLOVE', name: 'Găng Tay Vàng (Thủ Môn Xuất Sắc Nhất)', sortField: 'clean_sheets' },
      { code: 'PLAYER_OF_THE_SEASON', name: 'Cầu Thủ Xuất Sắc Nhất Mùa (Ballon d\'Or)', sortField: 'composite' },
    ];

    const awardsGiven: any[] = [];

    // 2. Lấy thống kê của mùa giải completedSeason
    const allStats = await this.prisma.player_statistics.findMany({
      where: { season_id: completedSeason.id },
      include: {
        players: { select: { id: true, first_name: true, last_name: true } },
        clubs: { select: { id: true, name: true } },
      },
    });

    if (allStats.length === 0) {
      return { awardsGiven, message: 'Chưa có dữ liệu thống kê cầu thủ cho mùa này' };
    }

    // Gom dữ liệu tổng theo player_id
    const playerAggMap = new Map<string, {
      playerId: bigint;
      clubId: bigint | null;
      playerName: string;
      clubName: string;
      goals: number;
      assists: number;
      cleanSheets: number;
      appearances: number;
      motm: number;
      avgRating: number;
      compositeScore: number;
    }>();

    for (const stat of allStats) {
      const pId = stat.player_id.toString();
      const ratingNum = Number(stat.average_rating) || 6.0;
      if (!playerAggMap.has(pId)) {
        playerAggMap.set(pId, {
          playerId: stat.player_id,
          clubId: stat.club_id,
          playerName: `${stat.players?.first_name || ''} ${stat.players?.last_name || ''}`.trim() || `Player #${pId}`,
          clubName: stat.clubs?.name || 'Unknown',
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          appearances: 0,
          motm: 0,
          avgRating: 0,
          compositeScore: 0,
        });
      }
      const agg = playerAggMap.get(pId)!;
      agg.goals += stat.goals;
      agg.assists += stat.assists;
      agg.cleanSheets += stat.clean_sheets;
      agg.appearances += stat.appearances;
      agg.motm += stat.motm;
      agg.avgRating = (agg.avgRating + ratingNum) / 2;
    }

    playerAggMap.forEach((agg) => {
      agg.compositeScore = Number(
        (agg.avgRating * 10 + agg.motm * 5 + agg.goals * 2 + agg.assists).toFixed(2),
      );
    });

    const playerList = Array.from(playerAggMap.values());

    for (const def of awardDefs) {
      let award = await this.prisma.awards.findUnique({
        where: { code: def.code },
      });
      if (!award) {
        award = await this.prisma.awards.create({
          data: {
            category_id: category.id,
            code: def.code,
            name: def.name,
            frequency: 'SEASONAL',
          },
        });
      }

      // Tạo award_edition cho mùa giải này
      let edition = await this.prisma.award_editions.findFirst({
        where: { award_id: award.id, season_id: completedSeason.id },
      });
      if (!edition) {
        edition = await this.prisma.award_editions.create({
          data: {
            award_id: award.id,
            season_id: completedSeason.id,
            period_start: completedSeason.start_date || new Date(),
            period_end: new Date(),
            status: 'AWARDED',
          },
        });
      }

      let sorted = [...playerList];
      if (def.sortField === 'goals') {
        sorted = sorted.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals);
      } else if (def.sortField === 'assists') {
        sorted = sorted.filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists);
      } else if (def.sortField === 'clean_sheets') {
        sorted = sorted.filter((p) => p.cleanSheets > 0).sort((a, b) => b.cleanSheets - a.cleanSheets);
      } else {
        sorted = sorted.sort((a, b) => b.compositeScore - a.compositeScore);
      }

      const top3 = sorted.slice(0, 3);
      if (top3.length > 0) {
        for (let r = 0; r < top3.length; r++) {
          const candidate = top3[r];
          const rank = r + 1;
          const scoreVal =
            def.sortField === 'goals'
              ? candidate.goals
              : def.sortField === 'assists'
                ? candidate.assists
                : def.sortField === 'clean_sheets'
                  ? candidate.cleanSheets
                  : candidate.compositeScore;

          try {
            await this.prisma.player_awards.create({
              data: {
                award_edition_id: edition.id,
                player_id: candidate.playerId,
                club_id: candidate.clubId,
                rank,
                score: scoreVal,
                awarded_at: new Date(),
              },
            });

            await this.prisma.award_nominees.create({
              data: {
                award_edition_id: edition.id,
                player_id: candidate.playerId,
                club_id: candidate.clubId,
                rank,
                score: scoreVal,
              },
            });
          } catch (e) {
            // Bỏ qua nếu đã ghi nhận
          }
        }

        const winner = top3[0];
        awardsGiven.push({
          awardCode: def.code,
          awardName: def.name,
          winner: {
            playerId: winner.playerId.toString(),
            playerName: winner.playerName,
            clubName: winner.clubName,
            score:
              def.sortField === 'goals'
                ? `${winner.goals} Bàn thắng`
                : def.sortField === 'assists'
                  ? `${winner.assists} Kiến tạo`
                  : def.sortField === 'clean_sheets'
                    ? `${winner.cleanSheets} Trận sạch lưới`
                    : `${winner.compositeScore} Điểm tổng hợp`,
          },
        });
      }
    }

    return {
      awardsGiven,
      totalAwardsProcessed: awardsGiven.length,
    };
  }

  // =========================================================================
  // HÀM ĐIỀU PHỐI CHÍNH: CHUYỂN GIAO MÙA GIẢI (SEASON TRANSITION ENGINE)
  // =========================================================================
  async processSeasonTransition(dto: ProcessSeasonTransitionDto) {
    const worldId = dto.worldId ? BigInt(dto.worldId) : 1n;

    // 1. Xác định mùa giải cần kết thúc
    let completedSeason: any = null;
    if (dto.completedSeasonId) {
      completedSeason = await this.prisma.seasons.findUnique({
        where: { id: BigInt(dto.completedSeasonId) },
      });
    } else {
      completedSeason = await this.prisma.seasons.findFirst({
        where: { world_id: worldId, status: 'ACTIVE' },
        orderBy: { season_number: 'desc' },
      });
    }

    if (!completedSeason) {
      throw new NotFoundException('Không tìm thấy mùa giải cần chuyển giao');
    }

    const nextSeasonNumber = dto.newSeasonNumber || (completedSeason.season_number + 1);

    // 2. Chốt sổ và cập nhật Rank Quốc Gia mới dựa trên kết quả Cúp Châu Lục mùa vừa qua (UEFA Coefficient Engine)
    let countryRankingUpdate: any = { updatedCountriesCount: 0, topCountriesByConfed: {} };
    try {
      countryRankingUpdate = await this.continentalCoefficientService.updateCountryRankingsForNewSeason(
        worldId,
        completedSeason.id,
      );
    } catch (err) {
      console.warn('[processSeasonTransition] Lỗi cập nhật hệ số quốc gia:', err);
    }

    // 3. Khâu 1: Xử lý Thăng/Xuống hạng và Suất vé Cúp Châu Lục (dùng Rank mới nhất)
    const promoResult = await this.processPromotionsAndRelegations(completedSeason.id, dto.countryId);
    const { promotions, relegations, continentalQualifications, domesticCompSeasons } = promoResult;

    // 4. Khâu 2: Xử lý Hợp đồng cầu thủ, Trả mượn & Giải nghệ (Mục 1)
    let contractResult: any = { expiredLoansCount: 0, expiredContractsCount: 0, retiredPlayersCount: 0 };
    if (dto.processContracts !== false) {
      contractResult = await this.processContractsAndRetirements(worldId, completedSeason.id);
    }

    // 5. Khâu 3: Xử lý Lịch sử Án treo giò (Mục 3)
    let suspensionResult: any = { expiredSuspensionsCount: 0 };
    if (dto.processSuspensions !== false) {
      suspensionResult = await this.cleanPlayerSuspensions(completedSeason.id);
    }

    // 6. Khâu 4: Lão hóa cầu thủ (+1 tuổi)
    let playersAgedCount = 0;
    if (dto.agePlayers !== false) {
      const updateResult = await this.prisma.$executeRaw`
        UPDATE players 
        SET age = age + 1
        WHERE world_id = ${worldId}
      `;
      playersAgedCount = Number(updateResult);
    }

    // 6. Khâu 5: Lễ trao giải cá nhân Day 39 & Vinh danh (Mục 5)
    let awardResult: any = { awardsGiven: [], totalAwardsProcessed: 0 };
    if (dto.processAwards !== false) {
      awardResult = await this.processSeasonIndividualAwards(worldId, completedSeason);
    }

    // 7. Đóng mùa giải cũ
    await this.prisma.seasons.update({
      where: { id: completedSeason.id },
      data: { status: 'COMPLETED' },
    });

    // 8. Khởi tạo Mùa giải mới & Sinh toàn bộ lịch đấu Day 1
    let newSeasonResult: any = null;
    if (dto.initializeNewSeason !== false) {
      newSeasonResult = await this.initializeNewSeason({
        worldId: worldId.toString(),
        seasonNumber: nextSeasonNumber,
        autoGenerateFixtures: true,
        countryId: dto.countryId,
      }, continentalQualifications);

      // Cập nhật ngày thế giới tích lũy
      await this.prisma.$executeRaw`
        UPDATE server_timeline 
        SET world_day = world_day + 1,
            updated_at = NOW()
        WHERE world_id = ${worldId}
      `;
    }

    // 9. Khâu 6: Phân phối Tài chính, Tiền thưởng thứ hạng & Mục tiêu CLB (Mục 4)
    let financeResult: any = { totalPrizesDistributed: 0, clubsRewardedCount: 0, objectivesProcessedCount: 0 };
    if (dto.distributeFinances !== false) {
      financeResult = await this.distributeSeasonFinancesAndObjectives(
        completedSeason,
        newSeasonResult ? newSeasonResult.season : null,
        domesticCompSeasons,
      );
    }

    return {
      success: true,
      message: `Chuyển giao thành công từ Mùa ${completedSeason.season_number} sang Mùa ${nextSeasonNumber}`,
      completedSeason: {
        id: completedSeason.id.toString(),
        name: completedSeason.name,
        seasonNumber: completedSeason.season_number,
      },
      nextSeason: newSeasonResult ? newSeasonResult.season : null,
      summary: `Đã xử lý ${promotions.length} suất thăng hạng, ${relegations.length} suất rớt hạng, ${continentalQualifications.length} suất dự Cúp Châu Lục. Trao ${financeResult.totalPrizesDistributed.toLocaleString()} CASH tiền thưởng cho ${financeResult.clubsRewardedCount} CLB.`,
      countryRankingUpdate,
      promotions,
      relegations,
      continentalQualifications,
      playersAgedCount,
      contractResult,
      suspensionResult,
      financeResult,
      awardResult,
      newSeasonResult,
    };
  }



  /**
   * Tự động kiểm tra và tiến vòng đấu loại trực tiếp (Knockout Stages) cho Cúp Quốc Gia & Cúp Châu Lục
   * Được gọi mỗi khi game world chuyển ngày (advanceDay)
   */
  async progressKnockoutStages(seasonId: bigint, currentSeasonDay: number) {
    const season = await this.prisma.seasons.findUnique({ where: { id: seasonId } });
    if (!season) return { progressedCount: 0 };

    let totalMatchesCreated = 0;
    const countries = await this.prisma.countries.findMany({ select: { id: true, name: true, code: true, continent: true } });
    const clubCountryMap = new Map<string, { code?: string | null; continent?: string | null }>();
    countries.forEach((c) => clubCountryMap.set(c.id.toString(), { code: c.code, continent: c.continent }));

    // =========================================================================
    // 1. TIẾN VÒNG CÚP QUỐC GIA (DOMESTIC_CUP - 9 VÒNG KNOCKOUT)
    // =========================================================================
    const domesticCupSeasons = await this.prisma.competition_seasons.findMany({
      where: {
        season_id: seasonId,
        competitions: { competition_type: 'DOMESTIC_CUP' },
      },
      include: {
        competition_stages: {
          include: {
            stage_rounds: { orderBy: { round_no: 'asc' } },
            stage_groups: true,
          },
        },
      },
    });

    for (const cs of domesticCupSeasons) {
      const stage = cs.competition_stages.find((s) => s.stage_type === 'KNOCKOUT') || cs.competition_stages[0];
      if (!stage || !cs.country_id) continue;
      const group = stage.stage_groups[0] || (await this.ensureStageGroup(stage.id, 'Main Bracket', 'MAIN', 1));
      const countryObj = clubCountryMap.get(cs.country_id.toString());

      // Helper lấy đội thắng của 1 trận knockout đơn
      const getMatchWinnerId = (m: any): bigint | null => {
        if (m.home_score === null || m.away_score === null) return null;
        if (m.home_score > m.away_score) return m.home_club_id;
        if (m.away_score > m.home_score) return m.away_club_id;
        if (m.home_penalty_score !== null && m.away_penalty_score !== null) {
          if (m.home_penalty_score > m.away_penalty_score) return m.home_club_id;
          if (m.away_penalty_score > m.home_penalty_score) return m.away_club_id;
        }
        return m.home_club_id; // Fallback đội nhà đi tiếp
      };

      // Helper tạo trận cho vòng tiếp theo
      const scheduleRoundMatches = async (targetRoundNo: number, targetDay: number, roundName: string, pairedTeams: Array<{ home: bigint; away: bigint }>) => {
        const round = await this.ensureStageRound(stage.id, season, targetRoundNo, targetDay, roundName);
        const matchDate = this.getSeasonDate(season, targetDay);
        const newMatches: any[] = [];

        for (let i = 0; i < pairedTeams.length; i++) {
          const p = pairedTeams[i];
          const kickoff_time = this.getKickoffTimeFromLocalSlot(
            this.cupLocalKickoffSlots,
            i + Number(p.home + p.away),
            countryObj,
          );
          newMatches.push({
            competition_season_id: cs.id,
            stage_id: stage.id,
            round_id: round.id,
            group_id: group.id,
            season_id: season.id,
            season_day: targetDay,
            match_date: matchDate,
            kickoff_time,
            home_club_id: p.home,
            away_club_id: p.away,
            stadium_id: null,
            status: 'SCHEDULED',
            match_type: 'COMPETITIVE' as any,
            result_type: 'REGULAR' as any,
          });
        }
        if (newMatches.length > 0) {
          await this.prisma.matches.createMany({ data: newMatches });
          totalMatchesCreated += newMatches.length;
        }
      };

      // Vòng 1 -> Vòng 2 (Sau Day 4: lấy 64 đội thắng V1 + 64 đội Tier 3 -> 64 trận Day 7)
      if (currentSeasonDay >= 5) {
        const r2Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 7 } });
        if (r2Matches === 0) {
          const r1Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 4 } });
          const r1Completed = r1Matches.filter((m) => m.status === 'COMPLETED');
          if (r1Matches.length > 0 && r1Completed.length === r1Matches.length) {
            const winnersV1 = r1Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            let tier3Clubs = await this.prisma.clubs.findMany({
              where: { country_id: cs.country_id, current_competition_id: 3n },
              select: { id: true },
              orderBy: { id: 'asc' },
            });
            if (tier3Clubs.length < 64) {
              tier3Clubs = await this.prisma.clubs.findMany({
                where: { country_id: cs.country_id },
                skip: 48,
                take: 64,
                select: { id: true },
                orderBy: { reputation: 'desc' },
              });
            }
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            const count = Math.min(winnersV1.length, tier3Clubs.length);
            for (let i = 0; i < count; i++) {
              pairs.push({ home: tier3Clubs[i].id, away: winnersV1[i] });
            }
            await scheduleRoundMatches(2, 7, 'Vòng 2 (+ Tier 3)', pairs);
          }
        }
      }

      // Vòng 2 -> Vòng 3 (Sau Day 7: lấy 64 đội thắng V2 + 32 đội Tier 2 -> 48 trận Day 10)
      if (currentSeasonDay >= 8) {
        const r3Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 10 } });
        if (r3Matches === 0) {
          const r2Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 7 } });
          const r2Completed = r2Matches.filter((m) => m.status === 'COMPLETED');
          if (r2Matches.length > 0 && r2Completed.length === r2Matches.length) {
            const winnersV2 = r2Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            let tier2Clubs = await this.prisma.clubs.findMany({
              where: { country_id: cs.country_id, current_competition_id: 2n },
              select: { id: true },
              orderBy: { id: 'asc' },
            });
            if (tier2Clubs.length < 32) {
              tier2Clubs = await this.prisma.clubs.findMany({
                where: { country_id: cs.country_id },
                skip: 16,
                take: 32,
                select: { id: true },
                orderBy: { reputation: 'desc' },
              });
            }
            const pool = [...tier2Clubs.map((c) => c.id), ...winnersV2];
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            for (let i = 0; i < Math.floor(pool.length / 2); i++) {
              pairs.push({ home: pool[i], away: pool[pool.length - 1 - i] });
            }
            await scheduleRoundMatches(3, 10, 'Vòng 3 (+ Tier 2)', pairs);
          }
        }
      }

      // Vòng 3 -> Vòng 4 (Sau Day 10: lấy 48 đội thắng V3 + 16 đội Tier 1 -> 32 trận Day 13)
      if (currentSeasonDay >= 11) {
        const r4Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 13 } });
        if (r4Matches === 0) {
          const r3Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 10 } });
          const r3Completed = r3Matches.filter((m) => m.status === 'COMPLETED');
          if (r3Matches.length > 0 && r3Completed.length === r3Matches.length) {
            const winnersV3 = r3Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            let tier1Clubs = await this.prisma.clubs.findMany({
              where: { country_id: cs.country_id, current_competition_id: 1n },
              select: { id: true },
              orderBy: { id: 'asc' },
            });
            if (tier1Clubs.length < 16) {
              tier1Clubs = await this.prisma.clubs.findMany({
                where: { country_id: cs.country_id },
                take: 16,
                select: { id: true },
                orderBy: { reputation: 'desc' },
              });
            }
            const pool = [...tier1Clubs.map((c) => c.id), ...winnersV3];
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            for (let i = 0; i < Math.floor(pool.length / 2); i++) {
              pairs.push({ home: pool[i], away: pool[pool.length - 1 - i] });
            }
            await scheduleRoundMatches(4, 13, 'Vòng 4 (Tier 1 Xuất Trận - Vòng 64)', pairs);
          }
        }
      }

      // Vòng 4 -> Vòng 5 (Sau Day 13: 32 đội thắng V4 -> 16 trận Day 16)
      if (currentSeasonDay >= 14) {
        const r5Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 16 } });
        if (r5Matches === 0) {
          const r4Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 13 } });
          const r4Completed = r4Matches.filter((m) => m.status === 'COMPLETED');
          if (r4Matches.length > 0 && r4Completed.length === r4Matches.length) {
            const pool = r4Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            for (let i = 0; i < Math.floor(pool.length / 2); i++) {
              pairs.push({ home: pool[i], away: pool[pool.length - 1 - i] });
            }
            await scheduleRoundMatches(5, 16, 'Vòng 5 (Vòng 32 Đội)', pairs);
          }
        }
      }

      // Vòng 5 -> Vòng 6 (Sau Day 16: 16 đội thắng V5 -> 8 trận Day 21 - Vòng 1/8)
      if (currentSeasonDay >= 17) {
        const r6Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 21 } });
        if (r6Matches === 0) {
          const r5Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 16 } });
          const r5Completed = r5Matches.filter((m) => m.status === 'COMPLETED');
          if (r5Matches.length > 0 && r5Completed.length === r5Matches.length) {
            const pool = r5Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            for (let i = 0; i < Math.floor(pool.length / 2); i++) {
              pairs.push({ home: pool[i], away: pool[pool.length - 1 - i] });
            }
            await scheduleRoundMatches(6, 21, 'Vòng 6 (Vòng 1/8)', pairs);
          }
        }
      }

      // Vòng 6 -> Vòng 7 (Sau Day 21: 8 đội thắng V6 -> 4 trận Day 24 - Tứ Kết)
      if (currentSeasonDay >= 22) {
        const r7Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 24 } });
        if (r7Matches === 0) {
          const r6Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 21 } });
          const r6Completed = r6Matches.filter((m) => m.status === 'COMPLETED');
          if (r6Matches.length > 0 && r6Completed.length === r6Matches.length) {
            const pool = r6Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            for (let i = 0; i < Math.floor(pool.length / 2); i++) {
              pairs.push({ home: pool[i], away: pool[pool.length - 1 - i] });
            }
            await scheduleRoundMatches(7, 24, 'Vòng 7 (Tứ Kết)', pairs);
          }
        }
      }

      // Vòng 7 -> Vòng 8 (Sau Day 24: 4 đội thắng V7 -> 2 trận Day 27 - Bán Kết)
      if (currentSeasonDay >= 25) {
        const r8Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 27 } });
        if (r8Matches === 0) {
          const r7Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 24 } });
          const r7Completed = r7Matches.filter((m) => m.status === 'COMPLETED');
          if (r7Matches.length > 0 && r7Completed.length === r7Matches.length) {
            const pool = r7Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            const pairs: Array<{ home: bigint; away: bigint }> = [];
            for (let i = 0; i < Math.floor(pool.length / 2); i++) {
              pairs.push({ home: pool[i], away: pool[pool.length - 1 - i] });
            }
            await scheduleRoundMatches(8, 27, 'Vòng 8 (Bán Kết)', pairs);
          }
        }
      }

      // Vòng 8 -> Vòng 9 (Sau Day 27: 2 đội thắng V8 -> 1 trận Day 33 - Chung Kết)
      if (currentSeasonDay >= 28) {
        const r9Matches = await this.prisma.matches.count({ where: { competition_season_id: cs.id, season_day: 33 } });
        if (r9Matches === 0) {
          const r8Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, season_day: 27 } });
          const r8Completed = r8Matches.filter((m) => m.status === 'COMPLETED');
          if (r8Matches.length > 0 && r8Completed.length === r8Matches.length) {
            const pool = r8Matches.map(getMatchWinnerId).filter((id): id is bigint => id !== null);
            if (pool.length >= 2) {
              const pairs = [{ home: pool[0], away: pool[1] }];
              await scheduleRoundMatches(9, 33, 'Vòng 9 (Chung Kết Cúp QG)', pairs);
            }
          }
        }
      }
    }

    // =========================================================================
    // 2. TIẾN VÒNG CÚP CHÂU LỤC (CONTINENTAL_CLUB_C1, C2, C3)
    // =========================================================================
    const continentalCompSeasons = await this.prisma.competition_seasons.findMany({
      where: {
        season_id: seasonId,
        competitions: {
          competition_type: { in: ['CONTINENTAL_CLUB_C1', 'CONTINENTAL_CLUB_C2', 'CONTINENTAL_CLUB_C3'] },
        },
      },
      include: {
        competition_stages: {
          include: {
            stage_groups: { orderBy: { order_no: 'asc' } },
            stage_rounds: { orderBy: { round_no: 'asc' } },
          },
        },
      },
    });

    for (const cs of continentalCompSeasons) {
      const groupStage = cs.competition_stages.find((s) => s.stage_type === 'GROUP');
      let knockoutStage: any = cs.competition_stages.find((s) => s.stage_type === 'KNOCKOUT');
      if (!groupStage) continue;

      if (!knockoutStage) {
        knockoutStage = await this.prisma.competition_stages.create({
          data: {
            competition_season_id: cs.id,
            name: 'Knockout Stage',
            stage_type: 'KNOCKOUT',
            order_no: 2,
            status: 'ACTIVE',
          },
        });
      }

      // Helper tính đội thắng sau 2 lượt trận
      const getWinnerOfTwoLegs = (leg1: any, leg2: any): bigint => {
        const teamA = leg1.home_club_id;
        const teamB = leg1.away_club_id;
        // leg1: teamA (home) vs teamB (away)
        // leg2: teamB (home) vs teamA (away)
        const scoreA = (leg1.home_score || 0) + (leg2.away_score || 0);
        const scoreB = (leg1.away_score || 0) + (leg2.home_score || 0);
        if (scoreA > scoreB) return teamA;
        if (scoreB > scoreA) return teamB;
        // Nếu bằng: tính penalty leg 2 hoặc fallback
        if (leg2.home_penalty_score !== null && leg2.away_penalty_score !== null) {
          if (leg2.home_penalty_score > leg2.away_penalty_score) return teamB;
          if (leg2.away_penalty_score > leg2.home_penalty_score) return teamA;
        }
        return teamA;
      };

      // Vòng Bảng -> Vòng 1/8 (Sau Day 22: Nhất và Nhì 8 bảng -> 8 cặp đấu Lượt đi Day 25, Lượt về Day 26)
      if (currentSeasonDay >= 23) {
        const r16Matches = await this.prisma.matches.count({
          where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 25 },
        });
        if (r16Matches === 0) {
          const groupMatches = await this.prisma.matches.findMany({
            where: { competition_season_id: cs.id, stage_id: groupStage.id },
          });
          const allGroupCompleted = groupMatches.length === 96 && groupMatches.every((m) => m.status === 'COMPLETED');
          if (allGroupCompleted) {
            // Tính BXH 8 bảng
            const firstPlaces: bigint[] = [];
            const secondPlaces: bigint[] = [];

            for (const grp of groupStage.stage_groups) {
              const grpMatches = groupMatches.filter((m) => m.group_id === grp.id);
              const table = new Map<string, { clubId: bigint; pts: number; gd: number; gf: number }>();

              grpMatches.forEach((m) => {
                const hId = m.home_club_id.toString();
                const aId = m.away_club_id.toString();
                if (!table.has(hId)) table.set(hId, { clubId: m.home_club_id, pts: 0, gd: 0, gf: 0 });
                if (!table.has(aId)) table.set(aId, { clubId: m.away_club_id, pts: 0, gd: 0, gf: 0 });

                const h = table.get(hId)!;
                const a = table.get(aId)!;
                const hs = m.home_score || 0;
                const as = m.away_score || 0;
                h.gf += hs; a.gf += as;
                h.gd += (hs - as); a.gd += (as - hs);
                if (hs > as) h.pts += 3;
                else if (as > hs) a.pts += 3;
                else { h.pts += 1; a.pts += 1; }
              });

              const sorted = Array.from(table.values()).sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
              if (sorted[0]) firstPlaces.push(sorted[0].clubId);
              if (sorted[1]) secondPlaces.push(sorted[1].clubId);
            }

            if (firstPlaces.length === 8 && secondPlaces.length === 8) {
              const roundLeg1 = await this.ensureStageRound(knockoutStage.id, season, 1, 25, 'Vòng 1/8 - Lượt Đi');
              const roundLeg2 = await this.ensureStageRound(knockoutStage.id, season, 2, 26, 'Vòng 1/8 - Lượt Về');
              const matches16: any[] = [];

              for (let i = 0; i < 8; i++) {
                const firstTeam = firstPlaces[i];
                const secondTeam = secondPlaces[(i + 1) % 8]; // Nhất bảng này gặp Nhì bảng khác
                const kickoff_time = this.getKickoffTimeFromLocalSlot(
                  this.cupLocalKickoffSlots,
                  i + Number(firstTeam + secondTeam),
                );

                // Lượt đi Day 25: Sân đội nhì
                matches16.push({
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: roundLeg1.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 25,
                  match_date: this.getSeasonDate(season, 25),
                  kickoff_time,
                  home_club_id: secondTeam,
                  away_club_id: firstTeam,
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                });

                // Lượt về Day 26: Sân đội nhất
                matches16.push({
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: roundLeg2.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 26,
                  match_date: this.getSeasonDate(season, 26),
                  kickoff_time,
                  home_club_id: firstTeam,
                  away_club_id: secondTeam,
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                });
              }

              await this.prisma.matches.createMany({ data: matches16 });
              totalMatchesCreated += matches16.length;
            }
          }
        }
      }

      // Vòng 1/8 -> Tứ Kết (Sau Day 26: 8 đội thắng -> 4 cặp Lượt đi Day 28, Lượt về Day 29)
      if (currentSeasonDay >= 27) {
        const qfMatches = await this.prisma.matches.count({
          where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 28 },
        });
        if (qfMatches === 0) {
          const leg1Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 25 } });
          const leg2Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 26 } });
          if (leg1Matches.length === 8 && leg2Matches.length === 8 && leg2Matches.every((m) => m.status === 'COMPLETED')) {
            const winners8: bigint[] = [];
            for (let i = 0; i < 8; i++) {
              const l1 = leg1Matches[i];
              const l2 = leg2Matches.find((m) => m.home_club_id === l1.away_club_id && m.away_club_id === l1.home_club_id) || leg2Matches[i];
              winners8.push(getWinnerOfTwoLegs(l1, l2));
            }
            if (winners8.length === 8) {
              const rLeg1 = await this.ensureStageRound(knockoutStage.id, season, 3, 28, 'Tứ Kết - Lượt Đi');
              const rLeg2 = await this.ensureStageRound(knockoutStage.id, season, 4, 29, 'Tứ Kết - Lượt Về');
              const matchesQF: any[] = [];
              for (let i = 0; i < 4; i++) {
                const tA = winners8[i];
                const tB = winners8[7 - i];
                const kickoff_time = this.getKickoffTimeFromLocalSlot(this.cupLocalKickoffSlots, i + Number(tA + tB));
                matchesQF.push({
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: rLeg1.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 28,
                  match_date: this.getSeasonDate(season, 28),
                  kickoff_time,
                  home_club_id: tA,
                  away_club_id: tB,
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                });
                matchesQF.push({
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: rLeg2.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 29,
                  match_date: this.getSeasonDate(season, 29),
                  kickoff_time,
                  home_club_id: tB,
                  away_club_id: tA,
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                });
              }
              await this.prisma.matches.createMany({ data: matchesQF });
              totalMatchesCreated += matchesQF.length;
            }
          }
        }
      }

      // Tứ Kết -> Bán Kết (Sau Day 29: 4 đội thắng -> 2 cặp Lượt đi Day 31, Lượt về Day 32)
      if (currentSeasonDay >= 30) {
        const sfMatches = await this.prisma.matches.count({
          where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 31 },
        });
        if (sfMatches === 0) {
          const leg1Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 28 } });
          const leg2Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 29 } });
          if (leg1Matches.length === 4 && leg2Matches.length === 4 && leg2Matches.every((m) => m.status === 'COMPLETED')) {
            const winners4: bigint[] = [];
            for (let i = 0; i < 4; i++) {
              const l1 = leg1Matches[i];
              const l2 = leg2Matches.find((m) => m.home_club_id === l1.away_club_id && m.away_club_id === l1.home_club_id) || leg2Matches[i];
              winners4.push(getWinnerOfTwoLegs(l1, l2));
            }
            if (winners4.length === 4) {
              const rLeg1 = await this.ensureStageRound(knockoutStage.id, season, 5, 31, 'Bán Kết - Lượt Đi');
              const rLeg2 = await this.ensureStageRound(knockoutStage.id, season, 6, 32, 'Bán Kết - Lượt Về');
              const matchesSF: any[] = [];
              for (let i = 0; i < 2; i++) {
                const tA = winners4[i];
                const tB = winners4[3 - i];
                const kickoff_time = this.getKickoffTimeFromLocalSlot(this.cupLocalKickoffSlots, i + Number(tA + tB));
                matchesSF.push({
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: rLeg1.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 31,
                  match_date: this.getSeasonDate(season, 31),
                  kickoff_time,
                  home_club_id: tA,
                  away_club_id: tB,
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                });
                matchesSF.push({
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: rLeg2.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 32,
                  match_date: this.getSeasonDate(season, 32),
                  kickoff_time,
                  home_club_id: tB,
                  away_club_id: tA,
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                });
              }
              await this.prisma.matches.createMany({ data: matchesSF });
              totalMatchesCreated += matchesSF.length;
            }
          }
        }
      }

      // Bán Kết -> Chung Kết Cúp Châu Lục (Sau Day 32: 2 đội thắng -> 1 trận duy nhất Day 34)
      if (currentSeasonDay >= 33) {
        const finalMatches = await this.prisma.matches.count({
          where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 34 },
        });
        if (finalMatches === 0) {
          const leg1Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 31 } });
          const leg2Matches = await this.prisma.matches.findMany({ where: { competition_season_id: cs.id, stage_id: knockoutStage.id, season_day: 32 } });
          if (leg1Matches.length === 2 && leg2Matches.length === 2 && leg2Matches.every((m) => m.status === 'COMPLETED')) {
            const finalists: bigint[] = [];
            for (let i = 0; i < 2; i++) {
              const l1 = leg1Matches[i];
              const l2 = leg2Matches.find((m) => m.home_club_id === l1.away_club_id && m.away_club_id === l1.home_club_id) || leg2Matches[i];
              finalists.push(getWinnerOfTwoLegs(l1, l2));
            }
            if (finalists.length === 2) {
              const rFinal = await this.ensureStageRound(knockoutStage.id, season, 7, 34, 'Chung Kết Cúp Châu Lục');
              const kickoff_time = this.getKickoffTimeFromLocalSlot(this.cupLocalKickoffSlots, Number(finalists[0] + finalists[1]));
              await this.prisma.matches.create({
                data: {
                  competition_season_id: cs.id,
                  stage_id: knockoutStage.id,
                  round_id: rFinal.id,
                  group_id: null,
                  season_id: season.id,
                  season_day: 34,
                  match_date: this.getSeasonDate(season, 34),
                  kickoff_time,
                  home_club_id: finalists[0],
                  away_club_id: finalists[1],
                  stadium_id: null,
                  status: 'SCHEDULED',
                  match_type: 'COMPETITIVE' as any,
                  result_type: 'REGULAR' as any,
                },
              });
              totalMatchesCreated += 1;
            }
          }
        }
      }
    }

    return { progressedCount: totalMatchesCreated };
  }

  async getKnockoutBracket(competitionId: bigint, seasonId?: bigint, countryId?: string) {
    const comp = await this.prisma.competitions.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, competition_type: true, scope: true },
    });

    if (!comp) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    const isDomestic = comp.scope === 'DOMESTIC';
    const isContinental = comp.scope === 'CONTINENTAL' || comp.scope === 'REGIONAL';

    const whereCs: any = {
      competition_id: competitionId,
      ...(seasonId ? { season_id: seasonId } : {}),
    };

    if (isDomestic && countryId) {
      whereCs.country_id = BigInt(countryId);
    } else if (isContinental && countryId) {
      const country = await this.prisma.countries.findUnique({
        where: { id: BigInt(countryId) },
        select: { confederation_id: true },
      });
      if (country?.confederation_id) {
        whereCs.confederation_id = country.confederation_id;
      }
    }

    let compSeason = await this.prisma.competition_seasons.findFirst({
      where: whereCs,
      include: {
        competition_stages: {
          include: {
            stage_rounds: { orderBy: { round_no: 'asc' } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!compSeason && !seasonId && !isContinental) {
      compSeason = await this.prisma.competition_seasons.findFirst({
        where: { competition_id: competitionId },
        include: {
          competition_stages: {
            include: {
              stage_rounds: { orderBy: { round_no: 'asc' } },
            },
          },
        },
        orderBy: { id: 'desc' },
      });
    }

    if (!compSeason) {
      return {
        competitionId: competitionId.toString(),
        competitionName: comp.name,
        seasonName: 'Mùa giải mới',
        totalMatches: 0,
        rounds: [],
      };
    }

    // Chọn stage phù hợp cho Knockout:
    // Với Continental Cup: chọn stage KNOCKOUT
    // Với Domestic Cup / Super Cup: chọn stage KNOCKOUT
    const knockoutStage = compSeason.competition_stages.find((s) => s.stage_type === 'KNOCKOUT') || compSeason.competition_stages[0];

    const whereMatches: any = { competition_season_id: compSeason.id };
    if (knockoutStage) {
      whereMatches.stage_id = knockoutStage.id;
    }

    const matches = await this.prisma.matches.findMany({
      where: whereMatches,
      include: {
        stage_rounds: true,
        stage_groups: true,
        competition_stages: true,
        clubs_matches_home_club_idToclubs: {
          select: { id: true, name: true, short_name: true, logo_url: true },
        },
        clubs_matches_away_club_idToclubs: {
          select: { id: true, name: true, short_name: true, logo_url: true },
        },
      },
      orderBy: [{ season_day: 'asc' }, { id: 'asc' }],
    });

    const roundMap = new Map<string, { roundName: string; roundOrder: number; seasonDay: number; matches: any[] }>();

    // 1. Khởi tạo trước TẤT CẢ các rounds từ Stage để giao diện render sẵn toàn bộ các vòng sau
    if (knockoutStage && knockoutStage.stage_rounds && knockoutStage.stage_rounds.length > 0) {
      for (const r of knockoutStage.stage_rounds) {
        const roundKey = `${r.id}_${r.name}`;
        roundMap.set(roundKey, {
          roundName: r.name,
          roundOrder: r.round_no,
          seasonDay: r.round_season_day,
          matches: [],
        });
      }
    }

    // 2. Đưa các trận đấu thực tế đã sinh vào từng vòng
    for (const m of matches) {
      const stageName = m.competition_stages?.name || '';
      const roundName = m.stage_rounds?.name || stageName || `Ngày ${m.season_day}`;
      const roundKey = `${m.stage_rounds?.id || m.season_day}_${roundName}`;

      if (!roundMap.has(roundKey)) {
        roundMap.set(roundKey, {
          roundName,
          roundOrder: m.stage_rounds?.round_no ?? m.season_day,
          seasonDay: m.season_day,
          matches: [],
        });
      }

      let winnerClubId: string | null = null;
      if (m.status === 'COMPLETED' && m.home_score !== null && m.away_score !== null) {
        if (m.home_score > m.away_score) {
          winnerClubId = m.home_club_id?.toString() || null;
        } else if (m.away_score > m.home_score) {
          winnerClubId = m.away_club_id?.toString() || null;
        } else if (m.home_penalty_score !== null && m.away_penalty_score !== null) {
          if (m.home_penalty_score > m.away_penalty_score) {
            winnerClubId = m.home_club_id?.toString() || null;
          } else if (m.away_penalty_score > m.home_penalty_score) {
            winnerClubId = m.away_club_id?.toString() || null;
          }
        }
      }

      roundMap.get(roundKey)!.matches.push({
        id: m.id.toString(),
        seasonDay: m.season_day,
        matchDate: m.match_date ? m.match_date.toISOString().split('T')[0] : null,
        kickoffTime: m.kickoff_time ? m.kickoff_time.toISOString().split('T')[1]?.slice(0, 5) || '10:00' : '10:00',
        status: m.status,
        groupName: m.stage_groups?.name || null,
        homeClub: m.clubs_matches_home_club_idToclubs
          ? {
              id: m.clubs_matches_home_club_idToclubs.id.toString(),
              name: m.clubs_matches_home_club_idToclubs.name,
              short_name: m.clubs_matches_home_club_idToclubs.short_name,
              logo_url: m.clubs_matches_home_club_idToclubs.logo_url,
            }
          : { id: '0', name: 'Chờ xác định', short_name: 'TBD', logo_url: null },
        awayClub: m.clubs_matches_away_club_idToclubs
          ? {
              id: m.clubs_matches_away_club_idToclubs.id.toString(),
              name: m.clubs_matches_away_club_idToclubs.name,
              short_name: m.clubs_matches_away_club_idToclubs.short_name,
              logo_url: m.clubs_matches_away_club_idToclubs.logo_url,
            }
          : { id: '0', name: 'Chờ xác định', short_name: 'TBD', logo_url: null },
        homeScore: m.home_score,
        awayScore: m.away_score,
        homePenaltyScore: m.home_penalty_score,
        awayPenaltyScore: m.away_penalty_score,
        resultType: m.result_type,
        winnerClubId,
      });
    }

    // 3. Với các vòng sau chưa đến ngày thi đấu (chưa có trận thật), tạo các cặp đấu placeholder TBD để người dùng thấy rõ toàn bộ nhánh đấu
    const expectedMatchesPerRound: Record<string, number> = {
      // Domestic Cup (240 CLB)
      'Vòng 1 (Tier 4)': 64,
      'Vòng 2 (+ Tier 3)': 64,
      'Vòng 3 (+ Tier 2)': 48,
      'Vòng 4 (Tier 1 Xuất Trận - Vòng 64)': 32,
      'Vòng 5 (Vòng 32 Đội)': 16,
      'Vòng 6 (Vòng 1/8)': 8,
      'Vòng 7 (Tứ Kết)': 4,
      'Vòng 8 (Bán Kết)': 2,
      'Vòng 9 (Chung Kết Cúp QG)': 1,
      // Continental Cup (16 CLB vào Knockout)
      'Vòng 1/8 - Lượt Đi': 8,
      'Vòng 1/8 - Lượt Về': 8,
      'Tứ Kết - Lượt Đi': 4,
      'Tứ Kết - Lượt Về': 4,
      'Bán Kết - Lượt Đi': 2,
      'Bán Kết - Lượt Về': 2,
      'Chung Kết Cúp Châu Lục': 1,
      // Super Cup
      'Chung kết': 1,
      'Chung kết Siêu Cúp': 1,
    };

    for (const [roundKey, roundData] of roundMap.entries()) {
      if (roundData.matches.length === 0) {
        const expectedCount = expectedMatchesPerRound[roundData.roundName] || 4;
        for (let i = 0; i < expectedCount; i++) {
          roundData.matches.push({
            id: `tbd_${roundData.seasonDay}_${i + 1}`,
            seasonDay: roundData.seasonDay,
            matchDate: null,
            kickoffTime: '10:00',
            status: 'SCHEDULED',
            groupName: null,
            homeClub: { id: '0', name: 'Chờ xác định', short_name: 'TBD', logo_url: null },
            awayClub: { id: '0', name: 'Chờ xác định', short_name: 'TBD', logo_url: null },
            homeScore: null,
            awayScore: null,
            homePenaltyScore: null,
            awayPenaltyScore: null,
            resultType: 'REGULAR',
            winnerClubId: null,
          });
        }
      }
    }

    const rounds = Array.from(roundMap.values()).sort((a, b) => a.seasonDay - b.seasonDay || a.roundOrder - b.roundOrder);

    return {
      competitionId: competitionId.toString(),
      competitionName: comp.name,
      seasonName: compSeason.name,
      totalMatches: matches.length,
      rounds,
    };
  }
}