const { test } = require('node:test');
const assert = require('node:assert/strict');
const { simulateMatchEngine, coachingEffects } = require('../dist/modules/matches/match-engine');
const { publicEngineLineup } = require('../dist/modules/matches/match-report');
const { engineInput, engineTeam } = require('./helpers/match-engine-fixture.cjs');

test('same seed and snapshot reproduce the whole match without mutating inputs', () => {
  const input = engineInput(42), before = structuredClone(input);
  const first = simulateMatchEngine(input);
  assert.deepEqual(first, simulateMatchEngine(input));
  assert.deepEqual(input, before);
  assert.notDeepEqual(first.events, simulateMatchEngine(engineInput(43)).events);
  assert.ok(first.duration > 90);
});

test('events, team statistics and player totals remain consistent over many seeds', () => {
  for (let seed = 1; seed <= 35; seed++) {
    const input = engineInput(seed), result = simulateMatchEngine(input);
    assert.equal(Math.round(result.home.statistics.possession + result.away.statistics.possession), 100);
    for (const side of ['home', 'away']) {
      const team = result[side], stats = team.statistics;
      assert.equal(team.players.reduce((n, p) => n + p.stats.goals, 0), result[`${side}Score`]);
      assert.equal(result.events.filter(e => e.eventType === 'GOAL' && e.clubId === team.id).length, result[`${side}Score`]);
      assert.equal(team.players.reduce((n, p) => n + p.stats.shots, 0), stats.shots);
      assert.equal(team.players.reduce((n, p) => n + p.stats.passesCompleted, 0), stats.passesCompleted);
      assert.ok(stats.shotsOnTarget <= stats.shots && stats.passesCompleted <= stats.passes);
      assert.ok(stats.substitutions <= 5);
      for (const row of team.players) {
        assert.ok(row.stats.minutes >= 0 && row.stats.minutes <= result.duration);
        assert.ok(row.stats.fitnessEnd >= 0 && row.stats.fitnessEnd <= row.stats.fitnessStart);
        if (!row.stats.minutes) assert.equal(row.stats.rating, 0);
        else assert.ok(row.stats.rating >= 1 && row.stats.rating <= 10);
      }
    }
    assert.ok(result.events.every((e, i) => e.sequence === i + 1 && (!i || e.elapsed >= result.events[i - 1].elapsed)));
  }
});

test('only players on the pitch participate; substitutes and dismissed players obey their entry/exit', () => {
  for (let seed = 20; seed < 40; seed++) {
    const input = engineInput(seed);
    for (const p of input.home.players) p.status.fitness = 72;
    const result = simulateMatchEngine(input);
    const active = new Set([...input.home.players, ...input.away.players].filter(p => p.started).map(p => p.id));
    for (const e of result.events) {
      if (e.eventType === 'SUBSTITUTION') {
        assert.ok(active.has(e.relatedPlayerId)); assert.ok(!active.has(e.playerId));
        active.delete(e.relatedPlayerId); active.add(e.playerId);
      } else if (e.playerId) {
        assert.ok(active.has(e.playerId), `${e.eventType} actor ${e.playerId} must be playing`);
        if (['RED_CARD', 'SECOND_YELLOW_RED'].includes(e.eventType)) active.delete(e.playerId);
      }
      if (e.eventType === 'GOAL') {
        const player = [...input.home.players, ...input.away.players].find(p => p.id === e.playerId);
        assert.notEqual(player.position, 'GK');
      }
    }
  }
});

test('resting substitutes do not consume fitness; tired players trigger staff substitutions', () => {
  const input = engineInput(12);
  for (const p of input.home.players) p.status.fitness = 72;
  const result = simulateMatchEngine(input);
  assert.ok(result.home.statistics.substitutions > 0);
  for (const row of result.home.players.filter(p => !p.stats.minutes)) assert.equal(row.stats.fitnessEnd, 72);
});

test('exhausted players can complete matches but lower fitness reduces results over balanced home/away seeds', () => {
  const totals = { freshPoints: 0, tiredPoints: 0, freshGoals: 0, tiredGoals: 0 };
  for (let seed = 400; seed < 460; seed++) {
    const input = engineInput(seed), side = seed % 2 ? 'home' : 'away';
    const fresh = simulateMatchEngine(input);
    for (const p of input[side].players) p.status.fitness = 0;
    const tired = simulateMatchEngine(input);
    const points = result => result.winnerClubId === input[side].id ? 3 : result.winnerClubId == null ? 1 : 0;
    totals.freshPoints += points(fresh); totals.tiredPoints += points(tired);
    totals.freshGoals += fresh[`${side}Score`]; totals.tiredGoals += tired[`${side}Score`];
    assert.ok(tired.duration >= 90);
    assert.ok(tired[side].players.every(p => p.stats.fitnessStart === 0 && p.stats.fitnessEnd === 0));
  }
  assert.ok(totals.freshPoints > totals.tiredPoints, JSON.stringify(totals));
  assert.ok(totals.freshGoals > totals.tiredGoals, JSON.stringify(totals));
});

