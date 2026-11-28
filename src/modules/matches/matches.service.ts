import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MatchSimulatorService } from './match-simulator.service';
import { formatKickoffTime } from '@/common/match-schedule';
import { singleMatchWinner } from './match-result.rules';
import { matchScorers, publicEngineLineup, scorerEventsQuery } from './match-report';
import { EngineTeam, EngineTeamResult } from './match-engine';

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
        take: l,
        orderBy: [{ match_date: 'asc' }, { kickoff_time: 'asc' }, { id: 'asc' }],
        include: {
          match_events: scorerEventsQuery,
          competition_seasons: { select: { id: true, name: true } },
          competition_stages: { select: { id: true, name: true } },
          stage_rounds: { select: { id: true, name: true, round_no: true } },
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
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      items: matches.map((m) => ({
        id: m.id.toString(),
        season_day: m.season_day,
        match_date: m.match_date,
        kickoff_time: formatKickoffTime(m.kickoff_time),
        status: m.status,
        competitionSeason: m.competition_seasons ? {
          id: m.competition_seasons.id.toString(),
          name: m.competition_seasons.name,
        } : null,
        stage: m.competition_stages ? {
          id: m.competition_stages.id.toString(),
          name: m.competition_stages.name,
        } : null,
        round: m.stage_rounds ? {
          id: m.stage_rounds.id.toString(),
          name: m.stage_rounds.name,
          round_no: m.stage_rounds.round_no,
        } : null,
        homeScore: m.home_score,
        awayScore: m.away_score,
        scorers: matchScorers(m.match_events),
        homeRegularScore: m.home_regular_score,
        awayRegularScore: m.away_regular_score,
        homeExtraScore: m.home_extra_score,
        awayExtraScore: m.away_extra_score,
        homePenaltyScore: m.home_penalty_score,
        awayPenaltyScore: m.away_penalty_score,
        resultType: m.result_type,
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
        competition_seasons: { select: { id: true, name: true } },
        competition_stages: { select: { id: true, name: true } },
        stage_rounds: { select: { id: true, name: true, round_no: true } },
        clubs_matches_home_club_idToclubs: {
          include: { stadiums: true },
        },
        clubs_matches_away_club_idToclubs: true,
        stadiums: true,
        match_events: {
          orderBy: { id: 'asc' },
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
            formations: { select: { id: true, code: true, name: true,
              formation_positions: { select: { id: true, x: true, y: true } },
            } },
            match_players: {
              orderBy: { id: 'asc' },
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

    const snapshots = match.match_lineups.map(l => {
      const snapshot = l.tactics_snapshot as Record<string, any> | null;
      return { lineup: l, engine: snapshot?.engine };
    });
    const homeEngine = snapshots.find(s => s.lineup.club_id === match.home_club_id)?.engine;
    const awayEngine = snapshots.find(s => s.lineup.club_id === match.away_club_id)?.engine;

    return {
      id: match.id.toString(),
      status: match.status,
      season_day: match.season_day,
      match_date: match.match_date,
      kickoff_time: formatKickoffTime(match.kickoff_time),
      competitionSeason: match.competition_seasons ? {
        id: match.competition_seasons.id.toString(),
        name: match.competition_seasons.name,
      } : null,
      stage: match.competition_stages ? {
        id: match.competition_stages.id.toString(),
        name: match.competition_stages.name,
      } : null,
      round: match.stage_rounds ? {
        id: match.stage_rounds.id.toString(),
        name: match.stage_rounds.name,
        round_no: match.stage_rounds.round_no,
      } : null,
      homeScore: match.home_score,
      awayScore: match.away_score,
      homeRegularScore: match.home_regular_score,
      awayRegularScore: match.away_regular_score,
      homeExtraScore: match.home_extra_score,
      awayExtraScore: match.away_extra_score,
      homePenaltyScore: match.home_penalty_score,
      awayPenaltyScore: match.away_penalty_score,
      resultType: match.result_type,
      winnerClubId: homeEngine ? homeEngine.winnerClubId : singleMatchWinner(match)?.toString() ?? null,
      aggregateHome: homeEngine?.aggregateHome ?? null,
      aggregateAway: homeEngine?.aggregateAway ?? null,
      duration: homeEngine?.duration ?? null,
      ranking: homeEngine?.ranking ?? null,
      motmPlayerId: homeEngine?.motmPlayerId ?? null,
      statistics: { home: homeEngine?.statistics ?? null, away: awayEngine?.statistics ?? null },
      lineups: snapshots.map(({ lineup, engine }) => {
        const input = engine?.input as EngineTeam | undefined;
        const report = input && engine?.coaching && Array.isArray(engine?.playerStatistics) ? publicEngineLineup(input, {
          id: input.id, coaching: engine.coaching, statistics: engine.statistics,
          players: input.players.map(p => {
            const row = lineup.match_players.find(mp => mp.player_id.toString() === p.id);
            return { player: { ...p, role: row?.role || p.role, duty: row?.duty || p.duty, isCaptain: row?.is_captain || false },
              stats: engine.playerStatistics.find(s => s.playerId === p.id),
              finalPosition: row?.position_code || p.position, formationPositionId: row?.formation_position_id?.toString() || null };
          }),
        } as EngineTeamResult) : {
          clubId: lineup.club_id?.toString(), coaches: [],
          players: lineup.match_players.map(p => ({
            id: p.player_id.toString(), name: `${p.players.first_name} ${p.players.last_name}`.trim(),
            shirtNumber: p.shirt_number, position: p.position_code, role: p.role, duty: p.duty,
            started: p.started, isCaptain: p.is_captain, minutes: p.minutes, goals: p.goals,
            assists: p.assists, rating: Number(p.rating), yellowCards: p.yellow_cards, redCards: p.red_cards,
            enteredMinute: p.subbed_in_minute, leftMinute: p.subbed_out_minute,
          })),
        };
        return { id: lineup.id.toString(), ...report,
          players: report.players.map(p => {
            const matchPlayer = lineup.match_players.find(mp => mp.player_id.toString() === p.id);
            const slot = lineup.formations.formation_positions.find(s => s.id === matchPlayer?.formation_position_id);
            return { ...p, coordinates: slot ? { x: Number(slot.x), y: Number(slot.y) } : null };
          }),
          formation: { id: lineup.formations.id.toString(), code: lineup.formations.code, name: lineup.formations.name } };
      }),
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
      events: match.match_events.sort((a, b) => {
        const left = a.metadata as Record<string, any> | null, right = b.metadata as Record<string, any> | null;
        return left?.sequence && right?.sequence ? left.sequence - right.sequence : a.minute - b.minute || (a.id < b.id ? -1 : 1);
      }).map((e) => ({
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
