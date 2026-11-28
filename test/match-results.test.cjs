const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/match-lineup-fixture.cjs');
const { simulateMatchEngine } = require('../dist/modules/matches/match-engine');
const { engineInput } = require('./helpers/match-engine-fixture.cjs');
const { singleMatchWinner, twoLegWinner, resolveEngineRules } = require('../dist/modules/matches/match-result.rules');
const { MatchesService } = require('../dist/modules/matches/matches.service');

const score = data => ({ status: 'FINISHED', home_club_id: 10n, away_club_id: 20n,
  home_score: 1, away_score: 1, home_penalty_score: null, away_penalty_score: null, ...data });

test('winner resolvers reject unfinished, unresolved and incorrectly paired results', () => {
  assert.equal(singleMatchWinner(score({})), null);
  assert.equal(singleMatchWinner(score({ status: 'SCHEDULED', home_score: 3 })), null);
  assert.equal(singleMatchWinner(score({ home_score: null })), null);
  assert.equal(singleMatchWinner(score({ status: 'COMPLETED', home_penalty_score: 3, away_penalty_score: 4 })), 20n);
  const first = score({ home_score: 2, away_score: 1 });
  const second = score({ home_club_id: 20n, away_club_id: 10n, home_score: 1, away_score: 0 });
  assert.equal(twoLegWinner(first, second), null);
  assert.equal(twoLegWinner({ ...first, status: 'SCHEDULED' }, { ...second, home_penalty_score: 4, away_penalty_score: 5 }), null);
  assert.equal(twoLegWinner(first, { ...second, home_penalty_score: 4, away_penalty_score: 5 }), 10n);
  assert.equal(twoLegWinner(first, { ...second, away_club_id: 99n }), null);
  assert.equal(twoLegWinner(first, second, true), 20n);
});

test('fixture lists return compact goal summaries in one query without full event or engine payloads', async () => {
  const row = { ...fixture().state().match, status: 'FINISHED', home_score: 2, away_score: 0,
    match_events: [{ club_id: 10n, player_id: 1n, minute: 45, event_type: 'GOAL', metadata: { addedTime: 2, shotType: 'PENALTY' },
      players_match_events_player_idToplayers: { first_name: 'Nguyễn Tiến', last_name: 'Linh' } }],
  };
  let queries = 0;
  const service = new MatchesService({ matches: {
    count: async () => 1,
    findMany: async ({ include }) => {
      queries++;
      assert.deepEqual(include.match_events.where.event_type.in, ['GOAL', 'OWN_GOAL']);
      assert.equal(include.match_lineups, undefined);
      return [row];
    },
  } }, null);
  const list = await service.getMatches(1, 20, '10');
  assert.equal(queries, 1);
  assert.deepEqual(list.items[0].scorers, [{ clubId: '10', playerId: '1', playerName: 'Nguyễn Tiến Linh', minute: 45, addedTime: 2, ownGoal: false, penalty: true }]);
  assert.equal(list.items[0].events, undefined);
  assert.doesNotThrow(() => JSON.stringify(list));
});

test('detail reports expose numeric pitch coordinates for the saved formation slots', async () => {
  const f = fixture();
  for (const form of f.state().formations) for (const slot of form.formation_positions) { slot.x = '37.5'; slot.y = '25.0'; }
  await f.simulator.simulateMatch(50n);
  const report = await f.matches.getMatchById(50n);
  const starter = report.lineups[0].players.find(p => p.started);
  assert.deepEqual(starter.coordinates, { x: 37.5, y: 25 });
});

function ruleMatch(round = 2) {
  return { id: 50n, competition_season_id: 9n, stage_id: 12n, tie_id: null,
    home_club_id: 20n, away_club_id: 10n, match_type: 'COMPETITIVE',
    competition_stages: { stage_type: 'KNOCKOUT' },
    competition_seasons: { competitions: { competition_type: 'CONTINENTAL_CLUB_C1', format_type: 'HYBRID' } },
    stage_rounds: { round_no: round, knockout_round_rules: [] },
  };
}

