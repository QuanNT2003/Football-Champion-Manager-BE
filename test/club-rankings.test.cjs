const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/match-lineup-fixture.cjs');
const { ClubRankingsService, clubRankingDate, CLUB_RANKING_CRON } = require('../dist/modules/rankings/club-rankings.service');
const date = new Date('2026-11-26T00:00:00Z');
function setup() {
  const f = fixture();
  const db = { ...f.db, game_worlds: { findMany: async () => [{ id: 1n }, { id: 2n }, { id: 3n }] } };
  const service = new ClubRankingsService(db);
  service.logger = { log() {}, error() {} };
  return { ...f, db, service };
}

test('daily cutoff is 00:10 Vietnam time, with the latest due date used for startup catch-up', () => {
  assert.equal(CLUB_RANKING_CRON, '0 10 0 * * *');
  for (const [instant, day] of [
    ['2026-11-25T17:09:59.999Z', '2026-11-25'],
    ['2026-11-25T17:10:00Z', '2026-11-26'],
    ['2026-11-26T10:00:00Z', '2026-11-26'],
    ['2026-12-31T17:05:00Z', '2026-12-31'],
    ['2026-12-31T17:10:00Z', '2027-01-01'],
  ]) assert.equal(clubRankingDate(new Date(instant)).toISOString().slice(0, 10), day);
  const { SCHEDULE_CRON_OPTIONS } = require('@nestjs/schedule/dist/schedule.constants');
  const options = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, ClubRankingsService.prototype.runDailyRankings);
  assert.equal(options.cronTime, CLUB_RANKING_CRON);
  assert.equal(options.timeZone, 'Asia/Ho_Chi_Minh');
});

test('daily publication orders by points then ID, preserves points, isolates worlds and saves a daily snapshot', async () => {
  const f = setup();
  f.state().clubs[0].ranking_points = 1020;
  const before = structuredClone(f.state().clubs);
  const result = await f.service.publishWorldRanks(1n, date);
  assert.deepEqual(result, { published: true, clubs: 3 });
  assert.equal(f.state().clubs[0].world_rank, 1);
  assert.equal(f.state().clubs[0].previous_world_rank, 2);
  assert.equal(f.state().clubs.find(c => c.id === 30n).world_rank, 2);
  for (const [i, club] of f.state().clubs.entries()) assert.equal(club.ranking_points, before[i].ranking_points);
  assert.deepEqual(f.state().clubs.find(c => c.id === 40n), before.find(c => c.id === 40n));
  assert.equal(f.state().rankHistory.length, 3);
  const record = f.state().rankHistory.find(row => row.club_id === 10n);
  assert.equal(record.rank, 1); assert.equal(record.previous_rank, 2); assert.equal(record.points, 1020);
  assert.equal(record.ranking_date.getTime(), date.getTime());
  assert.ok(f.state().locks[0][0].includes('FROM game_worlds'));
});

test('multiple publishers and retries publish a world only once per day, even when points change later', async () => {
  const f = setup(), second = new ClubRankingsService(f.db);
  const results = await Promise.all([f.service.publishWorldRanks(1n, date), second.publishWorldRanks(1n, date)]);
  assert.equal(results.filter(r => r.published).length, 1);
  const before = structuredClone(f.state());
  f.state().clubs[0].ranking_points = 3000;
  assert.equal((await f.service.publishWorldRanks(1n, date)).published, false);
  assert.equal(f.state().rankHistory.length, 3);
  assert.deepEqual(f.state().rankBatches, before.rankBatches);
  assert.equal(f.state().clubs[0].world_rank, before.clubs[0].world_rank);
  assert.equal(f.state().rankHistory.find(row => row.club_id === 10n).points, 1000);
});

test('the next daily publication resets previous rank to the last published rank, including unchanged positions', async () => {
  const f = setup();
  f.state().clubs[0].ranking_points = 1020;
  await f.service.publishWorldRanks(1n, date);
  assert.equal(f.state().clubs[0].previous_world_rank, 2);
  await f.service.publishWorldRanks(1n, new Date('2026-11-27T00:00:00Z'));
  assert.equal(f.state().clubs[0].world_rank, 1);
  assert.equal(f.state().clubs[0].previous_world_rank, 1);
  assert.equal(f.state().rankHistory.length, 6);
});

