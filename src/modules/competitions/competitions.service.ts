import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompetitions(countryId?: string, tier?: number) {
    const where: any = {};
    if (countryId) where.country_id = BigInt(countryId);
    if (tier) where.tier = Number(tier);

    return this.prisma.competitions.findMany({
      where,
      orderBy: [{ tier: 'asc' }, { id: 'asc' }],
      include: {
        countries: { select: { id: true, name: true, flag_url: true } },
      },
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

  async getStandings(competitionId: bigint, seasonId?: bigint) {
    // Find active competition_season
    const compSeason = await this.prisma.competition_seasons.findFirst({
      where: {
        competition_id: competitionId,
        ...(seasonId ? { season_id: seasonId } : {}),
      },
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

    if (!compSeason || compSeason.competition_stages.length === 0) {
      return { standings: [] };
    }

    const stage = compSeason.competition_stages[0];
    return {
      competitionId: competitionId.toString(),
      stageName: stage.name,
      standings: stage.stage_standings.map((s, idx) => ({
        position: idx + 1,
        club: s.clubs ? {
          id: s.clubs.id.toString(),
          name: s.clubs.name,
          short_name: s.clubs.short_name,
          logo_url: s.clubs.logo_url,
        } : null,
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

  async getTopScorers(competitionId: bigint, limit: number = 10) {
    const l = Math.max(1, Number(limit) || 10);
    const compSeason = await this.prisma.competition_seasons.findFirst({
      where: { competition_id: competitionId },
      orderBy: { id: 'desc' },
    });

    if (!compSeason) return [];

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

    return stats.map((s, idx) => ({
      rank: idx + 1,
      player: s.players ? {
        id: s.players.id.toString(),
        name: `${s.players.first_name} ${s.players.last_name}`.trim(),
        photo_url: s.players.photo_url,
      } : null,
      club: s.clubs ? {
        id: s.clubs.id.toString(),
        name: s.clubs.name,
        logo_url: s.clubs.logo_url,
      } : null,
      goals: s.goals,
      assists: s.assists,
      appearances: s.appearances,
      rating: s.average_rating,
    }));
  }

  async getTopAssists(competitionId: bigint, limit: number = 10) {
    const l = Math.max(1, Number(limit) || 10);
    const compSeason = await this.prisma.competition_seasons.findFirst({
      where: { competition_id: competitionId },
      orderBy: { id: 'desc' },
    });

    if (!compSeason) return [];

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

    return stats.map((s, idx) => ({
      rank: idx + 1,
      player: s.players ? {
        id: s.players.id.toString(),
        name: `${s.players.first_name} ${s.players.last_name}`.trim(),
        photo_url: s.players.photo_url,
      } : null,
      club: s.clubs ? {
        id: s.clubs.id.toString(),
        name: s.clubs.name,
        logo_url: s.clubs.logo_url,
      } : null,
      goals: s.goals,
      assists: s.assists,
      appearances: s.appearances,
      rating: s.average_rating,
    }));
  }

  async getCompetitionTeams(competitionId: bigint, countryId?: string) {
    if (countryId) {
      const clubs = await this.prisma.clubs.findMany({
        where: {
          current_competition_id: competitionId,
          country_id: BigInt(countryId),
        },
        include: {
          stadiums: true,
          cities: true,
          countries: true,
          users: { select: { id: true, username: true } },
        },
        orderBy: { reputation: 'desc' },
      });

      return clubs.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        short_name: c.short_name,
        logo_url: c.logo_url,
        city: c.cities?.name,
        country: c.countries?.name,
        stadium: c.stadiums?.[0] ? {
          name: c.stadiums[0].name,
          capacity: c.stadiums[0].capacity,
        } : null,
        reputation: c.reputation,
        manager: c.users ? { id: c.users.id.toString(), username: c.users.username } : null,
      }));
    }

    const compSeason = await this.prisma.competition_seasons.findFirst({
      where: { competition_id: competitionId },
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
      return stageTeams.map((st) => {
        const c = st.clubs;
        return {
          id: c.id.toString(),
          name: c.name,
          short_name: c.short_name,
          logo_url: c.logo_url,
          city: c.cities?.name,
          country: c.countries?.name,
          stadium: c.stadiums?.[0] ? {
            name: c.stadiums[0].name,
            capacity: c.stadiums[0].capacity,
          } : null,
          reputation: c.reputation,
          manager: c.users ? { id: c.users.id.toString(), username: c.users.username } : null,
        };
      });
    }

    const clubs = await this.prisma.clubs.findMany({
      where: { current_competition_id: competitionId },
      take: 20,
      include: {
        stadiums: true,
        cities: true,
        countries: true,
        users: { select: { id: true, username: true } },
      },
      orderBy: { reputation: 'desc' },
    });

    return clubs.map((c) => ({
      id: c.id.toString(),
      name: c.name,
      short_name: c.short_name,
      logo_url: c.logo_url,
      city: c.cities?.name,
      country: c.countries?.name,
      stadium: c.stadiums?.[0] ? {
        name: c.stadiums[0].name,
        capacity: c.stadiums[0].capacity,
      } : null,
      reputation: c.reputation,
      manager: c.users ? { id: c.users.id.toString(), username: c.users.username } : null,
    }));
  }
}