test('fitness loss stays below 24 points under maximum intensity, including extra time and rounding', () => {
  for (const startingFitness of [100, 70]) {
    const input = engineInput(42);
    for (const side of ['home', 'away']) {
      const team = input[side];
      team.players = team.players.filter(p => p.started);
      team.coaches = [];
      team.tactic.tempo = 100; team.tactic.pressing = 100;
      for (const player of team.players) {
        player.status.fitness = startingFitness;
        player.attributes.sta = 1;
        player.duty = 'ATTACK';
      }
    }
    const regular = simulateMatchEngine(input);
    Object.assign(input.rules, { knockout: true, decidingLeg: true, extraTime: true, penalties: true,
      aggregateHome: regular.awayScore, aggregateAway: regular.homeScore });
    const result = simulateMatchEngine(input);
    assert.ok(result.duration > 120, 'covers both extra-time periods and stoppage time');
    const players = [...result.home.players, ...result.away.players];
    for (const { stats } of players) {
      const loss = stats.fitnessStart - stats.fitnessEnd;
      assert.ok(loss >= 0 && loss < 24, `actual fitness loss ${loss}`);
      assert.ok(stats.fitnessStart - Math.round(stats.fitnessEnd) < 24, 'DB integer rounding keeps the limit');
      assert.ok(Math.abs(stats.fatigueEnd - loss * .6) < .02, 'fatigue follows the fitness actually consumed');
    }
    assert.ok(players.some(p => p.stats.fitnessStart - p.stats.fitnessEnd === 23), 'worst case reaches the cap');
  }
});

test('head coach, assistant and specialists contribute without stacking duplicate coaches or crossing youth squads', () => {
  const team = engineTeam();
  const base = coachingEffects(team);
  for (const key of Object.keys(team.coaches[1].attributes)) team.coaches[1].attributes[key] = 100;
  const assisted = coachingEffects(team);
  assert.ok(assisted.attack > base.attack && assisted.decisions > base.decisions);
  team.coaches[2].attributes.fitness = 100; team.coaches[2].attributes.sports_science = 100;
  assert.ok(coachingEffects(team).fitness > assisted.fitness);
  const once = coachingEffects(team).goalkeeping;
  team.coaches.push(...Array.from({ length: 20 }, () => structuredClone(team.coaches[3])));
  assert.equal(coachingEffects(team).goalkeeping, once);
  const youth = structuredClone(team.coaches[0]); youth.id = 'youth'; youth.role = 'HEAD_COACH_YOUTH';
  for (const key of Object.keys(youth.attributes)) youth.attributes[key] = 100;
  team.coaches.push(youth);
  assert.notEqual(coachingEffects(team).headCoachId, 'youth');
  team.squadType = 'YOUTH_U21';
  assert.equal(coachingEffects(team).headCoachId, 'youth');
});

test('knockout penalties resolve ties, use eligible shooters and do not inflate goals', () => {
  let tested = 0;
  for (let seed = 1; seed < 65; seed++) {
    const input = engineInput(seed);
    Object.assign(input.rules, { knockout: true, decidingLeg: true, penalties: true });
    const result = simulateMatchEngine(input);
    if (result.resultType !== 'PENALTIES') continue;
    tested++;
    assert.notEqual(result.homePenaltyScore, result.awayPenaltyScore);
    assert.ok(result.winnerClubId);
    assert.equal(result.homeScore, result.homeRegularScore);
    assert.equal(result.homeExtraScore, null);
    const kicks = result.events.filter(e => ['PENALTY_SCORED', 'PENALTY_MISSED'].includes(e.eventType));
    assert.equal(kicks.filter(e => e.clubId === input.home.id && e.eventType === 'PENALTY_SCORED').length, result.homePenaltyScore);
    assert.equal(result.home.players.reduce((n, p) => n + p.stats.goals, 0), result.homeScore);
    const homeKicks = kicks.filter(e => e.clubId === input.home.id);
    const awayKicks = kicks.filter(e => e.clubId === input.away.id);
    assert.ok(Math.abs(homeKicks.length - awayKicks.length) <= 1);
    assert.ok(kicks.every(e => e.phase === 'SHOOTOUT'));
  }
  assert.ok(tested > 5);
});

test('extra time and two-leg aggregate are separate from regulation and shootout', () => {
  let sawExtra = false;
  for (let seed = 1; seed < 40; seed++) {
    const input = engineInput(seed);
    Object.assign(input.rules, { knockout: true, decidingLeg: true, extraTime: true, penalties: true });
    const result = simulateMatchEngine(input);
    assert.equal(result.homeScore, result.homeRegularScore + (result.homeExtraScore || 0));
    assert.equal(result.awayScore, result.awayRegularScore + (result.awayExtraScore || 0));
    if (result.homeExtraScore !== null) { sawExtra = true; assert.ok(result.duration > 120); }
    const aggregate = engineInput(seed);
    Object.assign(aggregate.rules, { knockout: true, decidingLeg: true, extraTime: true, penalties: true, aggregateHome: 20 });
    const won = simulateMatchEngine(aggregate);
    assert.equal(won.winnerClubId, aggregate.home.id);
    assert.equal(won.homePenaltyScore, null);
    assert.equal(won.homeExtraScore, null);
  }
  assert.ok(sawExtra);
});