test('second legs require exactly one completed reversed fixture and orient its aggregate correctly', async () => {
  const match = ruleMatch();
  const first = score({ home_score: 3, away_score: 1 });
  const tx = { matches: { findMany: async ({ where }) => {
    assert.equal(where.stage_rounds.round_no, 1);
    assert.equal(where.home_club_id, 10n);
    assert.equal(where.away_club_id, 20n);
    return [first];
  } } };
  const rules = await resolveEngineRules(tx, match);
  assert.equal(rules.aggregateHome, 1); assert.equal(rules.aggregateAway, 3);
  assert.equal(rules.decidingLeg, true);
  assert.equal((await resolveEngineRules({}, ruleMatch(1))).decidingLeg, false);
  await assert.rejects(resolveEngineRules({ matches: { findMany: async () => [] } }, match), /duy nhất lượt đi/);
  await assert.rejects(resolveEngineRules({ matches: { findMany: async () => [first, first] } }, match), /duy nhất lượt đi/);
  await assert.rejects(resolveEngineRules({ matches: { findMany: async () => [{ ...first, status: 'SCHEDULED' }] } }, match), /chưa hoàn tất/);
});

test('explicit round rules control straight penalties and malformed rules fail clearly', async () => {
  const match = ruleMatch(7);
  match.stage_rounds.knockout_round_rules = [{ legs: 1, extra_time: false, penalties: true, away_goals_rule: false }];
  const rules = await resolveEngineRules({}, match);
  assert.equal(rules.extraTime, false); assert.equal(rules.penalties, true);
  match.stage_rounds.knockout_round_rules[0].legs = 0;
  await assert.rejects(resolveEngineRules({}, match), /thể thức/);
  match.competition_stages.stage_type = 'GROUP';
  assert.equal((await resolveEngineRules({}, match)).knockout, false);
});

test('stored tie identity, calendar order and reversed participants determine the deciding leg', async () => {
  const match = { ...ruleMatch(), tie_id: 90n };
  const first = { ...score({ home_score: 1, away_score: 0 }), id: 49n, match_date: new Date('2026-11-24Z'), kickoff_time: new Date('1970-01-01T19:00Z') };
  const second = { ...match, match_date: new Date('2026-11-25Z'), kickoff_time: first.kickoff_time };
  assert.equal((await resolveEngineRules({ matches: { findMany: async () => [first, second] } }, second)).aggregateAway, 1);
  await assert.rejects(resolveEngineRules({ matches: { findMany: async () => [first] } }, match), /đúng hai lượt/);
});

test('a finished match persists full reports, player totals, standings and reproducible private snapshots', async () => {
  const f = fixture();
  const result = await f.simulator.simulateMatch(50n);
  const state = f.state();
  assert.equal(state.match.status, 'FINISHED');
  assert.ok(state.events.length > 100);
  assert.equal(state.standings.length, 2);
  assert.ok(state.standings.every(s => s.played === 1));
  assert.equal(state.standings.reduce((n, s) => n + s.goals_for, 0), result.homeScore + result.awayScore);
  assert.equal(state.stats.reduce((n, s) => n + s.goals, 0), result.homeScore + result.awayScore);
  assert.equal(state.stats.reduce((n, s) => n + s.motm, 0), 1);
  const home = state.lineups.find(l => l.club_id === 10n).tactics_snapshot.engine;
  const away = state.lineups.find(l => l.club_id === 20n).tactics_snapshot.engine;
  assert.equal(home.version, '2.3.0');
  assert.equal(home.config.tacticalModel, 'contextual_v2');
  assert.equal(home.config.rulesetHash, require('../dist/modules/matches/tactical-rulebook-v2').TACTICAL_RULEBOOK_V2.hash);
  assert.equal(away.config.rulesetHash, home.config.rulesetHash);
  const replay = simulateMatchEngine({ seed: home.seed, home: home.input, away: away.input, rules: home.rules, config: home.config });
  assert.equal(replay.homeScore, result.homeScore);
  assert.equal(replay.awayScore, result.awayScore);
  assert.deepEqual(replay.home.statistics, result.statistics.home);
  assert.deepEqual(replay.events.map(e => ({ ...e.data, sequence: e.sequence, phase: e.phase, addedTime: e.addedTime, elapsed: e.elapsed })),
    result.events.map(e => e.metadata));
  assert.ok(state.players.some(p => p.player_status.fitness < 100));
  const report = await f.matches.getMatchById(50n);
  assert.deepEqual(report.statistics, result.statistics);
  assert.equal(report.lineups.length, 2);
  assert.equal(report.events.length, result.events.length);
  assert.ok(report.events.every((e, i) => e.metadata.sequence === i + 1));
  assert.doesNotThrow(() => JSON.stringify(report));
  const publicText = JSON.stringify(report);
  for (const key of ['injury_proneness', 'greed', 'seed', 'hasUser', 'userAttributeBonus', 'player_mentality']) assert.ok(!publicText.includes(key));
  state.players[0].ovr = 99;
  assert.equal((await f.matches.getMatchById(50n)).lineups[0].players[0].rating, report.lineups[0].players[0].rating);
});

