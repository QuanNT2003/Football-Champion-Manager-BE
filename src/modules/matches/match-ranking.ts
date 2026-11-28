import { Prisma } from '@prisma/client';

// Game balance defaults: equal teams exchange 16 points; a 400-point gap means 10:1 expectation.
export const CLUB_RANKING_K = 32;
export const CLUB_RANKING_SCALE = 400;
const round = (n: number) => Math.round(n * 100) / 100;

export interface MatchRankingSide {
  clubId: string; pointsBefore: number; pointsAfter: number; change: number;
  rankBefore: number; rankAfter: number;
}
export interface MatchRanking {
  method: 'ELO'; k: number; scale: number; homeExpected: number; homeResult: number;
  positionsUpdated: false;
  home: MatchRankingSide; away: MatchRankingSide;
}

/** Rates this fixture, never the aggregate winner of a two-legged tie. */
export function calculateRankingChange(homePoints: number, awayPoints: number, score: {
  homeScore: number; awayScore: number; homePenaltyScore?: number | null; awayPenaltyScore?: number | null;
}) {
  if (![homePoints, awayPoints].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Invalid club ranking points');
  let difference = score.homeScore - score.awayScore;
  if (!difference && score.homePenaltyScore != null && score.awayPenaltyScore != null) difference = score.homePenaltyScore - score.awayPenaltyScore;
  const homeResult = difference > 0 ? 1 : difference < 0 ? 0 : .5;
  const homeExpected = 1 / (1 + 10 ** ((awayPoints - homePoints) / CLUB_RANKING_SCALE));
  let homeChange = round(CLUB_RANKING_K * (homeResult - homeExpected));
  // A win always transfers at least 0.01, subject to the loser's remaining points.
  if (homeResult === 1) homeChange = Math.max(.01, homeChange);
  if (homeResult === 0) homeChange = Math.min(-.01, homeChange);
  homeChange = round(Math.max(-homePoints, Math.min(awayPoints, homeChange)));
  return { homeExpected, homeResult, homeChange, awayChange: homeChange === 0 ? 0 : -homeChange,
    homeAfter: round(homePoints + homeChange), awayAfter: round(awayPoints - homeChange) };
}

/** Caller holds the two club locks; daily rank positions are published separately. */
export async function updateMatchRankingPoints(tx: Prisma.TransactionClient, worldId: bigint, homeId: string, awayId: string,
  score: Parameters<typeof calculateRankingChange>[2],
): Promise<MatchRanking> {
  const clubIds = [BigInt(homeId), BigInt(awayId)];
  // Read after the lineup club locks; the initial match include may predate another completed fixture.
  const clubs = await tx.clubs.findMany({ where: { world_id: worldId, id: { in: clubIds } },
    select: { id: true, ranking_points: true, world_rank: true } });
  const home = clubs.find(c => c.id === clubIds[0]), away = clubs.find(c => c.id === clubIds[1]);
  if (!home || !away || home.id === away.id) throw new Error('Invalid ranked match participants');
  const homePoints = Number(home.ranking_points), awayPoints = Number(away.ranking_points);
  const change = calculateRankingChange(homePoints, awayPoints, score);
  await tx.clubs.update({ where: { id: home.id }, data: { ranking_points: change.homeAfter } });
  await tx.clubs.update({ where: { id: away.id }, data: { ranking_points: change.awayAfter } });
  const side = (club: typeof home, pointsBefore: number, pointsAfter: number, delta: number): MatchRankingSide => ({
    clubId: String(club.id), pointsBefore, pointsAfter, change: delta, rankBefore: club.world_rank,
    rankAfter: club.world_rank,
  });
  return { method: 'ELO', positionsUpdated: false, k: CLUB_RANKING_K, scale: CLUB_RANKING_SCALE, homeExpected: change.homeExpected,
    homeResult: change.homeResult, home: side(home, homePoints, change.homeAfter, change.homeChange),
    away: side(away, awayPoints, change.awayAfter, change.awayChange) };
}
