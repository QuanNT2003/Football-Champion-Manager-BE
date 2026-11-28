import { Prisma } from '@prisma/client';

const counters = ['appearances', 'starts', 'substitute_appearances', 'minutes', 'goals', 'assists',
  'clean_sheets', 'yellow_cards', 'red_cards', 'motm'] as const;

type Statistics = { player_id: bigint; season_id: bigint; club_id: bigint;
  average_rating: unknown; seasons?: { name: string }; clubs?: { name: string } } & Partial<Record<typeof counters[number], number>>;

/** Legacy competition rows are disjoint contributions to a season/club total. */
export function mergePlayerStatistics<T extends Statistics>(rows: T[]) {
  const groups = new Map<string, T & Record<typeof counters[number], number> & { average_rating: number }>();
  for (const row of rows) {
    const key = `${row.player_id}:${row.season_id}:${row.club_id}`;
    const previous = groups.get(key);
    const appearances = (previous?.appearances || 0) + (row.appearances || 0);
    const merged = { ...row } as T & Record<typeof counters[number], number> & { average_rating: number };
    for (const field of counters) merged[field] = (previous?.[field] || 0) + (row[field] || 0);
    merged.average_rating = appearances ? ((previous?.average_rating || 0) * (previous?.appearances || 0)
      + Number(row.average_rating || 0) * (row.appearances || 0)) / appearances : 0;
    groups.set(key, merged);
  }
  return [...groups.values()];
}

/** Called inside a transaction while the club is locked, as in match persistence. */
export async function consolidatePlayerStatistics(tx: Prisma.TransactionClient,
  where: { player_id: bigint; season_id: bigint; club_id: bigint }) {
  const rows = await tx.player_statistics.findMany({ where, orderBy: { id: 'asc' } });
  if (!rows.length) return null;
  const survivor = rows.find(row => row.competition_season_id == null || row.competition_season_id === 0n) || rows[0];
  if (rows.length === 1 && (survivor.competition_season_id == null || survivor.competition_season_id === 0n)) return survivor;
  const [merged] = mergePlayerStatistics(rows);
  const data = { average_rating: merged.average_rating, competition_season_id: null };
  for (const field of counters) data[field] = merged[field];
  await tx.player_statistics.deleteMany({ where: { id: { in: rows.filter(row => row.id !== survivor.id).map(row => row.id) } } });
  return tx.player_statistics.update({ where: { id: survivor.id }, data });
}
