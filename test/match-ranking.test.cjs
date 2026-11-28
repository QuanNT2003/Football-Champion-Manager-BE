const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateRankingChange, updateMatchRankingPoints } = require('../dist/modules/matches/match-ranking');
const { fixture } = require('./helpers/match-lineup-fixture.cjs');
const win = { homeScore: 1, awayScore: 0 };
const lose = { homeScore: 0, awayScore: 1 };

test('equal ratings exchange 16 points for a win and zero for a draw', () => {
  assert.equal(calculateRankingChange(1000, 1000, win).homeChange, 16);
  assert.equal(calculateRankingChange(1000, 1000, lose).homeChange, -16);
  const draw = calculateRankingChange(1000, 1000, { homeScore: 2, awayScore: 2 });
  assert.equal(draw.homeChange, 0);
  assert.equal(draw.awayChange, 0);
});

test('larger gaps reduce favorite win rewards and increase favorite loss penalties, with symmetric underdog changes', () => {
  let previousWin = 17, previousLoss = 0;
  for (const gap of [0, 100, 400, 800]) {
    const favoriteWin = calculateRankingChange(1000 + gap, 1000, win);
    const favoriteLoss = calculateRankingChange(1000 + gap, 1000, lose);
    assert.ok(favoriteWin.homeChange < previousWin);
    assert.ok(Math.abs(favoriteLoss.homeChange) > previousLoss);
    const underdogWin = calculateRankingChange(1000, 1000 + gap, win);
    assert.equal(underdogWin.homeChange, -favoriteLoss.homeChange);
    assert.equal(favoriteWin.homeChange + favoriteWin.awayChange, 0);
    previousWin = favoriteWin.homeChange; previousLoss = -favoriteLoss.homeChange;
  }
  assert.equal(calculateRankingChange(1400, 1000, win).homeChange, 2.91);
  assert.equal(calculateRankingChange(1400, 1000, lose).homeChange, -29.09);
});

test('draws favor the underdog; points stay nonnegative and conserved at rating boundaries', () => {
  assert.ok(calculateRankingChange(1400, 1000, { homeScore: 0, awayScore: 0 }).homeChange < 0);
  for (const [home, away] of [[100000, 1], [1, 100000], [0, 1000], [1000, 0], [0, 0]]) {
    for (const result of [win, lose, { homeScore: 0, awayScore: 0 }]) {
      const r = calculateRankingChange(home, away, result);
      assert.ok(r.homeAfter >= 0 && r.awayAfter >= 0);
      assert.ok(Math.abs(r.homeAfter + r.awayAfter - home - away) < .00001);
    }
  }
  assert.throws(() => calculateRankingChange(NaN, 1000, win), /ranking points/);
});

test('rates the current leg result independently of aggregate winner; shootouts resolve tied match scores', () => {
  assert.equal(calculateRankingChange(1000, 1000, { ...win, winnerClubId: 'away' }).homeChange, 16);
  assert.equal(calculateRankingChange(1000, 1000, { homeScore: 1, awayScore: 1, homePenaltyScore: 3, awayPenaltyScore: 4 }).homeChange, -16);
});

test('ranked match persists point changes once while published positions stay unchanged; reports retain the original snapshot', async () => {
  const f = fixture();
  const result = await f.simulator.simulateMatch(50n);
  const rank = result.ranking;
  assert.ok(rank);
  for (const side of ['home', 'away']) {
    const club = f.state().clubs.find(c => String(c.id) === rank[side].clubId);
    assert.equal(club.ranking_points, rank[side].pointsAfter);
    assert.equal(club.world_rank, rank[side].rankAfter);
  }
  assert.equal(rank.home.change + rank.away.change, 0);
  assert.equal(f.state().clubs.find(c => c.id === 40n).ranking_points, 5000);
  assert.equal(f.state().clubs.find(c => c.id === 40n).world_rank, 1);
  const worldLock = f.state().locks.findIndex(([sql]) => sql.includes('game_worlds'));
  const clubLock = f.state().locks.findIndex(([sql]) => sql.includes('FROM clubs'));
  assert.equal(worldLock, -1, 'matches no longer lock the entire world');
  assert.ok(clubLock >= 0);
  assert.equal(rank.positionsUpdated, false);
  assert.equal(rank.home.rankAfter, rank.home.rankBefore);
  assert.equal(rank.away.rankAfter, rank.away.rankBefore);
  assert.equal(f.state().rankBatches.length, 0);
  assert.equal(f.state().rankHistory.length, 0);
  assert.deepEqual((await f.matches.getMatchById(50n)).ranking, rank);
  const before = structuredClone(f.state().clubs);
  await f.simulator.simulateMatch(50n);
  assert.deepEqual(f.state().clubs, before);
  f.state().clubs[0].ranking_points += 100;
  assert.deepEqual((await f.matches.getMatchById(50n)).ranking, rank);
});

test('point updates read only the two participants and never scan or write world ranks, even in a large world', async () => {
  const f = fixture();
  f.state().clubs.push(...Array.from({ length: 10003 }, (_, i) => ({
    id: BigInt(100 + i), world_id: 1n, ranking_points: 2000, world_rank: 1, previous_world_rank: 0,
  })));
  const before = structuredClone(f.state().clubs);
  const find = f.tx.clubs.findMany;
  let queries = 0;
  f.tx.clubs.findMany = args => {
    queries++;
    assert.deepEqual(args.where.id.in, [10n, 20n]);
    return find(args);
  };
  await updateMatchRankingPoints(f.tx, 1n, '10', '20', win);
  assert.equal(queries, 1);
  assert.equal(f.state().rankBatches.length, 0);
  assert.equal(f.state().rankHistory.length, 0);
  for (const [index, club] of f.state().clubs.entries()) {
    assert.equal(club.world_rank, before[index].world_rank);
    assert.equal(club.previous_world_rank, before[index].previous_world_rank);
    if (club.id !== 10n && club.id !== 20n) assert.equal(club.ranking_points, before[index].ranking_points);
  }
});

test('friendly and youth results do not change club rank; cross-world matches fail', async () => {
  for (const youth of [false, true]) {
    const f = fixture();
    if (youth) {
      Object.assign(f.state().match.competition_seasons.competitions, { is_youth: true, age_limit: 21 });
      for (const p of f.state().players) { p.age = 20; p.squad_type = 'YOUTH_U21'; }
    }
    else f.state().match.match_type = 'FRIENDLY';
    const before = structuredClone(f.state().clubs);
    assert.equal((await f.simulator.simulateMatch(50n)).ranking, null);
    assert.deepEqual(f.state().clubs, before);
  }
  const f = fixture();
  f.state().match.clubs_matches_away_club_idToclubs.world_id = 2n;
  await assert.rejects(f.simulator.simulateMatch(50n), /cùng thế giới/);
});
