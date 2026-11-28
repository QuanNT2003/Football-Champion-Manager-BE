import { Prisma } from '@prisma/client';

/** Competition totals come from finished appearances; player_statistics holds season totals. */
export async function competitionPlayerStatistics(db: Pick<Prisma.TransactionClient, 'match_players' | '$queryRaw'>,
  competitionSeasonId: bigint, clubIds?: bigint[]) {
  const rows = await db.match_players.findMany({
    where: {
      minutes: { gt: 0 },
      matches: { competition_season_id: competitionSeasonId, status: { in: ['FINISHED', 'COMPLETED'] }, match_type: { not: 'FRIENDLY' } },
      ...(clubIds ? { match_lineups: { club_id: { in: clubIds } } } : {}),
    },
    select: {
      id: true, player_id: true, goals: true, assists: true, rating: true,
      players: { select: { id: true, first_name: true, last_name: true, photo_url: true } },
      match_lineups: { select: { id: true, club_id: true, clubs: { select: { id: true, name: true, logo_url: true } } } },
    },
  });
  if (!rows.length) return [];
  // Fetch only the MOTM ID once per lineup, rather than its full engine snapshot per appearance.
  const lineupIds = [...new Set(rows.map(row => row.match_lineups.id))];
  const awards = await db.$queryRaw<{ id: bigint; motm_player_id: string | null }[]>(Prisma.sql`
    SELECT id, JSON_UNQUOTE(JSON_EXTRACT(tactics_snapshot, '$.engine.motmPlayerId')) AS motm_player_id
    FROM match_lineups WHERE id IN (${Prisma.join(lineupIds)})
  `);
  const motmByLineup = new Map(awards.map(row => [row.id, row.motm_player_id]));
  const grouped = new Map<string, { id: bigint; players: typeof rows[number]['players'];
    clubs: typeof rows[number]['match_lineups']['clubs']; goals: number; assists: number;
    appearances: number; average_rating: number; motm: number; ratingSum: number }>();
  for (const row of rows) {
    const key = `${row.player_id}:${row.match_lineups.club_id}`;
    const stat = grouped.get(key) || { id: row.id, players: row.players, clubs: row.match_lineups.clubs,
      goals: 0, assists: 0, appearances: 0, average_rating: 0, motm: 0, ratingSum: 0 };
    stat.goals += row.goals;
    stat.assists += row.assists;
    stat.appearances++;
    stat.ratingSum += Number(row.rating);
    stat.average_rating = stat.ratingSum / stat.appearances;
    stat.motm += motmByLineup.get(row.match_lineups.id) === String(row.player_id) ? 1 : 0;
    if (row.id < stat.id) stat.id = row.id;
    grouped.set(key, stat);
  }
  return [...grouped.values()];
}
