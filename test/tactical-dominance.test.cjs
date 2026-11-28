const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { simulateMatchEngine } = require('../dist/modules/matches/match-engine');
const { TACTICAL_RULEBOOK_V2: book } = require('../dist/modules/matches/tactical-rulebook-v2');
const { matchupEffects } = require('../dist/modules/matches/tactical-matchups');
const { tacticalLeverage } = require('../dist/modules/matches/tactical-dominance');
const { tacticalInput, setFormation } = require('./helpers/tactical-fixture.cjs');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const state = team => ({ ...team, players: team.players.filter(p => p.started) });
function inputV2(seed) {
  const input = tacticalInput(seed);
  Object.assign(input.config, { tacticalModel: 'contextual_v2', rulesetVersion: book.version, rulesetHash: book.hash });
  return input;
}

test('all five contextual_v1 snapshots retain complete output hashes including counter, mitigation and extra time', () => {
  for (const c of require('./fixtures/contextual-v1-baseline.json').cases) {
    const result = simulateMatchEngine(c.input);
    assert.equal(result.version, '2.2.0'); assert.equal(hash(result), c.hash, c.scenario);
  }
});

test('contextual_v2 rules are independently fingerprinted without changing the v1 rulebook', () => {
  const { hash: digest, ...data } = book;
  assert.equal(hash(data), digest); assert.equal(book.version, '2.0.0');
  assert.notEqual(digest, require('../dist/modules/matches/tactical-rulebook').TACTICAL_RULEBOOK.hash);
  assert.equal(require('../dist/modules/matches/tactical-rulebook').TACTICAL_RULEBOOK.version, '1.0.0');
});

test('all 120 formation pairs give bounded pressure only to the countered side; stronger responses reduce it', () => {
  for (const pair of book.formationPairs) {
    const input = inputV2(42); setFormation(input.home, pair.a); setFormation(input.away, pair.b);
    const a = matchupEffects(state(input.home), state(input.away), book);
    const b = matchupEffects(state(input.away), state(input.home), book);
    if (!pair.basePenalty) { assert.equal(a.pressure.total, 0); assert.equal(b.pressure.total, 0); continue; }
    const own = input[pair.disadvantaged === pair.a ? 'home' : 'away'];
    const opponent = input[pair.disadvantaged === pair.a ? 'away' : 'home'];
    const winner = pair.disadvantaged === pair.a ? b : a;
    assert.equal(winner.pressure.total, 0);
    Object.assign(own.tactic, { tempo: 100, pressing: 0, defensiveLine: 100 });
    const bad = matchupEffects(state(own), state(opponent), book);
    Object.assign(own.tactic, { tempo: 35, pressing: 35, defensiveLine: 35, passingStyle: 'DIRECT' });
    own.instructions = ['WING_PLAY', 'EXTREMELY_WIDE', 'REGROUP_DEFENCE', 'WORK_BALL_INTO_BOX', 'MID_BLOCK'];
    for (const p of own.players) { if (p.position === 'ST') p.role = 'FALSE_NINE'; p.traits.switches_play = 1; }
    const good = matchupEffects(state(own), state(opponent), book);
    assert.ok(good.pressure.total < bad.pressure.total, pair.a + '/' + pair.b);
    assert.ok(bad.pressure.total <= book.dominance.maxPressure);
    assert.ok(Math.abs(Object.values(good.pressure.byAxis).reduce((a,b) => a+b, 0) - good.pressure.total) < 1e-9);
  }
});

test('neutral settings have comparable tactical pressure across shapes at the same counter tier', () => {
  for (const pair of book.formationPairs.filter(p => p.basePenalty)) {
    const input = inputV2(42); setFormation(input.home, pair.disadvantaged); setFormation(input.away, pair.winner);
    const effects = matchupEffects(state(input.home), state(input.away), book);
    const expected = book.dominance.strength * Math.pow(pair.basePenalty / .04, book.dominance.tierExponent);
    assert.ok(Math.abs(effects.pressure.total - expected) < 1e-9, `${pair.a}/${pair.b}: ${effects.pressure.total} vs ${expected}`);
  }
});

test('territorial and opportunity leverage use reciprocal pressure, route relevance and no bonus for neutral pairs', () => {
  const input = inputV2(42);
  const a = matchupEffects(state(input.home), state(input.away), book);
  const b = matchupEffects(state(input.away), state(input.home), book);
  const advantage = tacticalLeverage(a, b, book, 'CENTRE'), disadvantage = tacticalLeverage(b, a, book, 'CENTRE');
  assert.ok(advantage.control > 1 && disadvantage.control < 1);
  assert.ok(Math.abs(advantage.control * disadvantage.control - 1) < 1e-12);
  assert.ok(Math.abs(advantage.opportunity * disadvantage.opportunity - 1) < 1e-12);
  assert.ok(advantage.opportunity > tacticalLeverage(a, b, book, 'WIDE').opportunity);
  const neutral = matchupEffects(state(input.home), state(input.home), book);
  assert.deepEqual(tacticalLeverage(neutral, neutral, book), { control: 1, opportunity: 1, completion: 0 });
});

