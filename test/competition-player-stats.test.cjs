const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { CompetitionsService } = require('../dist/modules/competitions/competitions.service');
const { CompetitionsController } = require('../dist/modules/competitions/competitions.controller');

function fixture({ scope = 'DOMESTIC', season = { id: 100n }, teams = [{ club_id: 20n }], stats = [] } = {}) {
  const calls = { seasons: [], teams: [], stats: [] };
  const service = new CompetitionsService({
    $queryRaw: async query => [...new Map(stats.filter(row => query.values.includes(row.match_lineups.id))
      .map(row => [row.match_lineups.id, { id: row.match_lineups.id,
        motm_player_id: row.match_lineups.tactics_snapshot.engine.motmPlayerId }])).values()],
    competitions: { findUnique: async () => ({ scope }) },
    countries: { findUnique: async () => ({ confederation_id: 4n }) },
    competition_seasons: { findFirst: async (query) => { calls.seasons.push(query); return season; } },
    stage_teams: { findMany: async (query) => { calls.teams.push(query); return teams; } },
    match_players: { findMany: async (query) => {
      calls.stats.push(query);
      return stats.filter(row => row.minutes > 0 && query.where.matches.status.in.includes(row.matches.status) &&
        row.matches.match_type !== 'FRIENDLY' && row.matches.competition_season_id === query.where.matches.competition_season_id &&
        (!query.where.match_lineups || query.where.match_lineups.club_id.in.includes(row.match_lineups.club_id)));
    } },
  });
  return { service, calls };
}

let nextAppearanceId = 10000n;
function appearance({ id = nextAppearanceId++, player = 9n, club = 20n, competition = 100n, rating = 8, goals = 0, assists = 0,
  motm = false, status = 'FINISHED', minutes = 90, matchType = 'COMPETITIVE' } = {}) {
  return { id, player_id: player, minutes, goals, assists, rating,
    matches: { status, competition_season_id: competition, match_type: matchType },
    players: { id: player, first_name: 'Nguyễn', last_name: 'An', photo_url: null },
    match_lineups: { id: id + 1000n, club_id: club, clubs: { id: club, name: 'Hà Nội', logo_url: null },
      tactics_snapshot: { engine: { motmPlayerId: motm ? String(player) : '0' } } },
  };
}

test('best players aggregate finished appearances only in the selected competition and group', async () => {
  const stats = [
    ...[8, 8.5, 8, 8.5, 8.25].map((rating, i) => appearance({ id: BigInt(i + 1), rating,
      goals: i < 2 ? 1 : 0, assists: i < 3 ? 1 : 0, motm: i < 2, status: i === 0 ? 'COMPLETED' : 'FINISHED' })),
    appearance({ competition: 200n, rating: 10 }), appearance({ club: 30n, rating: 10 }),
    appearance({ status: 'SCHEDULED' }), appearance({ matchType: 'FRIENDLY' }), appearance({ minutes: 0 }),
  ];
  const { service, calls } = fixture({ stats });
  const rows = await service.getTopPlayers(1n, 10, '84', '7');
  assert.deepEqual(calls.seasons, [{ where: { competition_id: 1n, country_id: 84n }, orderBy: { id: 'desc' } }]);
  assert.deepEqual(calls.teams[0].where, { group_id: 7n, competition_stages: { competition_season_id: 100n } });
  assert.deepEqual(calls.stats[0].where, {
    minutes: { gt: 0 }, matches: { competition_season_id: 100n, status: { in: ['FINISHED', 'COMPLETED'] }, match_type: { not: 'FRIENDLY' } },
    match_lineups: { club_id: { in: [20n] } },
  });
  assert.deepEqual(rows[0], {
    rank: 1, player: { id: '9', name: 'Nguyễn An', photo_url: null },
    club: { id: '20', name: 'Hà Nội', logo_url: null },
    goals: 2, assists: 3, appearances: 5, rating: 8.25, motm: 2,
  });
  assert.doesNotThrow(() => JSON.stringify(rows));
});

test('leaderboards sort aggregated totals before applying the limit and keep clubs separate after a transfer', async () => {
  const { service } = fixture({ stats: [
    appearance({ player: 1n, rating: 9, goals: 2, assists: 1 }),
    appearance({ player: 2n, rating: 8, goals: 2, assists: 4 }),
    appearance({ id: 2n, player: 2n, rating: 8, goals: 1, assists: 1 }),
    appearance({ id: 3n, player: 2n, club: 30n, rating: 7, goals: 1 }),
    appearance({ player: 3n, competition: 200n, rating: 10, goals: 99, assists: 99 }),
  ] });
  assert.equal((await service.getTopScorers(1n, 1))[0].player.id, '2');
  assert.equal((await service.getTopAssists(1n, 1))[0].assists, 5);
  assert.equal((await service.getTopPlayers(1n, 1))[0].player.id, '1');
  const scorers = await service.getTopScorers(1n);
  assert.equal(scorers.length, 3);
  assert.equal(scorers[0].goals, 3);
  assert.equal(scorers[2].club.id, '30');
});

