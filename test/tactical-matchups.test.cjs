const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { simulateMatchEngine } = require('../dist/modules/matches/match-engine');
const { TACTICAL_RULEBOOK: book } = require('../dist/modules/matches/tactical-rulebook');
const { normalizeInstructions, normalizeTeam, effectiveTactic, stylePreset, ROLE_BEHAVIOURS } = require('../dist/modules/matches/tactic-normalizer');
const { matchupEffects, mitigationSignals, findPair, transitionSpace } = require('../dist/modules/matches/tactical-matchups');
const { decidePossession, defensivePolicy, keeperPolicy } = require('../dist/modules/matches/player-decision-policy');
const { playerAdjustment, tacticalAdvice } = require('../dist/modules/matches/coaching-adaptation');
const { tacticalInput, setFormation } = require('./helpers/tactical-fixture.cjs');
const { cases } = require('./fixtures/legacy-engine-baseline.json');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const state = team => ({ ...team, players: team.players.filter(p => p.started) });

test('four frozen legacy scenarios keep the complete original output hash and version', () => {
  for (const c of cases) {
    const result = simulateMatchEngine(c.input);
    assert.equal(hash(result), c.hash, c.scenario);
    assert.equal(result.version, '2.1.0');
  }
});

test('runtime rulebook covers 16 formations, 10 styles, 30 instructions and 23 roles with a verified hash', () => {
  assert.equal(book.formations.length, 16); assert.equal(book.styles.length, 10);
  assert.equal(book.instructions.length, 30); assert.equal(book.roles.length, 23);
  assert.deepEqual(Object.keys(ROLE_BEHAVIOURS).sort(), [...book.roles].sort());
  const { hash: recorded, ...data } = book;
  assert.equal(hash(data), recorded);
  for (const [catalog, pairs] of [[book.formations, book.formationPairs], [book.styles, book.stylePairs]]) {
    assert.equal(pairs.length, catalog.length * (catalog.length - 1) / 2);
    const keys = new Set();
    for (const p of pairs) {
      const key = [p.a, p.b].sort().join(':'); assert.ok(!keys.has(key)); keys.add(key);
      assert.equal(findPair(pairs, p.a, p.b), findPair(pairs, p.b, p.a));
      assert.ok(!p.basePenalty || p.disadvantaged && p.winner && p.disadvantaged !== p.winner);
    }
  }
});

test('normalization is immutable, JSON replay stable, deterministic on conflicts, and preserves saved settings', () => {
  const input = tacticalInput();
  input.home.players[1].coordinates = { x: NaN, y: NaN };
  input.home.players[2].instructions = ['COUNTER_PRESS', 'MID_BLOCK', 'REGROUP_DEFENCE'];
  input.home.players[5].instructions = ['COUNTER_PRESS', 'LOW_BLOCK_BUS'];
  const original = structuredClone(input.home), team = normalizeTeam(input.home);
  assert.deepEqual(input.home, original);
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeTeam(team))), JSON.parse(JSON.stringify(team)));
  assert.deepEqual(normalizeInstructions([...book.instructions].reverse()), normalizeInstructions(book.instructions));
  assert.equal(team.instructions.filter(i => i === 'COUNTER_PRESS').length, 1);
  assert.ok(!team.instructions.includes('REGROUP_DEFENCE'));
  for (const style of book.styles) {
    assert.equal(stylePreset(style.code).defensiveLine, style.preset.line);
    assert.deepEqual(normalizeTeam({ ...input.home, tacticalStyle: style.code }).tactic, input.home.tactic);
  }
  assert.equal(normalizeTeam({ ...input.home, formationCode: 'UNKNOWN' }).formationCode, 'UNKNOWN');
  const first = simulateMatchEngine(input);
  assert.deepEqual(first, simulateMatchEngine(JSON.parse(JSON.stringify(input))));
  assert.equal(first.version, '2.2.0');
  assert.throws(() => simulateMatchEngine({ ...input, config: { ...input.config, rulesetHash: 'wrong' } }), /Unsupported tactical/);
});

