import { EngineTeam, EngineTeamResult, PlayerStatistics } from './match-engine';
import { Prisma } from '@prisma/client';

export const scorerEventsQuery = {
  where: { event_type: { in: ['GOAL', 'OWN_GOAL'] } },
  orderBy: { id: 'asc' },
  select: {
    club_id: true, player_id: true, minute: true, event_type: true, metadata: true,
    players_match_events_player_idToplayers: { select: { first_name: true, last_name: true } },
  },
} satisfies Prisma.match_eventsFindManyArgs;

export function matchScorers(events: Prisma.match_eventsGetPayload<{ select: typeof scorerEventsQuery.select }>[]) {
  return (events || []).map(e => {
    const metadata = e.metadata as Record<string, unknown> | null;
    const player = e.players_match_events_player_idToplayers;
    return {
      clubId: e.club_id?.toString() || null, playerId: e.player_id?.toString() || null,
      playerName: player ? `${player.first_name} ${player.last_name}`.trim() : null,
      minute: e.minute, addedTime: Number(metadata?.addedTime || 0),
      ownGoal: e.event_type === 'OWN_GOAL', penalty: metadata?.shotType === 'PENALTY',
    };
  });
}

/** Public reports exclude hidden mentality, balance bonuses, seeds and raw snapshots. */
export function publicEngineLineup(input: EngineTeam, result: EngineTeamResult) {
  return {
    clubId: input.id, squadType: input.squadType, tactic: input.tactic,
    coaches: input.coaches.filter(c => c.id === result.coaching.headCoachId || result.coaching.assistantIds.includes(c.id) ||
      ['FITNESS_COACH', 'GOALKEEPING_COACH', 'PHYSIO'].includes(c.role) && c.squadType === input.squadType)
      .map(c => ({ id: c.id, name: c.name, role: c.role })),
    players: result.players.map(p => ({
      id: p.player.id, name: p.player.name, shirtNumber: p.player.shirtNumber, position: p.finalPosition,
      formationPositionId: p.formationPositionId, role: p.player.role, duty: p.player.duty,
      started: p.player.started, isCaptain: p.player.isCaptain, ...publicPlayerStatistics(p.stats),
    })),
  };
}
export function publicPlayerStatistics(s: PlayerStatistics) {
  const { injuryDays, fatigueEnd, ...publicStats } = s;
  return publicStats;
}