test('suitable counterplay removes most of the advantage without reversing the formation rule', () => {
  const input = inputV2(73); setFormation(input.home, '433_DEF'); setFormation(input.away, '433_ATT');
  const before = matchupEffects(state(input.away), state(input.home), book).pressure.total;
  input.away.instructions = ['WING_PLAY'];
  const striker = input.away.players.find(p => p.position === 'ST'); striker.role = 'FALSE_NINE'; striker.instructions = ['WORK_BALL_INTO_BOX'];
  input.away.players.find(p => p.position === 'LW').traits.switches_play = 1;
  const after = matchupEffects(state(input.away), state(input.home), book).pressure.total;
  assert.ok(after < before * .2 && after >= 0);
  assert.equal(matchupEffects(state(input.home), state(input.away), book).pressure.total, 0);
});

test('formation and style pressure affecting the same axis do not stack the same cause twice', () => {
  const input = inputV2(73); setFormation(input.home, '433_ATT'); setFormation(input.away, '433_DEF');
  const formationOnly = matchupEffects(state(input.home), state(input.away), book);
  input.home.tacticalStyle = 'CONTROL_POSSESSION'; input.away.tacticalStyle = 'COUNTER_ATTACK';
  const combined = matchupEffects(state(input.home), state(input.away), book);
  const styleOnly = matchupEffects({ ...state(input.home), formationCode: undefined }, { ...state(input.away), formationCode: undefined }, book);
  assert.equal(combined.pressure.byAxis.SHIELD, Math.max(formationOnly.pressure.byAxis.SHIELD, styleOnly.pressure.byAxis.SHIELD));
});

test('new model replays complete results immutably and rejects a stale model fingerprint', () => {
  const input = inputV2(73), before = structuredClone(input);
  const result = simulateMatchEngine(input);
  assert.equal(result.version, '2.3.0'); assert.deepEqual(input, before);
  assert.deepEqual(result, simulateMatchEngine(JSON.parse(JSON.stringify(input))));
  assert.throws(() => simulateMatchEngine({ ...input, config: { ...input.config, rulesetHash: 'old' } }), /Unsupported tactical/);
});

test('held-out guide calibration exceeds 60% wins without injecting match results', () => {
  const [report] = require('./fixtures/tactical-v2-guide-validation.json');
  assert.equal(report.hash, book.hash); assert.equal(report.scenario, 'normal');
  assert.equal(report.sourceHash, require('../scripts/tactical-source-fingerprint.cjs')());
  assert.equal(report.guideHash, require('../scripts/tactical-source-fingerprint.cjs').guideHash());
  assert.equal(report.suite, 'guide'); assert.ok(report.startSeed >= 9000 && report.samples >= 64);
  assert.equal(report.pairs.length, 16); assert.equal(report.matches, report.samples * 2 * 16);
  assert.ok(report.winRate > .60 && report.winRate <= .85, `held-out win rate ${report.winRate}`);
  for (const pair of report.pairs) assert.ok(pair.wins / (report.samples * 2) > .60, `${pair.favored} vs ${pair.opponent}`);
});

test('recorded counterplay, stronger players and tired squads reduce the formation advantage', () => {
  const [normal] = require('./fixtures/tactical-v2-scenario-baseline-validation.json');
  assert.equal(normal.hash, book.hash);
  assert.equal(normal.sourceHash, require('../scripts/tactical-source-fingerprint.cjs')());
  for (const scenario of ['counterplay', 'stronger_opponent', 'tired_favored', 'weak_staff']) {
    const [report] = require(`./fixtures/tactical-v2-${scenario}-validation.json`);
    assert.equal(report.hash, book.hash); assert.equal(report.scenario, scenario);
    assert.equal(report.sourceHash, require('../scripts/tactical-source-fingerprint.cjs')());
    assert.equal(report.guideHash, require('../scripts/tactical-source-fingerprint.cjs').guideHash());
    assert.equal(report.matches, 512);
    assert.equal(report.startSeed, normal.startSeed);
    assert.equal(report.samples, normal.samples);
    assert.ok(report.winRate < normal.winRate, `${scenario} should reduce the advantage`);
    if (scenario === 'counterplay') assert.ok(report.winRate < .65);
  }
});