test('retry and simultaneous simulator calls do not duplicate statistics, events, standings or income', async () => {
  const f = fixture();
  await Promise.all([f.simulator.simulateMatch(50n), f.simulator.simulateMatch(50n)]);
  const before = structuredClone(f.state());
  await f.simulator.simulateMatch(50n);
  assert.equal(f.state().transactions.length, 1);
  assert.deepEqual(f.state().stats, before.stats);
  assert.deepEqual(f.state().standings, before.standings);
  assert.deepEqual(f.state().events, before.events);
  assert.deepEqual(f.state().players, before.players);
  assert.deepEqual(f.state().clubs, before.clubs);
});

test('match fitness is the persisted Squad/training value, stays below 24 loss and does not deduct condition', async () => {
  const f = fixture();
  for (const p of f.state().players) { p.player_status.condition = 41; p.player_status.fitness = 88; }
  await f.simulator.simulateMatch(50n);
  const report = await f.matches.getMatchById(50n);
  for (const p of f.state().players) {
    assert.equal(p.player_status.condition, 41);
    assert.ok(p.player_status.fitness >= 65 && p.player_status.fitness <= 88);
    const recorded = report.lineups.flatMap(l => l.players).find(row => row.id === String(p.id));
    if (recorded) assert.equal(p.player_status.fitness, Math.round(recorded.fitnessEnd));
  }
  assert.ok(f.state().players.some(p => p.player_status.fitness < 88));
  assert.ok(report.lineups.every(l => l.players.every(p => p.conditionEnd === undefined)));
});

test('failure after computing the match rolls back status, snapshots, stats, bans, injuries and standings', async () => {
  const f = fixture(); f.state().failEvents = true;
  const before = structuredClone(f.state());
  await assert.rejects(f.simulator.simulateMatch(50n), /event persistence failed/);
  assert.deepEqual(f.state(), before);
});

async function persistenceFixture() {
  const f = fixture(), prepared = await f.prepare(), input = engineInput(88);
  for (const side of ['home', 'away']) {
    const rows = f.state().matchPlayers.filter(p => p.lineup_id === prepared[side].lineupId);
    input[side].players.forEach((p, i) => { p.id = rows[i].player_id.toString(); p.formationPositionId = rows[i].formation_position_id?.toString() || null; });
  }
  return { f, prepared, input };
}

test('league and cup reuse the preseason row and consolidate old competition totals without losing statistics', async () => {
  const { f, prepared, input } = await persistenceFixture();
  const result = simulateMatchEngine(input), target = result.home.players.find(row => row.stats.minutes > 0);
  const playerId = BigInt(target.player.id);
  target.stats.rating = 8;
  const base = { player_id: playerId, club_id: 10n, season_id: 7n };
  f.state().stats.push(
    { ...base, id: 100n, competition_season_id: null, appearances: 0, average_rating: 0 },
    { ...base, id: 101n, competition_season_id: 578n, appearances: 1, starts: 1, minutes: 129, average_rating: 6.36, yellow_cards: 2 },
    { ...base, id: 102n, competition_season_id: 257n, appearances: 2, starts: 2, minutes: 195, average_rating: 6.63, clean_sheets: 1 },
  );
  await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
  let totals = f.state().stats.filter(row => row.player_id === playerId);
  assert.equal(totals.length, 1);
  assert.equal(totals[0].id, 100n);
  assert.equal(totals[0].competition_season_id, null);
  assert.equal(totals[0].appearances, 4);
  assert.equal(totals[0].minutes, 324 + target.stats.minutes);
  assert.equal(totals[0].clean_sheets, 1 + Number(target.stats.cleanSheet));
  assert.equal(totals[0].average_rating, (6.36 + 6.63 * 2 + 8) / 4);
  assert.ok(!f.state().bans.some(row => row.player_id === playerId && row.reason === 'YELLOW_ACCUMULATION'));
  f.state().match.competition_season_id = 30n;
  await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
  totals = f.state().stats.filter(row => row.player_id === playerId);
  assert.equal(totals.length, 1);
  assert.equal(totals[0].id, 100n);
  assert.equal(totals[0].appearances, 5);
  assert.equal(totals[0].average_rating, (6.36 + 6.63 * 2 + 8 * 2) / 5);
});