test('all formation and style rules penalize only the disadvantaged side within one shared phase budget', () => {
  for (const [pairs, field] of [[book.formationPairs, 'formationCode'], [book.stylePairs, 'tacticalStyle']]) {
    for (const rule of pairs) {
      const input = tacticalInput();
      if (field === 'formationCode') { setFormation(input.home, rule.a); setFormation(input.away, rule.b); }
      else input.home.formationCode = input.away.formationCode = '433_ATT';
      input.home[field] = rule.a; input.away[field] = rule.b;
      const a = state(input.home), b = state(input.away);
      const ea = matchupEffects(a, b), eb = matchupEffects(b, a);
      assert.ok(ea.total <= .15 && eb.total <= .15);
      if (!rule.basePenalty) assert.equal(ea.total + eb.total, 0);
      else {
        const lost = rule.disadvantaged === rule.a ? ea : eb, won = rule.disadvantaged === rule.a ? eb : ea;
        assert.ok(lost.total > 0); assert.equal(won.total, 0);
        assert.ok(Math.abs(lost.buildup + lost.progression + lost.creation + lost.defense - lost.total) < 1e-9);
      }
    }
  }
  const input = tacticalInput();
  input.home.formationCode = 'UNKNOWN'; input.away.formationCode = 'UNKNOWN';
  assert.equal(matchupEffects(state(input.home), state(input.away)).total, 0);
});

test('coherent settings reduce every non-neutral rule; mitigation never reverses it or guarantees a draw', () => {
  for (const [pairs, field] of [[book.formationPairs, 'formationCode'], [book.stylePairs, 'tacticalStyle']]) {
    for (const rule of pairs.filter(p => p.basePenalty)) {
      const input = tacticalInput();
      const own = input.home, other = input.away;
      if (field === 'formationCode') { setFormation(own, rule.disadvantaged); setFormation(other, rule.winner); }
      else { own.formationCode = other.formationCode = '433_ATT'; own.tacticalStyle = rule.disadvantaged; other.tacticalStyle = rule.winner; }
      own.tactic = { mentality: 'ATTACKING', tempo: 100, passingStyle: 'SHORT', pressing: 0, defensiveLine: 100 };
      const bad = matchupEffects(state(own), state(other));
      own.tactic = { mentality: 'BALANCED', tempo: 35, passingStyle: 'DIRECT', pressing: 35, defensiveLine: 35 };
      own.instructions = ['WORK_BALL_INTO_BOX', 'WING_PLAY', 'EXTREMELY_WIDE', 'MID_BLOCK', 'DISTRIBUTE_QUICKLY', 'REGROUP_DEFENCE'];
      for (const p of own.players) {
        p.duty = ['ST', 'SS', 'LW', 'RW'].includes(p.position) ? 'SUPPORT' : 'DEFEND';
        if (p.position === 'ST') p.role = 'FALSE_NINE';
        p.traits.switches_play = 1;
      }
      const good = matchupEffects(state(own), state(other));
      assert.ok(good.total < bad.total, `${field}:${rule.a}/${rule.b} ${good.total} < ${bad.total}`);
      assert.ok(good.total > 0 && good.mitigation <= .9);
    }
  }
});

test('line settings are smooth and space exposure shares the defensive budget instead of a threshold jump', () => {
  const { home, away } = tacticalInput(); home.tactic.passingStyle = 'DIRECT';
  const a = transitionSpace(home.tactic, { ...away.tactic, defensiveLine: 60 }, []);
  const b = transitionSpace(home.tactic, { ...away.tactic, defensiveLine: 61 }, []);
  assert.ok(b > a && b - a < .005); assert.ok(b <= .15);
});