test('continental leaderboards select the country’s confederation; world competitions stay global', async () => {
  for (const scope of ['CONTINENTAL', 'REGIONAL', 'INTERNATIONAL']) {
    const { service, calls } = fixture({ scope });
    await service.getTopPlayers(8n, 10, '84');
    assert.deepEqual(calls.seasons[0].where, {
      competition_id: 8n, ...(scope === 'INTERNATIONAL' ? {} : { confederation_id: 4n }),
    });
    assert.equal(calls.stats[0].where.match_lineups, undefined);
  }
});

test('empty seasons and groups return no players without falling back to another country or reputation', async () => {
  const missingSeason = fixture({ season: null });
  assert.deepEqual(await missingSeason.service.getTopPlayers(1n, 10, '84'), []);
  assert.equal(missingSeason.calls.seasons.length, 1);
  assert.equal(missingSeason.calls.stats.length, 0);
  const emptyGroup = fixture({ teams: [] });
  assert.deepEqual(await emptyGroup.service.getTopPlayers(1n, 10, '84', '7'), []);
  assert.equal(emptyGroup.calls.stats.length, 0);
  const unrated = fixture({ stats: [appearance({ rating: 0 })] });
  assert.deepEqual(await unrated.service.getTopPlayers(1n), []);
});

test('limits remain positive bounded integers', async () => {
  const stats = Array.from({ length: 105 }, (_, i) => appearance({ id: BigInt(i + 1), player: BigInt(i + 1) }));
  for (const [limit, expected] of [[NaN, 10], [-1, 1], [3.7, 3], [10000, 100]]) {
    const { service } = fixture({ stats });
    assert.equal((await service.getTopPlayers(1n, limit)).length, expected);
  }
});

test('top-players route forwards competition, country and group filters', async () => {
  let received;
  const controller = new CompetitionsController({ getTopPlayers: async (...args) => { received = args; return []; } });
  assert.equal(Reflect.getMetadata('path', controller.getTopPlayers), ':id/top-players');
  await controller.getTopPlayers('1', '5', '84', '7');
  assert.deepEqual(received, [1n, 5, '84', '7']);
});

test('season synchronization consolidates existing competition rows once, preserving the preseason ID and other seasons', async () => {
  const key = { player_id: 9n, club_id: 20n, season_id: 1n };
  let stats = [
    { ...key, id: 1n, competition_season_id: null, appearances: 0, average_rating: 0 },
    { ...key, id: 2n, competition_season_id: 578n, appearances: 1, minutes: 129, average_rating: 6.36 },
    { ...key, id: 3n, competition_season_id: 257n, appearances: 2, minutes: 195, average_rating: 6.63, clean_sheets: 1 },
    { ...key, id: 4n, season_id: 2n, competition_season_id: 999n, appearances: 1, average_rating: 8 },
  ];
  let repairs = 0;
  const db = {
    $queryRaw: async (sql, clubId) => { assert.equal(clubId, 20n); return []; },
    $executeRaw: async () => 0,
    player_statistics: {
      findMany: async ({ where }) => {
        if (typeof where.competition_season_id === 'object' && where.competition_season_id !== null) {
          return [...new Map(stats.filter(row => row.season_id === where.season_id && row.competition_season_id > 0n)
            .map(row => [`${row.player_id}:${row.club_id}`, { player_id: row.player_id, club_id: row.club_id, season_id: row.season_id }])).values()];
        }
        return stats.filter(row => Object.entries(where).every(([key, value]) => row[key] === value));
      },
      deleteMany: async ({ where }) => { stats = stats.filter(row => !where.id.in.includes(row.id)); },
      update: async ({ where, data }) => Object.assign(stats.find(row => row.id === where.id), data),
    },
  };
  db.$transaction = async work => { repairs++; return work(db); };
  const service = new CompetitionsService(db);
  await service.ensurePlayerStatisticsForSeason(1n);
  assert.equal(stats.length, 2);
  assert.equal(stats[0].id, 1n);
  assert.equal(stats[0].competition_season_id, null);
  assert.equal(stats[0].appearances, 3);
  assert.equal(stats[0].minutes, 324);
  assert.equal(stats[0].clean_sheets, 1);
  assert.equal(stats[0].average_rating, 6.54);
  assert.equal(stats[1].season_id, 2n);
  const before = structuredClone(stats);
  await service.ensurePlayerStatisticsForSeason(1n);
  assert.deepEqual(stats, before);
  assert.equal(repairs, 1);
});