test('third yellow and red cards create scoped bans and aggregate ratings use appearance weights', async () => {
  const { f, prepared, input } = await persistenceFixture();
  const result = simulateMatchEngine(input), target = result.home.players[1];
  target.stats.yellowCards = 1; target.stats.redCards = 0; target.stats.rating = 8;
  const playerId = BigInt(target.player.id);
  f.state().stats.push({ id: 999n, player_id: playerId, club_id: 10n, season_id: 7n, competition_season_id: 9n,
    appearances: 2, average_rating: 5, yellow_cards: 2 });
  f.state().pastMatchPlayers = [{ player_id: playerId, match_id: 49n, yellow_cards: 2,
    matches: { season_id: 7n, competition_season_id: 9n, status: 'FINISHED', match_type: 'COMPETITIVE' } }];
  await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
  const stats = f.state().stats.find(s => s.player_id === playerId);
  assert.equal(stats.appearances, 3); assert.equal(stats.average_rating, 6);
  assert.ok(f.state().bans.some(b => b.player_id === playerId && b.reason === 'YELLOW_ACCUMULATION' && b.competition_season_id === 9n));
  assert.equal(f.state().players.find(p => p.id === playerId).player_status.is_suspended, true);
});

test('bans apply and are served in their competition; youth bans are not served by the first team', async () => {
  const f = fixture();
  f.addTactic();
  const p = f.state().players[1];
  p.player_status.is_suspended = true;
  f.state().bans.push({ id: 900n, player_id: p.id, competition_season_id: 999n, status: 'ACTIVE', matches_banned: 1, matches_served: 0, match_id: 40n });
  const eligible = await f.prepare();
  assert.ok(eligible.home.starters.some(row => row.id === p.id), 'ban from another competition does not block this fixture');
  const sameComp = f.state().players[2]; sameComp.player_status.is_suspended = true;
  f.state().bans.push({ id: 901n, player_id: sameComp.id, competition_season_id: 9n, status: 'ACTIVE', matches_banned: 1, matches_served: 0, match_id: 40n });
  const young = f.state().players[3]; young.squad_type = 'YOUTH_U21';
  f.state().bans.push({ id: 902n, player_id: young.id, competition_season_id: null, status: 'ACTIVE', matches_banned: 1, matches_served: 0, match_id: 40n });
  await f.simulator.simulateMatch(50n);
  assert.equal(f.state().bans.find(b => b.id === 900n).matches_served, 0);
  assert.equal(f.state().bans.find(b => b.id === 901n).status, 'SERVED');
  assert.equal(f.state().bans.find(b => b.id === 902n).matches_served, 0);
  assert.ok(!f.state().matchPlayers.some(row => row.player_id === sameComp.id));
});

test('injuries are persisted with return date and unused substitutes get no appearance or fitness loss', async () => {
  const { f, prepared, input } = await persistenceFixture();
  const result = simulateMatchEngine(input), player = result.home.players[1];
  player.stats.injured = true; player.stats.injuryDays = 5;
  await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
  const injury = f.state().injuries.find(i => i.player_id === BigInt(player.player.id));
  assert.equal(injury.days_remaining, 5);
  assert.equal(injury.expected_return_date.toISOString().slice(0,10), '2026-11-30');
  const unused = result.home.players.find(p => !p.stats.minutes);
  assert.ok(unused);
  assert.ok(!f.state().stats.some(s => s.player_id.toString() === unused.player.id));
  assert.equal(f.state().players.find(p => p.id.toString() === unused.player.id).player_status.fitness, 100);
});

