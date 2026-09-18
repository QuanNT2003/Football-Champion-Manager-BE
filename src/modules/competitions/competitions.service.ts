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
  private readonly serverUtcOffset = 7 * 60;
  // 34 match days: First half Day 3-19 (17 days), Mid-season break Day 20-21, Second half Day 22-38 (17 days)
  private readonly leagueSeasonDays = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
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

    // Tier 3..5 (16 teams -> 30 rounds): Rest on Days [6, 14, 25, 33]
    if (totalRounds < baseDays.length) {
      const restDays = new Set<number>([6, 14, 25, 33]);
      const activeDays = baseDays.filter((day) => !restDays.has(day));
      return activeDays.slice(0, totalRounds);
    }

    if (totalRounds === baseDays.length) {
      return baseDays;
    }

    // Double match days strictly scheduled to avoid >2 matches/day with National & Continental Cups:
    // Tier 1 (18 teams -> 34 rounds = (18 - 1) * 2): Thi đấu trọn vẹn 34 ngày, mỗi ngày 1 vòng (0 double day)
    // Tier 2 (20 teams -> 38 rounds = (20 - 1) * 2 = 34 ngày + 4 ngày đá 2 vòng): Days [8, 14, 27, 34]
    let specifiedDoubleDays: number[] = [];
    if (teamCount === 20 || totalRounds === 38) {
      specifiedDoubleDays = [8, 14, 27, 34];
    } else {
      const extraRounds = totalRounds - baseDays.length;
      specifiedDoubleDays = baseDays.slice(-extraRounds);
    }

    const roundDays: number[] = [];
    for (const day of baseDays) {
      roundDays.push(day);
      if (specifiedDoubleDays.includes(day)) {
        roundDays.push(day);
      }
    }

    roundDays.sort((a, b) => a - b);
    return roundDays.slice(0, totalRounds);
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
            stage_teams: { where: { status: 'ACTIVE' }, select: { club_id: true } },
          },
        },
        competitions: { select: { tier: true } },
      },
    });

    const allLeagueMatches: any[] = [];
    for (const cs of leagueCompSeasons) {
      for (const stage of cs.competition_stages) {
        const clubIds = stage.stage_teams
          .map((st) => st.club_id)
          .filter((id): id is bigint => id !== null);

        if (clubIds.length < 2) continue;

        // Bỏ qua nếu đã có trận đấu rồi (trừ khi regenerate)
        if (!dto.regenerate) {
          const matchCount = await this.prisma.matches.count({
            where: { competition_season_id: cs.id, stage_id: stage.id },
          });
          if (matchCount > 0) continue;
        }

        const group = await this.ensureStageGroup(stage.id);
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
            const seasonDay = this.findSchedulableCupDay([3, 4], teamDailyLoad, topClubs[0].id, topClubs[1].id);
            const round = await this.ensureStageRound(stage.id, season, 1, seasonDay, 'Chung kết');
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
        const cupClubs = await this.prisma.clubs.findMany({
          where: { country_id: c.id },
          take: 32,
          orderBy: { reputation: 'desc' },
        });

        if (cupClubs.length >= 2) {
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
                name: 'Vòng 1 (Vòng Loại Trực Tiếp)',
                stage_type: 'KNOCKOUT',
                order_no: 1,
                status: 'ACTIVE',
              },
            });
          }

          const matchCount = await this.prisma.matches.count({ where: { competition_season_id: cs.id } });
          if (matchCount === 0 || dto.regenerate) {
            const group = await this.ensureStageGroup(stage.id);
            await this.ensureStageParticipants(stage.id, cupClubs, group.id, 'Domestic Cup Entry');
            const half = Math.floor(cupClubs.length / 2);
            for (let i = 0; i < half; i++) {
              const home = cupClubs[i];
              const away = cupClubs[cupClubs.length - 1 - i];
              const seasonDay = this.findSchedulableCupDay([6, 8, 10, 12], teamDailyLoad, home.id, away.id);
              const round = await this.ensureStageRound(stage.id, season, 1, seasonDay, 'Vòng 1');
              const matchDate = this.getSeasonDate(season, seasonDay);
              const kickoff_time = this.getKickoffTimeFromLocalSlot(
                this.cupLocalKickoffSlots,
                i + Number(home.id + away.id),
                clubCountryMap.get(home.id.toString()),
              );
              this.reserveMatchDay(teamDailyLoad, seasonDay, home.id, away.id);
              cupMatches.push({
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
    const contCupDays = [5, 9, 13, 17, 23, 26];
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

        for (const group of groups) {
          const groupClubIds = stage.stage_teams
            .filter((st) => st.group_id === group.id)
            .map((st) => st.club_id)
            .filter((id): id is bigint => id !== null);

          if (groupClubIds.length < 2) continue;

          const pairings = this.generateBergerPairings(groupClubIds);
          for (const p of pairings) {
            const preferredDay = contCupDays[p.round - 1] || contCupDays[0];
            const matchDay = this.findSchedulableCupDay(
              [preferredDay, preferredDay + 1].filter((day) => day <= 38),
              teamDailyLoad,
              p.home,
              p.away,
            );
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
              const seasonDay = this.findSchedulableCupDay([7, 9, 12, 14], teamDailyLoad, home.id, away.id);
              const round = await this.ensureStageRound(stage.id, season, 1, seasonDay, 'Vòng 1');
              const matchDate = this.getSeasonDate(season, seasonDay);
              const kickoff_time = this.getKickoffTimeFromLocalSlot(
                this.cupLocalKickoffSlots,
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
          total_days: 40,
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
          total_days: 40,
          current_day: 1,
          start_date: new Date(currentSeason.start_date.getTime() + 40 * 24 * 60 * 60 * 1000),
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

        const group = await this.ensureStageGroup(stage.id);

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
          enrolledClubsCount += await this.ensureStageParticipants(stage.id, clubs, group.id, 'Direct Entry');

          const pairings = this.generateBergerPairings(clubs.map((c) => c.id));
          const maxRound = pairings.length > 0 ? Math.max(...pairings.map((p) => p.round)) : 0;
          const roundDays = this.getLeagueRoundDays(clubs.length, maxRound);
          for (let roundNo = 1; roundNo <= maxRound; roundNo++) {
            const seasonDay = roundDays[roundNo - 1] || this.leagueSeasonDays[this.leagueSeasonDays.length - 1];
            await this.ensureStageRound(stage.id, targetSeason, roundNo, seasonDay, `Vòng ${roundNo}`);
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
        const take =
          comp.competition_type === 'DOMESTIC_SUPER_CUP'
            ? 2
            : comp.competition_type === 'DOMESTIC_YOUTH_CUP'
              ? 32
              : comp.total_teams > 0
                ? comp.total_teams
                : 32;
        const clubs = await this.prisma.clubs.findMany({
          where: {
            country_id: country.id,
            ...(comp.competition_type === 'DOMESTIC_SUPER_CUP' ? { current_competition_id: 1n } : {}),
          },
          take,
          select: { id: true, country_id: true, reputation: true },
          orderBy: comp.competition_type === 'DOMESTIC_YOUTH_CUP' ? { id: 'asc' } : { reputation: 'desc' },
        });

        if (clubs.length > 0) {
          const source =
            comp.competition_type === 'DOMESTIC_SUPER_CUP'
              ? 'Super Cup Berth'
              : comp.competition_type === 'DOMESTIC_YOUTH_CUP'
                ? 'Youth Cup Entry'
                : 'Domestic Cup Entry';
          enrolledClubsCount += await this.ensureStageParticipants(stage.id, clubs, group.id, source);

          const seasonDay =
            comp.competition_type === 'DOMESTIC_SUPER_CUP'
              ? 3
              : comp.competition_type === 'DOMESTIC_YOUTH_CUP'
                ? 7
                : 6;
          const roundName = comp.competition_type === 'DOMESTIC_SUPER_CUP' ? 'Chung kết' : 'Vòng 1';
          await this.ensureStageRound(stage.id, targetSeason, 1, seasonDay, roundName);
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

        // Xử lý Cúp C3 Châu Lục (comp.id === 10n) có vòng Sơ loại cho các quốc gia hạng 23+
        const qualifyingEntries = continentalQualifications.filter(
          (q) => q.targetCompetitionId === '10' && q.isQualifying === true && q.confedCode === confed.code
        );

        if (comp.id === 10n && qualifyingEntries.length > 0) {
          // Tạo Stage Vòng Sơ Loại Cúp C3 (Day 2 & Day 3)
          let qualStage = await this.prisma.competition_stages.findFirst({
            where: { competition_season_id: compSeason.id, stage_type: 'KNOCKOUT' },
          });
          if (!qualStage) {
            qualStage = await this.prisma.competition_stages.create({
              data: {
                competition_season_id: compSeason.id,
                name: 'Vòng Sơ Loại Cúp C3 (Qualifying Play-off)',
                stage_type: 'KNOCKOUT',
                order_no: 1,
                status: 'ACTIVE',
              },
            });
          }

          // Vòng Sơ Loại 1 (Day 2) nếu có trên 20 đội tham dự
          if (qualifyingEntries.length > 20) {
            await this.ensureStageRound(qualStage.id, targetSeason, 1, 2, 'Vòng Sơ Loại 1');
          }
          // Vòng Sơ Loại 2 (Day 3 - Play-off quyết định 10 vé Vòng Bảng)
          await this.ensureStageRound(qualStage.id, targetSeason, 2, 3, 'Vòng Sơ Loại Play-off');

          // Đăng ký các đội sơ loại vào qualStage
          const qualClubs = await this.prisma.clubs.findMany({
            where: { id: { in: qualifyingEntries.map((q) => BigInt(q.clubId)) } },
            select: { id: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          });
          if (qualClubs.length > 0) {
            enrolledClubsCount += await this.ensureStageParticipants(qualStage.id, qualClubs, null, 'C3 Qualifier');
          }
        }

        if (candidateClubs.length > 0) {
          // Đảm bảo tối đa đúng 32 đội bước vào 8 bảng đấu (4 đội / bảng)
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

          // Continental group stage: Days [5, 9, 13, 17, 23, 26]
          const contGroupDays = [5, 9, 13, 17, 23, 26];
          for (let roundNo = 1; roundNo <= 6; roundNo++) {
            const seasonDay = contGroupDays[roundNo - 1];
            await this.ensureStageRound(stage.id, targetSeason, roundNo, seasonDay, `Lượt ${roundNo}`);
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

    // LIÊN ĐOÀN CHÂU MỸ (AMERICAS): 16 quốc gia (4 nhóm hạt giống)
    // 32 C1, 32 C2, 32 C3 vào thẳng Vòng Bảng (0 sơ loại)
    if (confedCode === 'AMERICAS' || confedCode === 'CONMEBOL') {
      if (rank <= 4) return { c1: 3, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode: 'AMERICAS' };
      if (rank <= 8) return { c1: 2, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode: 'AMERICAS' };
      if (rank <= 12) return { c1: 2, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode: 'AMERICAS' };
      return { c1: 1, c2: 2, c3: 2, isQualifyingC3: false, rank, confedCode: 'AMERICAS' };
    }

    // LIÊN ĐOÀN 32 QUỐC GIA (UEFA: 32 QG, AFC: 32 QG, CAF: 32 QG)
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
        tier: { in: [1, 2, 3, 4, 5] },
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
      const tier5 = seasonsList.find((s) => s.competitions.tier === 5);

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

          // Hạng 17, 18 rớt xuống Tier 2
          const relegated = standings.slice(16, 18);
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

      // --- TIER 2: Hạng Nhất ---
      if (tier2) {
        const standings = tier2.competition_stages?.[0]?.stage_standings || [];
        if (standings.length > 0) {
          const promoted = standings.slice(0, 2);
          for (const s of promoted) {
            await this.prisma.clubs.update({
              where: { id: s.club_id },
              data: { current_competition_id: 1n },
            });
            promotions.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              fromTier: 2,
              toTier: 1,
              position: s.position,
            });
          }

          const relegated = standings.slice(18, 20);
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

      // --- TIER 3: Hạng Nhì ---
      if (tier3) {
        const standings = tier3.competition_stages?.[0]?.stage_standings || [];
        if (standings.length > 0) {
          const promoted = standings.slice(0, 2);
          for (const s of promoted) {
            await this.prisma.clubs.update({
              where: { id: s.club_id },
              data: { current_competition_id: 2n },
            });
            promotions.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              fromTier: 3,
              toTier: 2,
              position: s.position,
            });
          }

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

      // --- TIER 4: Hạng Ba ---
      if (tier4) {
        const standings = tier4.competition_stages?.[0]?.stage_standings || [];
        if (standings.length > 0) {
          const promoted = standings.slice(0, 2);
          for (const s of promoted) {
            await this.prisma.clubs.update({
              where: { id: s.club_id },
              data: { current_competition_id: 3n },
            });
            promotions.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              fromTier: 4,
              toTier: 3,
              position: s.position,
            });
          }

          const relegated = standings.slice(14, 16);
          for (const s of relegated) {
            await this.prisma.clubs.update({
              where: { id: s.club_id },
              data: { current_competition_id: 5n },
            });
            relegations.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              fromTier: 4,
              toTier: 5,
              position: s.position,
            });
          }
        }
      }

      // --- TIER 5: Hạng Tư ---
      if (tier5) {
        const standings = tier5.competition_stages?.[0]?.stage_standings || [];
        if (standings.length > 0) {
          const promoted = standings.slice(0, 2);
          for (const s of promoted) {
            await this.prisma.clubs.update({
              where: { id: s.club_id },
              data: { current_competition_id: 4n },
            });
            promotions.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              fromTier: 5,
              toTier: 4,
              position: s.position,
            });
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
      orderBy: { id: 'desc' },
    });

    if (!compSeason && !seasonId && !isContinental) {
      compSeason = await this.prisma.competition_seasons.findFirst({
        where: { competition_id: competitionId },
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

    const matches = await this.prisma.matches.findMany({
      where: { competition_season_id: compSeason.id },
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
        kickoffTime: m.kickoff_time ? m.kickoff_time.toISOString().split('T')[1]?.slice(0, 5) || '20:00' : '20:00',
        status: m.status,
        groupName: m.stage_groups?.name || null,
        homeClub: m.clubs_matches_home_club_idToclubs
          ? {
              id: m.clubs_matches_home_club_idToclubs.id.toString(),
              name: m.clubs_matches_home_club_idToclubs.name,
              short_name: m.clubs_matches_home_club_idToclubs.short_name,
              logo_url: m.clubs_matches_home_club_idToclubs.logo_url,
            }
          : null,
        awayClub: m.clubs_matches_away_club_idToclubs
          ? {
              id: m.clubs_matches_away_club_idToclubs.id.toString(),
              name: m.clubs_matches_away_club_idToclubs.name,
              short_name: m.clubs_matches_away_club_idToclubs.short_name,
              logo_url: m.clubs_matches_away_club_idToclubs.logo_url,
            }
          : null,
        homeScore: m.home_score,
        awayScore: m.away_score,
        homePenaltyScore: m.home_penalty_score,
        awayPenaltyScore: m.away_penalty_score,
        resultType: m.result_type,
        winnerClubId,
      });
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
