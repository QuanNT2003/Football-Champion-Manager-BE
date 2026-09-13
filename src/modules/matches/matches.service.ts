import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatchSimulatorService } from './match-simulator.service';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulator: MatchSimulatorService,
  ) {}

  async getMatches(
    page: number = 1,
    limit: number = 20,
    clubId?: string,
    seasonId?: string,
    seasonDay?: number,
    status?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Number(limit) || 20);
    const skip = (p - 1) * l;
    const where: any = {};

    if (clubId) {
      const cId = BigInt(clubId);
      where.OR = [{ home_club_id: cId }, { away_club_id: cId }];
    }
    if (seasonId) {
      where.season_id = BigInt(seasonId);
    }
    if (seasonDay) {
      where.season_day = Number(seasonDay);
    }
    if (status) {
      where.status = status;
    }

    const [total, matches] = await Promise.all([
      this.prisma.matches.count({ where }),
      this.prisma.matches.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ season_day: 'asc' }, { id: 'asc' }],
        include: {
          clubs_matches_home_club_idToclubs: {
            select: { id: true, name: true, logo_url: true, reputation: true },
          },
          clubs_matches_away_club_idToclubs: {
            select: { id: true, name: true, logo_url: true, reputation: true },
          },
          stadiums: { select: { id: true, name: true, capacity: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: matches.map((m) => ({
        id: m.id.toString(),
        season_day: m.season_day,
        match_date: m.match_date,
        kickoff_time: m.kickoff_time,
        status: m.status,
        homeScore: m.home_score,
        awayScore: m.away_score,
        attendance: m.attendance,
        stadium: m.stadiums?.name,
        homeClub: m.clubs_matches_home_club_idToclubs ? {
          id: m.clubs_matches_home_club_idToclubs.id.toString(),
          name: m.clubs_matches_home_club_idToclubs.name,
          logo_url: m.clubs_matches_home_club_idToclubs.logo_url,
        } : null,
        awayClub: m.clubs_matches_away_club_idToclubs ? {
          id: m.clubs_matches_away_club_idToclubs.id.toString(),
          name: m.clubs_matches_away_club_idToclubs.name,
          logo_url: m.clubs_matches_away_club_idToclubs.logo_url,
        } : null,
      })),
    };
  }

  async getMatchById(matchId: bigint) {
    const match = await this.prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        clubs_matches_home_club_idToclubs: {
          include: { stadiums: true },
        },
        clubs_matches_away_club_idToclubs: true,
        stadiums: true,
        match_events: {
          orderBy: { minute: 'asc' },
          include: {
            players_match_events_player_idToplayers: {
              select: { id: true, first_name: true, last_name: true, photo_url: true },
            },
            players_match_events_related_player_idToplayers: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
        match_lineups: {
          include: {
            match_players: {
              include: {
                players: {
                  select: { id: true, first_name: true, last_name: true, squad_number: true },
                },
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Không tìm thấy trận đấu');
    }

    return {
      id: match.id.toString(),
      status: match.status,
      season_day: match.season_day,
      match_date: match.match_date,
      kickoff_time: match.kickoff_time,
      homeScore: match.home_score,
      awayScore: match.away_score,
      attendance: match.attendance,
      ticketRevenue: match.ticket_revenue,
      stadium: match.stadiums ? {
        id: match.stadiums.id.toString(),
        name: match.stadiums.name,
        capacity: match.stadiums.capacity,
      } : null,
      homeClub: match.clubs_matches_home_club_idToclubs ? {
        id: match.clubs_matches_home_club_idToclubs.id.toString(),
        name: match.clubs_matches_home_club_idToclubs.name,
        logo_url: match.clubs_matches_home_club_idToclubs.logo_url,
      } : null,
      awayClub: match.clubs_matches_away_club_idToclubs ? {
        id: match.clubs_matches_away_club_idToclubs.id.toString(),
        name: match.clubs_matches_away_club_idToclubs.name,
        logo_url: match.clubs_matches_away_club_idToclubs.logo_url,
      } : null,
      events: match.match_events.map((e) => ({
        id: e.id.toString(),
        minute: e.minute,
        eventType: e.event_type,
        clubId: e.club_id?.toString(),
        player: e.players_match_events_player_idToplayers ? {
          id: e.players_match_events_player_idToplayers.id.toString(),
          name: `${e.players_match_events_player_idToplayers.first_name} ${e.players_match_events_player_idToplayers.last_name}`.trim(),
        } : null,
        relatedPlayer: e.players_match_events_related_player_idToplayers ? {
          id: e.players_match_events_related_player_idToplayers.id.toString(),
          name: `${e.players_match_events_related_player_idToplayers.first_name} ${e.players_match_events_related_player_idToplayers.last_name}`.trim(),
        } : null,
        metadata: e.metadata,
      })),
    };
  }

  async simulate(matchId: bigint) {
    return this.simulator.simulateMatch(matchId);
  }
}