test('direct reds and second yellows create different suspension lengths', async () => {
  for (const secondYellow of [false, true]) {
    const { f, prepared, input } = await persistenceFixture();
    const result = simulateMatchEngine(input), target = result.home.players[1];
    target.stats.redCards = 1; target.stats.yellowCards = secondYellow ? 2 : 0;
    await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
    const ban = f.state().bans.find(b => b.player_id.toString() === target.player.id);
    assert.equal(ban.reason, secondYellow ? 'SECOND_YELLOW' : 'RED_CARD');
    assert.equal(ban.matches_banned, secondYellow ? 1 : 2);
  }
});

test('Super Cup red and yellow bans block and are served in the league, while Cup matches leave them untouched', async () => {
  for (const reason of ['RED_CARD', 'SECOND_YELLOW', 'YELLOW_ACCUMULATION', 'FIVE_YELLOW_CARDS']) for (const cup of [false, true]) {
    const f = fixture(), state = f.state(), target = state.players[1];
    target.ovr = 95; // Ensure the otherwise eligible player is selected rather than omitted for quality.
    const banned = reason === 'RED_CARD' ? 2 : 1;
    state.bans.push({ id: 990n, player_id: target.id, competition_season_id: 31n, reason,
      status: 'ACTIVE', matches_banned: banned, matches_served: 0, match_id: 40n });
    target.player_status.is_suspended = true;
    if (cup) {
      state.match.competition_season_id = 30n;
      state.match.competition_seasons = { ...state.match.competition_seasons, ...state.competitions.find(c => c.id === 30n),
        competitions: { ...state.match.competition_seasons.competitions, ...state.competitions.find(c => c.id === 30n).competitions } };
    }
    await f.simulator.simulateMatch(50n);
    const after = f.state();
    assert.equal(after.bans.find(b => b.id === 990n).matches_served, cup ? 0 : 1);
    assert.equal(after.matchPlayers.some(p => p.player_id === target.id), cup);
    if (!cup && banned === 1) {
      assert.equal(after.bans.find(b => b.id === 990n).status, 'SERVED');
      assert.equal(after.players.find(p => p.id === target.id).player_status.is_suspended, false);
    }
  }
});

test('yellow accumulation follows transfers within the shared league/Super Cup season and does not count served triples again', async () => {
  for (const prior of [{ season: 7n, competition: 9n, banned: true }, { season: 7n, competition: 31n, banned: true },
    { season: 7n, competition: 9n, nextCompetition: 31n, banned: true },
    { season: 7n, competition: 31n, total: 2, red: 1, banned: false },
    { season: 6n, competition: 9n, banned: false }, { season: 7n, competition: 30n, banned: false },
    { season: 7n, competition: 31n, total: 3, banned: false }]) {
    const { f, prepared, input } = await persistenceFixture();
    const result = simulateMatchEngine(input), target = result.home.players[1];
    target.stats.yellowCards = 1; target.stats.redCards = 0;
    if (prior.nextCompetition) {
      f.state().match.competition_season_id = prior.nextCompetition;
      f.state().match.competition_seasons = f.state().competitions.find(c => c.id === prior.nextCompetition);
    }
    f.state().pastMatchPlayers = [{ player_id: BigInt(target.player.id), match_id: 49n, yellow_cards: prior.total ?? 2, red_cards: prior.red || 0,
      matches: { season_id: prior.season, competition_season_id: prior.competition, status: 'FINISHED', match_type: 'COMPETITIVE' } }];
    await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
    const yellowBan = f.state().bans.find(b => b.player_id === BigInt(target.player.id) && b.reason === 'YELLOW_ACCUMULATION');
    assert.equal(Boolean(yellowBan), prior.banned);
    if (yellowBan) { assert.equal(yellowBan.matches_banned, 1); assert.equal(yellowBan.competition_season_id, prior.nextCompetition || 9n); }
  }
});

test('knockout and friendly matches do not add league points or competitive appearances', async () => {
  const { f, prepared, input } = await persistenceFixture();
  const result = simulateMatchEngine(input);
  f.state().match.competition_stages.stage_type = 'KNOCKOUT';
  f.state().match.match_type = 'FRIENDLY';
  await f.db.$transaction(tx => f.results.persist(tx, f.state().match, input, result, prepared));
  assert.equal(f.state().standings.length, 0);
  assert.equal(f.state().stats.length, 0);
  assert.equal(f.state().bans.length, 0);
});
