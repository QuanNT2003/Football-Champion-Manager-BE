import { Prisma } from '@prisma/client';

export const suspensionCompetition = { select: {
  name: true, season_id: true, country_id: true,
  competitions: { select: { competition_type: true, country_id: true, is_youth: true } },
} } satisfies Prisma.competition_seasonsDefaultArgs;

interface CompetitionInfo {
  name?: string; season_id?: bigint | null; country_id?: bigint | null;
  competitions?: { competition_type?: string; country_id?: bigint | null; is_youth?: boolean; age_limit?: number | null } | null;
}
export interface DisciplineMatch {
  id: bigint; competition_season_id?: bigint | null; season_id?: bigint | null;
  match_type?: string; match_date?: Date;
  competition_seasons?: CompetitionInfo | null;
}
export interface DisciplineBan {
  status?: string; reason?: string; competition_season_id: bigint | null;
  matches_banned: number; matches_served: number; competition_seasons?: CompetitionInfo | null;
}
export const isRedCardBan = (reason?: string) => ['RED_CARD', 'SECOND_YELLOW'].includes(reason);
export const isYellowCardBan = (reason?: string) => ['YELLOW_ACCUMULATION', 'YELLOW_CARDS', 'FIVE_YELLOW_CARDS'].includes(reason);
export const YELLOW_CARD_SUSPENSION_THRESHOLD = 3;
// A pair already punished as SECOND_YELLOW must not become a second accumulation warning/ban.
export const accumulatedYellowCards = (yellow: number, red = 0) => red > 0 && yellow >= 2 ? 0 : yellow;
export const crossesYellowCardThreshold = (previous: number, added: number) =>
  Math.floor((previous + added) / YELLOW_CARD_SUSPENSION_THRESHOLD) > Math.floor(previous / YELLOW_CARD_SUSPENSION_THRESHOLD);
export function domesticDisciplineGroup(competition?: CompetitionInfo | null, seasonId?: bigint | null) {
  const countryId = competition?.country_id ?? competition?.competitions?.country_id;
  const season = seasonId ?? competition?.season_id;
  return !competition?.competitions?.is_youth && countryId != null && season != null &&
    ['DOMESTIC_LEAGUE', 'DOMESTIC_SUPER_CUP'].includes(competition?.competitions?.competition_type || '')
    ? { countryId, seasonId: season, key: `DOMESTIC:${season}:${countryId}` } : null;
}

/** One filter for the yellow-card counter in both persistence and roster/profile APIs. */
export function disciplineMatchFilter(match: DisciplineMatch): Prisma.matchesWhereInput {
  const group = domesticDisciplineGroup(match.competition_seasons, match.season_id);
  return group ? { season_id: group.seasonId, competition_seasons: {
    competitions: { is_youth: false, competition_type: { in: ['DOMESTIC_LEAGUE', 'DOMESTIC_SUPER_CUP'] } },
    OR: [{ country_id: group.countryId }, { country_id: null, competitions: { country_id: group.countryId } }],
  } } : { season_id: match.season_id, competition_season_id: match.competition_season_id };
}

/** Shared by selection, serving bans and the upcoming-fixture indicator. */
export function banAppliesToMatch(ban: DisciplineBan, match: DisciplineMatch): boolean {
  if (ban.status !== 'ACTIVE' || ban.matches_served >= ban.matches_banned || match.match_type === 'FRIENDLY') return false;
  if (ban.competition_season_id == null || ban.competition_season_id === match.competition_season_id) return true;
  if (!isRedCardBan(ban.reason) && !isYellowCardBan(ban.reason)) return false;
  const source = domesticDisciplineGroup(ban.competition_seasons);
  const target = domesticDisciplineGroup(match.competition_seasons, match.season_id);
  return source != null && source.key === target?.key;
}

export function suspensionScope(ban: DisciplineBan) {
  return ban.competition_season_id == null ? 'ALL_COMPETITIONS' :
    (isRedCardBan(ban.reason) || isYellowCardBan(ban.reason)) && domesticDisciplineGroup(ban.competition_seasons)
      ? 'DOMESTIC_LEAGUE_AND_SUPER_CUP' : 'COMPETITION';
}

export const matchSquadType = (type?: string) => ['YOUTH_U19', 'YOUTH_U21'].includes(type) ? type : 'FIRST_TEAM';

export async function nextClubMatch(db: Pick<Prisma.TransactionClient, 'matches'>, clubId: bigint, squadType = 'FIRST_TEAM') {
  const ageLimit = squadType === 'YOUTH_U19' ? 19 : squadType === 'YOUTH_U21' ? 21 : null;
  return db.matches.findFirst({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      AND: [
        { OR: [{ home_club_id: clubId }, { away_club_id: clubId }] },
        ageLimit ? { competition_seasons: { competitions: { is_youth: true, age_limit: ageLimit } } }
          : { OR: [{ competition_season_id: null }, { competition_seasons: { competitions: { is_youth: false } } }] },
      ],
    },
    orderBy: [{ match_date: 'asc' }, { kickoff_time: 'asc' }, { id: 'asc' }],
    select: { id: true, competition_season_id: true, season_id: true, match_type: true, match_date: true,
      competition_seasons: suspensionCompetition },
  });
}