test('already stable ranks need no rank write but still record the completed daily publication', async () => {
  const f = setup();
  for (const club of f.state().clubs) club.previous_world_rank = club.world_rank;
  await f.service.publishWorldRanks(1n, date);
  assert.equal(f.state().rankBatches.length, 0);
  assert.equal(f.state().rankHistory.length, 3);
  assert.deepEqual(await f.service.publishWorldRanks(3n, date), { published: false, clubs: 0 });
});

test('more than 10,000 clubs use bounded parameterized rank batches and bounded history inserts', async () => {
  const f = setup();
  f.state().clubs.push(...Array.from({ length: 10003 }, (_, i) => ({
    id: BigInt(100 + i), world_id: 1n, ranking_points: 2000, world_rank: 1, previous_world_rank: 0,
  })));
  f.tx.clubs.update = () => { throw new Error('Daily publication must not update points'); };
  let inserts = 0;
  const create = f.tx.club_rankings.createMany;
  f.tx.club_rankings.createMany = args => { inserts++; assert.ok(args.data.length <= 500); return create(args); };
  await f.service.publishWorldRanks(1n, date);
  assert.equal(f.state().rankBatches.length, 21);
  assert.equal(inserts, 21);
  assert.equal(f.state().rankHistory.length, 10006);
  for (const query of f.state().rankBatches) {
    assert.ok(query.values.length <= 1501);
    assert.match(query.sql, /world_rank = CASE id WHEN \? THEN \?/);
    assert.match(query.sql, /WHERE world_id = \? AND id IN/);
    assert.equal((query.sql.match(/\?/g) || []).length, query.values.length);
  }
  const ordered = f.state().clubs.filter(c => c.world_id === 1n).sort((a,b) => b.ranking_points - a.ranking_points || Number(a.id - b.id));
  for (const [index, club] of ordered.entries()) assert.equal(club.world_rank, index + 1);
});

test('failure during a later rank or history batch rolls back the entire world and permits a clean retry', async () => {
  for (const target of ['rank', 'history']) {
    const f = setup();
    f.state().clubs.push(...Array.from({ length: 1001 }, (_, i) => ({
      id: BigInt(100 + i), world_id: 1n, ranking_points: 2000, world_rank: 1, previous_world_rank: 0,
    })));
    const before = structuredClone(f.state());
    const holder = target === 'rank' ? f.tx : f.tx.club_rankings;
    const method = target === 'rank' ? '$executeRaw' : 'createMany';
    const original = holder[method]; let calls = 0;
    holder[method] = args => { if (++calls === 2) throw new Error('daily batch failed'); return original(args); };
    await assert.rejects(f.service.publishWorldRanks(1n, date), /daily batch failed/);
    assert.equal(calls, 2);
    assert.deepEqual(f.state(), before);
    holder[method] = original;
    assert.equal((await f.service.publishWorldRanks(1n, date)).published, true);
    assert.equal(f.state().rankHistory.length, 1004);
  }
});

test('scheduled processing continues with other worlds after one fails and can retry the failed world', async () => {
  const f = setup(); const original = f.service.publishWorldRanks.bind(f.service);
  f.service.publishWorldRanks = (id, day) => { if (id === 1n) throw new Error('world failed'); return original(id, day); };
  await f.service.runDailyRankings(new Date('2026-11-26T10:00:00Z'));
  assert.deepEqual(f.state().rankHistory.map(row => row.world_id), [2n]);
  f.service.publishWorldRanks = original;
  await f.service.runDailyRankings(new Date('2026-11-26T10:00:00Z'));
  assert.equal(f.state().rankHistory.length, 4);
});

test('overlapping cron/bootstrap calls are skipped within an instance and the guard is released after errors', async () => {
  const f = setup(); let release;
  const gate = new Promise(resolve => { release = resolve; }); let reads = 0;
  f.db.game_worlds.findMany = async () => { reads++; await gate; throw new Error('read failed'); };
  const first = f.service.runDailyRankings();
  await f.service.runDailyRankings();
  assert.equal(reads, 1);
  release(); await first;
  f.db.game_worlds.findMany = async () => { reads++; return []; };
  await f.service.onApplicationBootstrap();
  assert.equal(reads, 2);
});