test('first legs allow draws and unresolved deciding legs fail instead of choosing home', () => {
  let found = false;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const input = engineInput(seed);
    input.rules.knockout = true;
    const result = simulateMatchEngine(input);
    assert.equal(result.winnerClubId, null);
    assert.equal(result.homePenaltyScore, null);
    if (result.homeScore === result.awayScore) {
      found = true; input.rules.decidingLeg = true;
      assert.throws(() => simulateMatchEngine(input), /without an enabled tie-breaker/);
    }
  }
  assert.ok(found);
});

test('public match report has statistics and coaching identities without private traits or balance inputs', () => {
  const input = engineInput(7), result = simulateMatchEngine(input);
  const report = publicEngineLineup(input.home, result.home);
  const text = JSON.stringify(report);
  for (const key of ['injury_proneness', 'greed', 'hasUser', 'userAttributeBonus', 'seed', 'attributes', 'mentality":{']) assert.ok(!text.includes(key));
  assert.ok(report.coaches.some(c => c.role === 'ASSISTANT_COACH'));
  assert.equal(report.players.length, 20);
});

test('player attributes and user-club advantage change outcomes across home/away balanced seeds', () => {
  const totals = { baseline: 0, user: 0, strong: 0, baselineGoals: 0, userGoals: 0 };
  const samples = 120;
  for (let seed = 100; seed < 100 + samples; seed++) {
    const input = engineInput(seed), side = seed % 2 ? 'home' : 'away';
    const base = simulateMatchEngine(input);
    totals.baseline += base.winnerClubId === input[side].id ? 1 : 0;
    totals.baselineGoals += base[`${side}Score`];
    input[side].hasUser = true;
    const user = simulateMatchEngine(input);
    totals.user += user.winnerClubId === input[side].id ? 1 : 0;
    totals.userGoals += user[`${side}Score`];
    input[side] = engineTeam(input[side].id, 85);
    const strong = simulateMatchEngine(input);
    totals.strong += strong.winnerClubId === input[side].id ? 1 : 0;
  }
  assert.ok(totals.user > totals.baseline + samples * .15, JSON.stringify(totals));
  assert.ok(totals.userGoals > totals.baselineGoals, JSON.stringify(totals));
  assert.ok(totals.strong > totals.baseline + samples * .25, JSON.stringify(totals));
  process.stdout.write(`Balance sample (${samples} seeds, alternate home/away): ${JSON.stringify(totals)}\n`);
});

test('short passing improves completion; high pressing and tempo spend more fitness', () => {
  let shortAccuracy = 0, directAccuracy = 0, lowCondition = 0, highCondition = 0;
  for (let seed = 50; seed < 75; seed++) {
    const input = engineInput(seed);
    input.home.tactic.passingStyle = 'SHORT';
    const short = simulateMatchEngine(input);
    shortAccuracy += short.home.statistics.passAccuracy;
    input.home.tactic.passingStyle = 'DIRECT';
    input.home.tactic.tempo = 90; input.home.tactic.pressing = 90;
    const direct = simulateMatchEngine(input);
    directAccuracy += direct.home.statistics.passAccuracy;
    lowCondition += short.home.players[0].stats.fitnessEnd;
    highCondition += direct.home.players[0].stats.fitnessEnd;
  }
  assert.ok(shortAccuracy > directAccuracy);
  assert.ok(lowCondition > highCondition);
});

test('formation, role and player traits change play independently of overall rating', () => {
  const base = engineInput(99);
  const original = simulateMatchEngine(base);
  const changed = structuredClone(base);
  changed.home.players[8].position = 'CM'; changed.home.players[8].role = 'DEEP_LYING_PLAYMAKER';
  changed.home.players[8].traits = { dictates_tempo: 1, killer_balls: 1, comes_deep: 1 };
  const result = simulateMatchEngine(changed);
  assert.notDeepEqual(result.events, original.events);
  assert.notDeepEqual(result.home.statistics, original.home.statistics);
  const long = structuredClone(base);
  for (const player of long.home.players) player.traits.shoots_distance = 1;
  const ranged = simulateMatchEngine(long);
  assert.ok(ranged.events.some(e => e.clubId === long.home.id && e.data.shotType === 'LONG_RANGE'));
});

test('injury events force legal replacements and persist their absence for later actions', () => {
  let injuries = 0;
  for (let seed = 1; seed < 12; seed++) {
    const input = engineInput(seed); input.config.injuryRate = .008;
    const result = simulateMatchEngine(input);
    for (const event of result.events.filter(e => e.eventType === 'INJURY')) {
      injuries++;
      const rows = [...result.home.players, ...result.away.players];
      assert.equal(rows.find(p => p.player.id === event.playerId).stats.injured, true);
      assert.ok(!result.events.some(e => e.sequence > event.sequence && e.playerId === event.playerId));
    }
  }
  assert.ok(injuries > 0);
});
