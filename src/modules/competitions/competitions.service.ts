import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GenerateFixturesDto } from './dto/generate-fixtures.dto';
import { InitializeSeasonDto } from './dto/initialize-season.dto';
import { ProcessSeasonTransitionDto } from './dto/process-season-transition.dto';

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (standings.length > 0) {
      return {
        competitionId: competitionId.toString(),
        stageName: stage?.name || 'Vòng Bảng',
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

    const BATCH_SIZE = 10000;
    let totalLeagueMatches = 0;
    let totalSuperCupMatches = 0;
    let totalCupMatches = 0;
    let totalContMatches = 0;
    let totalYouthMatches = 0;

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
    }

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

        const pairings = this.generateBergerPairings(clubIds);
        const maxRound = Math.max(...pairings.map((p) => p.round));

        for (const p of pairings) {
          const seasonDay = 3 + Math.min(35, Math.floor(((p.round - 1) * 35) / Math.max(1, maxRound - 1)));
          const matchDate = new Date(season.start_date.getTime() + (seasonDay - 1) * 86400000);
          const homeId = p.home;
          const awayId = p.away;
          const sId = stadiumMap.get(homeId.toString()) || null;

          allLeagueMatches.push({
            competition_season_id: cs.id,
            stage_id: stage.id,
            season_id: season.id,
            season_day: seasonDay,
            match_date: matchDate,
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
                name: `Siêu Cúp ${c.name} (${season.name})`,
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
            const matchDate = new Date(season.start_date.getTime() + (3 - 1) * 86400000);
            superCupMatches.push({
              competition_season_id: cs.id,
              stage_id: stage.id,
              season_id: season.id,
              season_day: 3,
              match_date: matchDate,
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
                name: `Cúp Quốc Gia ${c.name} (${season.name})`,
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
            const matchDate = new Date(season.start_date.getTime() + (6 - 1) * 86400000);
            const half = Math.floor(cupClubs.length / 2);
            for (let i = 0; i < half; i++) {
              const home = cupClubs[i];
              const away = cupClubs[cupClubs.length - 1 - i];
              cupMatches.push({
                competition_season_id: cs.id,
                stage_id: stage.id,
                season_id: season.id,
                season_day: 6,
                match_date: matchDate,
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
      const contCupIds = [8n, 9n, 10n];
      const contCupNames: Record<string, string> = { '8': 'Cúp C1 Châu Lục', '9': 'Cúp C2 Châu Lục', '10': 'Cúp C3 Châu Lục' };
      const contCupDays = [5, 11, 17, 23, 29, 35];
      const contMatches: any[] = [];

      for (const cupId of contCupIds) {
        if (dto.competitionId && BigInt(dto.competitionId) !== cupId) continue;

        const offset = (Number(cupId) - 8) * 32;
        const topClubs = await this.prisma.clubs.findMany({
          skip: offset,
          take: 32,
          orderBy: { ranking_points: 'desc' },
        });

        if (topClubs.length === 32) {
          let cs = await this.prisma.competition_seasons.findFirst({
            where: { competition_id: cupId, season_id: season.id },
          });
          if (!cs) {
            cs = await this.prisma.competition_seasons.create({
              data: {
                competition_id: cupId,
                season_id: season.id,
                name: `${contCupNames[cupId.toString()]} (${season.name})`,
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
                name: 'Vòng Bảng (Group Stage)',
                stage_type: 'GROUP',
                order_no: 1,
                status: 'ACTIVE',
              },
            });
          }

          let groups = await this.prisma.stage_groups.findMany({ where: { stage_id: stage.id } });
          if (groups.length === 0) {
            const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            for (let g = 0; g < 8; g++) {
              await this.prisma.stage_groups.create({
                data: {
                  stage_id: stage.id,
                  name: `Bảng ${groupLetters[g]}`,
                  code: `GROUP_${groupLetters[g]}`,
                  order_no: g + 1,
                },
              });
            }
            groups = await this.prisma.stage_groups.findMany({ where: { stage_id: stage.id }, orderBy: { order_no: 'asc' } });
          }

          const matchCount = await this.prisma.matches.count({ where: { competition_season_id: cs.id } });
          if (matchCount === 0 || dto.regenerate) {
            for (let g = 0; g < 8; g++) {
              const grp = groups[g];
              const grpClubs = topClubs.slice(g * 4, g * 4 + 4).map((c) => c.id);
              const pairings = this.generateBergerPairings(grpClubs);

              for (const p of pairings) {
                const matchDay = contCupDays[p.round - 1] || 5;
                const matchDate = new Date(season.start_date.getTime() + (matchDay - 1) * 86400000);
                contMatches.push({
                  competition_season_id: cs.id,
                  stage_id: stage.id,
                  group_id: grp.id,
                  season_id: season.id,
                  season_day: matchDay,
                  match_date: matchDate,
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
        }
      }

      if (contMatches.length > 0) {
        await this.prisma.matches.createMany({ data: contMatches });
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
                name: `Cúp Trẻ U21 ${c.name} (${season.name})`,
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
            const matchDate = new Date(season.start_date.getTime() + (7 - 1) * 86400000);
            for (let i = 0; i < 16; i++) {
              const home = clubs32[i];
              const away = clubs32[31 - i];
              youthMatches.push({
                competition_season_id: cs.id,
                stage_id: stage.id,
                season_id: season.id,
                season_day: 7,
                match_date: matchDate,
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


  async initializeNewSeason(dto: InitializeSeasonDto) {
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

    // 2. Phân loại giải đấu: Quốc nội (Domestic Tiers 1..5) và Châu lục (Continental C1, C2)
    const domesticComps = await this.prisma.competitions.findMany({
      where: { scope: 'DOMESTIC', tier: { in: [1, 2, 3, 4, 5] } },
      orderBy: { tier: 'asc' },
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
              name: `${country.name} Tier ${comp.tier} - ${targetSeason.name}`,
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

        // Kiểm tra stage_teams
        const existingTeamsCount = await this.prisma.stage_teams.count({
          where: { stage_id: stage.id },
        });

        if (existingTeamsCount === 0) {
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
            const teamData = clubs.map((c, idx) => ({
              stage_id: stage.id,
              club_id: c.id,
              country_id: c.country_id,
              seed: idx + 1,
              status: 'ACTIVE',
              qualification_source: 'Direct Entry',
            }));
            await this.prisma.stage_teams.createMany({ data: teamData });

            const standingData = clubs.map((c, idx) => ({
              stage_id: stage.id,
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
            }));
            await this.prisma.stage_standings.createMany({ data: standingData });
            enrolledClubsCount += clubs.length;
          }
        }
      }
    }

    // 2b. Khởi tạo giải Châu lục (Cúp C1, Cúp C2, Cúp C3) theo từng Châu Lục (Confederations)
    const mainConfederations = await this.prisma.confederations.findMany({
      where: { parent_id: null },
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
        let cupName = `${comp.name} (${confed.code}) - ${targetSeason.name}`;
        if (confed.code === 'AFC') {
          if (comp.id === 8n) cupName = `Cúp C1 Châu Á - AFC Champions League Elite (${targetSeason.name})`;
          else if (comp.id === 9n) cupName = `Cúp C2 Châu Á - AFC Champions League Two (${targetSeason.name})`;
          else if (comp.id === 10n) cupName = `Cúp C3 Châu Á - AFC Challenge League (${targetSeason.name})`;
        } else if (confed.code === 'UEFA') {
          if (comp.id === 8n) cupName = `Cúp C1 Châu Âu - UEFA Champions League (${targetSeason.name})`;
          else if (comp.id === 9n) cupName = `Cúp C2 Châu Âu - UEFA Europa League (${targetSeason.name})`;
          else if (comp.id === 10n) cupName = `Cúp C3 Châu Âu - UEFA Conference League (${targetSeason.name})`;
        } else if (confed.code === 'CONMEBOL') {
          if (comp.id === 8n) cupName = `Cúp C1 Nam Mỹ - Copa Libertadores (${targetSeason.name})`;
          else if (comp.id === 9n) cupName = `Cúp C2 Nam Mỹ - Copa Sudamericana (${targetSeason.name})`;
        } else {
          cupName = `${confed.code} ${comp.name} (${targetSeason.name})`;
        }

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

        const existingTeamsCount = await this.prisma.stage_teams.count({
          where: { stage_id: stage.id },
        });

        if (existingTeamsCount === 0) {
          const candidateClubs = await this.prisma.clubs.findMany({
            where: {
              countries: {
                OR: [
                  { confederation_id: confed.id },
                  { confederations_countries_confederation_idToconfederations: { parent_id: confed.id } },
                ],
              },
              current_competition_id: 1n, // Ưu tiên các CLB hàng đầu Tier 1 trong châu lục
            },
            take: comp.total_teams > 0 ? comp.total_teams : 32,
            select: { id: true, country_id: true, reputation: true },
            orderBy: { reputation: 'desc' },
          });

          if (candidateClubs.length > 0) {
            const teamData = candidateClubs.map((c, idx) => ({
              stage_id: stage.id,
              club_id: c.id,
              country_id: c.country_id,
              seed: idx + 1,
              status: 'ACTIVE',
              qualification_source: 'Continental Berth',
            }));
            await this.prisma.stage_teams.createMany({ data: teamData });

            const standingData = candidateClubs.map((c, idx) => ({
              stage_id: stage.id,
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
            }));
            await this.prisma.stage_standings.createMany({ data: standingData });
            enrolledClubsCount += candidateClubs.length;
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

    // 2. Tìm tất cả các giải đấu quốc nội của mùa vừa hoàn tất
    const whereCs: any = {
      season_id: completedSeason.id,
      competitions: {
        scope: 'DOMESTIC',
        tier: { in: [1, 2, 3, 4, 5] },
      },
    };
    if (dto.countryId) {
      whereCs.country_id = BigInt(dto.countryId);
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

    // 3. Xử lý Thăng/Xuống hạng và Suất C1/C2 cho từng quốc gia
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
          // Top 1-3 đi Cúp C1 Châu Lục
          standings.slice(0, 3).forEach((s, idx) => {
            continentalQualifications.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              tier: 1,
              position: idx + 1,
              targetCompetitionId: '8',
              targetCompetitionName: 'Cúp C1 Châu Lục (Champions League)',
            });
          });

          // Top 4-5 đi Cúp C2 Châu Lục
          standings.slice(3, 5).forEach((s, idx) => {
            continentalQualifications.push({
              clubId: s.club_id.toString(),
              clubName: s.clubs?.name,
              tier: 1,
              position: idx + 4,
              targetCompetitionId: '9',
              targetCompetitionName: 'Cúp C2 Châu Lục',
            });
          });

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
          // Top 1, 2 thăng lên Tier 1
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

          // Hạng 19, 20 rớt xuống Tier 3
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
          // Top 1, 2 thăng lên Tier 2
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

          // Hạng 15, 16 rớt xuống Tier 4
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
          // Top 1, 2 thăng lên Tier 3
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

          // Hạng 15, 16 rớt xuống Tier 5
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
          // Top 1, 2 thăng lên Tier 4
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

    // 4. Lão hóa cầu thủ (+1 tuổi) & reset thẻ phạt
    let playersAgedCount = 0;
    if (dto.agePlayers !== false) {
      const updateResult = await this.prisma.$executeRaw`
        UPDATE players 
        SET age = age + 1
        WHERE world_id = ${worldId}
      `;
      playersAgedCount = Number(updateResult);

      // Reset thẻ phạt tích lũy mùa cũ
      await this.prisma.$executeRaw`
        UPDATE player_status
        SET is_suspended = 0
      `;
    }

    // 5. Đóng mùa cũ
    await this.prisma.seasons.update({
      where: { id: completedSeason.id },
      data: { status: 'COMPLETED' },
    });

    // 6. Khởi tạo Mùa giải mới nếu được bật
    let newSeasonResult: any = null;
    if (dto.initializeNewSeason !== false) {
      newSeasonResult = await this.initializeNewSeason({
        worldId: worldId.toString(),
        seasonNumber: nextSeasonNumber,
        autoGenerateFixtures: true,
        countryId: dto.countryId,
      });

      // Cập nhật server_timeline sang Mùa mới, Day 1
      const newSeasonId = BigInt(newSeasonResult.season.id);
      await this.prisma.$executeRaw`
        UPDATE server_timeline 
        SET season_id = ${newSeasonId},
            season_number = ${nextSeasonNumber},
            season_day = 1,
            world_day = world_day + 1,
            real_date = DATE_ADD(real_date, INTERVAL 1 DAY),
            season_status = 'IN_PROGRESS',
            updated_at = NOW()
        WHERE world_id = ${worldId}
      `;
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
      summary: `Đã xử lý ${promotions.length} suất thăng hạng, ${relegations.length} suất rớt hạng, ${continentalQualifications.length} suất dự Cúp Châu Lục.`,
      promotions,
      relegations,
      continentalQualifications,
      playersAgedCount,
      newSeasonResult,
    };
  }

}
