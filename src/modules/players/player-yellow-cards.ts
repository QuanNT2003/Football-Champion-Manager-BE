import { Prisma } from '@prisma/client';
import { DisciplineMatch, YELLOW_CARD_SUSPENSION_THRESHOLD, accumulatedYellowCards, disciplineMatchFilter, domesticDisciplineGroup, suspensionCompetition } from './discipline-scope';

export interface YellowCardAccumulation {
  season_id: string;
  competition_season_id: string;
  competition_name: string | null;
  total: number;
  count: number;
  threshold: number;
  scope?: 'COMPETITION' | 'DOMESTIC_LEAGUE_AND_SUPER_CUP';
  country_id?: string | null;
}

/** Read the same finished-match source as suspension creation; season statistics are not per competition. */
export async function loadYellowCards(db: Pick<Prisma.TransactionClient, 'match_players'>, playerIds: bigint[],
  scopes: Prisma.matchesWhereInput[]) {
  const grouped = new Map<bigint, YellowCardAccumulation[]>();
  if (!playerIds.length || !scopes.length) return grouped;
  const rows = await db.match_players.findMany({
    where: {
      player_id: { in: [...new Set(playerIds)] }, yellow_cards: { gt: 0 },
      matches: { OR: scopes, competition_season_id: { not: null },
        status: { in: ['FINISHED', 'COMPLETED'] }, match_type: { not: 'FRIENDLY' } },
    },
    select: { player_id: true, yellow_cards: true, red_cards: true, matches: { select: {
      season_id: true, competition_season_id: true, competition_seasons: suspensionCompetition,
    } } },
  });
  for (const row of rows) {
    const match = row.matches;
    const added = accumulatedYellowCards(row.yellow_cards, row.red_cards);
    if (!added) continue;
    if (match.season_id == null || match.competition_season_id == null) continue;
    const seasonId = String(match.season_id), competitionId = String(match.competition_season_id);
    const group = domesticDisciplineGroup(match.competition_seasons, match.season_id);
    const entries = grouped.get(row.player_id) || [];
    let entry = entries.find(value => value.season_id === seasonId && (group
      ? value.scope === 'DOMESTIC_LEAGUE_AND_SUPER_CUP' && value.country_id === String(group.countryId)
      : value.scope !== 'DOMESTIC_LEAGUE_AND_SUPER_CUP' && value.competition_season_id === competitionId));
    if (!entry) {
      entry = { season_id: seasonId, competition_season_id: competitionId,
        competition_name: match.competition_seasons?.name || null, total: 0, count: 0,
        threshold: YELLOW_CARD_SUSPENSION_THRESHOLD,
        scope: group ? 'DOMESTIC_LEAGUE_AND_SUPER_CUP' : 'COMPETITION',
        country_id: group ? String(group.countryId) : null };
      entries.push(entry);
      grouped.set(row.player_id, entries);
    }
    entry.total += added;
    entry.count = entry.total % entry.threshold;
  }
  return grouped;
}

export function yellowCardMatchScopes(matches: (DisciplineMatch | null)[]) {
  return matches.flatMap(match => match?.season_id != null && match.competition_season_id != null && match.match_type !== 'FRIENDLY'
    ? [disciplineMatchFilter(match)] : []);
}

export function yellowCardsApplyToMatch(cards: YellowCardAccumulation, match: DisciplineMatch | null) {
  if (!match || match.match_type === 'FRIENDLY' || cards.season_id !== String(match.season_id)) return false;
  const group = domesticDisciplineGroup(match.competition_seasons, match.season_id);
  return cards.scope === 'DOMESTIC_LEAGUE_AND_SUPER_CUP'
    ? group != null && cards.country_id === String(group.countryId)
    : cards.competition_season_id === String(match.competition_season_id);
}
