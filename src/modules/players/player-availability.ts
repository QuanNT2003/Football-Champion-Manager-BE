import { Prisma } from '@prisma/client';
import { banAppliesToMatch, DisciplineMatch, suspensionCompetition, suspensionScope } from './discipline-scope';
import { YellowCardAccumulation, yellowCardsApplyToMatch } from './player-yellow-cards';

/** Fetch remaining restrictions together with the roster, without a query per player. */
export const playerAvailabilityInclude = {
  player_status: true,
  injuries: {
    where: { status: { in: ['ACTIVE', 'RECOVERING'] }, days_remaining: { gt: 0 } },
    include: { injury_types: { select: { name: true } } },
    orderBy: [{ days_remaining: 'desc' }, { id: 'asc' }],
  },
  player_suspensions: {
    where: { status: 'ACTIVE' },
    include: { competition_seasons: suspensionCompetition },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.playersInclude;

interface AvailabilitySource {
  player_status?: { is_injured?: boolean | number; is_suspended?: boolean | number } | null;
  injuries?: { id: bigint; status: string; days_remaining: number; injury_types?: { name: string } | null }[];
  player_suspensions?: {
    id: bigint; status: string; reason: string; matches_banned: number; matches_served: number;
    competition_season_id: bigint | null; competition_seasons?: {
      name?: string; season_id?: bigint | null; country_id?: bigint | null;
      competitions?: { competition_type?: string; country_id?: bigint | null; is_youth?: boolean } | null;
    } | null;
  }[];
}

export function playerAvailability(player: AvailabilitySource, nextMatch?: DisciplineMatch | null, yellowCards: YellowCardAccumulation[] = []) {
  const injuries = (player.injuries || []).filter(injury =>
    ['ACTIVE', 'RECOVERING'].includes(injury.status) && injury.days_remaining > 0,
  ).map(injury => ({
    id: String(injury.id), name: injury.injury_types?.name || null, days_remaining: injury.days_remaining,
  }));
  const suspensions = (player.player_suspensions || []).filter(ban =>
    ban.status === 'ACTIVE' && ban.matches_banned > ban.matches_served,
  ).map(ban => ({
    id: String(ban.id), reason: ban.reason,
    competition_season_id: ban.competition_season_id == null ? null : String(ban.competition_season_id),
    competition_name: ban.competition_seasons?.name || null,
    matches_banned: ban.matches_banned, matches_served: ban.matches_served,
    matches_remaining: ban.matches_banned - ban.matches_served,
    scope: suspensionScope(ban),
    ...(nextMatch !== undefined ? { applies_to_next_match: nextMatch ? banAppliesToMatch(ban, nextMatch) : false } : {}),
  }));
  return {
    is_injured: Boolean(player.player_status?.is_injured) || injuries.length > 0,
    is_suspended: player.player_suspensions !== undefined ? suspensions.length > 0 : Boolean(player.player_status?.is_suspended),
    injury_days_remaining: injuries.length ? Math.max(...injuries.map(injury => injury.days_remaining)) : null,
    active_injuries: injuries,
    suspensions,
    yellow_cards: yellowCards.map(cards => ({ ...cards,
      ...(nextMatch !== undefined ? { applies_to_next_match: yellowCardsApplyToMatch(cards, nextMatch) } : {}),
    })),
    ...(nextMatch !== undefined ? { next_match: nextMatch ? {
      id: String(nextMatch.id), competition_season_id: nextMatch.competition_season_id == null ? null : String(nextMatch.competition_season_id),
      competition_name: nextMatch.competition_seasons?.name || null, match_type: nextMatch.match_type,
    } : null } : {}),
  };
}