test('all 30 instructions and 23 roles have observable action effects in seeded contrasts', () => {
  const seeds = [7, 23, 41, 67, 81, 98, 123, 187];
  const baselines = seeds.map(seed => {
    const result = simulateMatchEngine(tacticalInput(seed)); return hash([result.events, result.home.statistics, result.away.statistics]);
  });
  for (const code of book.instructions) {
    let changes = 0;
    for (const [i, seed] of seeds.entries()) {
      const input = tacticalInput(seed);
      for (const p of input.home.players) p.instructions = [code];
      const result = simulateMatchEngine(input);
      changes += hash([result.events, result.home.statistics, result.away.statistics]) !== baselines[i] ? 1 : 0;
    }
    if (code === 'FORCE_INSIDE' || code === 'FORCE_OUTSIDE') {
      assert.ok(defensivePolicy([code], code === 'FORCE_INSIDE' ? 'WIDE' : 'CENTRE').routePenalty > 0);
    } else assert.ok(changes > 0, `instruction ${code} must affect actions, not just the snapshot`);
  }
  for (const role of book.roles) {
    if (['COMMANDING_KEEPER', 'SHOT_STOPPER', 'SWEEPER_KEEPER'].includes(role)) {
      const keeper = tacticalInput().home.players[0];
      const baseline = [keeperPolicy(keeper), keeperPolicy(keeper, true), keeperPolicy(keeper, false, 'SPACE')];
      keeper.role = role;
      assert.notDeepEqual([keeperPolicy(keeper), keeperPolicy(keeper, true), keeperPolicy(keeper, false, 'SPACE')], baseline);
      continue;
    }
    let changes = 0;
    for (const [i, seed] of seeds.entries()) {
      const input = tacticalInput(seed);
      for (const p of input.home.players.filter(p => role.includes('KEEPER') || role === 'SHOT_STOPPER' ? p.position === 'GK' : p.position !== 'GK')) p.role = role;
      const result = simulateMatchEngine(input);
      changes += hash([result.events, result.home.statistics, result.away.statistics]) !== baselines[i] ? 1 : 0;
    }
    assert.ok(changes > 0, `role ${role}`);
  }
});

test('decision policy requires available outlets/runners and coach advice uses existing problems only', () => {
  const input = tacticalInput();
  const p = input.home.players[6]; p.instructions = ['PASS_INTO_SPACE'];
  const decision = decidePossession(p, [p], input.home.tactic, ['WING_PLAY'], 70, 90, () => .1);
  assert.equal(decision.route, 'CENTRE'); assert.equal(decision.risky, false);
  const low = decidePossession(p, input.home.players, input.home.tactic, [], 40, 10, () => .5);
  const high = decidePossession(p, input.home.players, input.home.tactic, [], 40, 95, () => .5);
  assert.ok(high.completion > low.completion);
  const neutral = matchupEffects(state(input.home), state(input.home));
  assert.deepEqual(tacticalAdvice(input.home.tactic, neutral, .3), {});
  assert.ok(Object.keys(mitigationSignals(state(input.home))).length === 10);
});

test('team directives are not stacked by position count; effective coach adjustments are logged and bounded', () => {
  const one = tacticalInput(73), many = tacticalInput(73);
  one.home.players[1].instructions = ['COUNTER_PRESS'];
  for (const p of many.home.players.filter(p => p.started)) p.instructions = ['COUNTER_PRESS'];
  assert.deepEqual(simulateMatchEngine(one), simulateMatchEngine(many));
  const input = tacticalInput(11, '433_ATT', '433_DEF');
  input.home.tactic.pressing = 0; input.home.tactic.defensiveLine = 100;
  for (const c of input.home.coaches) for (const key of Object.keys(c.attributes)) c.attributes[key] = 100;
  const problem = matchupEffects(state(input.home), state(input.away));
  assert.ok(playerAdjustment(state(input.home).players, problem));
  const r = simulateMatchEngine(input);
  const changes = r.events.filter(e => e.clubId === input.home.id && e.eventType === 'TACTICAL_CHANGE');
  assert.ok(changes.length > 0 && changes.length <= 3);
  assert.ok(changes.some(e => e.data.role === 'FALSE_NINE'));
  assert.ok(changes.every(e => e.minute >= 45 && 'passingStyle' in e.data && 'defensiveLine' in e.data));
});
