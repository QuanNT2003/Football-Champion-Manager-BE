const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { validate } = require('class-validator');
const { ScheduleTrainingDto } = require('../dist/modules/training/dto');
const { TrainingService } = require('../dist/modules/training/training.service');
const { agePenalty, trainingChance, rollDrill, groupCoaches, coachTrainingSquad, recommendedStyle, recommendation, drillAttributes } = require('../dist/modules/training/training.rules');

const attributeKeys = [...new Set(Object.values(drillAttributes).flat())];
function fixture() {
  let state = {
    level: 1, fail: false,
    season: { id: 7n, world_id: 9n, status: 'ACTIVE' },
    timeline: { world_id: 9n, season_id: 7n, season_day: 8 },
    club: { id: 10n, world_id: 9n, owner_user_id: 100n },
    players: [1n, 2n].map((id, i) => ({
      id, current_club_id: 10n, first_name: 'Player', last_name: String(id), age: i ? 20 : 25, squad_type: i ? 'YOUTH_U21' : 'FIRST_TEAM', ovr: 50,
      player_attributes: { player_id: id, ...Object.fromEntries(attributeKeys.map(key => [key, 50])) },
      player_status: { player_id: id, fitness: 100, is_injured: false, is_on_national_duty: false },
      player_positions: [],
    })),
    sessions: [], history: [], participation: [], tactics: [],
    types: [
      { id: 1n, code: 'ATT_FINISHING', category: 'ATTACKING', name: 'Finishing' },
      { id: 2n, code: 'DEF_1V1_TACKLING', category: 'DEFENDING', name: 'Tackling' },
    ],
  };
  let tail = Promise.resolve();
  const staff = { staff_id: 11n, role: 'ASSISTANT_COACH', squad_type: 'FIRST_TEAM', staff: { name: 'Coach', staff_type: 'COACH', staff_attributes: { attacking: 60, defending: 80 } } };
  const staffContracts = [staff, { ...structuredClone(staff), staff_id: 12n, role: 'ASSISTANT_COACH_YOUTH', squad_type: 'YOUTH_U21' }];
  const tx = {
    $queryRaw: async () => [],
    clubs: { findUnique: async ({ where }) => where.id === state.club.id ? state.club : null },
    server_timeline: { findUnique: async ({ where }) => {
      assert.equal(where.world_id, 9n, 'uses the club world');
      return { ...state.timeline, seasons: state.season };
    } },
    facilities: { findFirst: async () => ({ facility_levels: { level: state.level } }) },
    staff_contracts: { findMany: async ({ where }) => staffContracts.filter(c => (c.status ?? 'ACTIVE') === where.status && c.staff.staff_type === where.staff.staff_type) },
    club_tactics: { findFirst: async ({ where }) => state.tactics.find(t => where.squad_type.in.includes(t.squad_type)) ?? null },
    training_types: { findMany: async () => state.types },
    attributes: { findMany: async () => attributeKeys.map((code, i) => ({ id: BigInt(i + 1), code: code.toUpperCase() })) },
    players: {
      findMany: async ({ where }) => state.players.filter(p => p.current_club_id === where.current_club_id && (!where.id || where.id.in.includes(p.id)) && (!where.squad_type || where.squad_type.in.includes(p.squad_type))),
      update: async ({ where, data }) => Object.assign(state.players.find(p => p.id === where.id), data),
    },
    player_attributes: { update: async ({ where, data }) => Object.assign(state.players.find(p => p.id === where.player_id).player_attributes, data) },
    player_status: { update: async ({ where, data }) => {
      const status = state.players.find(p => p.id === where.player_id).player_status;
      status.fitness -= data.fitness.decrement;
      return status;
    } },
    player_attribute_history: { createMany: async ({ data }) => { state.history.push(...structuredClone(data)); } },
    player_training: { create: async ({ data }) => {
      if (state.fail) throw new Error('persistence failed');
      state.participation.push(structuredClone(data));
    } },
    training_sessions: {
      create: async ({ data }) => {
        const row = { ...structuredClone(data), id: BigInt(state.sessions.length + 1) };
        state.sessions.push(row); return row;
      },
      update: async ({ where, data }) => Object.assign(state.sessions.find(s => s.id === where.id), structuredClone(data)),
      findMany: async () => state.sessions,
    },
  };
  const db = { ...tx, $transaction: work => {
    const operation = tail.then(async () => {
      const before = structuredClone(state);
      try { return await work(tx); } catch (error) { state = before; throw error; }
    });
    tail = operation.catch(() => {});
    return operation;
  } };
  return { service: new TrainingService(db), state: () => state, staff, staffContracts };
}
const plan = (playerIds = ['1'], squadType = 'FIRST_TEAM') => ({ squadType, trainingTypeIds: ['1', '2', '1', '2', '1', '2'], playerIds });

// Formula examples also pin down the overlapping age-25 boundary.
test('centre, coaching and age produce the stated probabilities', () => {
  assert.equal(trainingChance(1, 60, agePenalty(25, 'FIRST_TEAM')), 42);
  assert.equal(trainingChance(2, 60, 0), 47);
  assert.equal(trainingChance(3, 60, 0), 52);
  assert.equal(trainingChance(1, 60, agePenalty(17, 'FIRST_TEAM')), 32);
  assert.equal(trainingChance(1, 60, agePenalty(20, 'YOUTH_U21')), 32);
  assert.equal(trainingChance(1, 60, agePenalty(18, 'FIRST_TEAM')), 42);
  assert.equal(trainingChance(1, 60, agePenalty(26, 'FIRST_TEAM')), 27);
  assert.equal(trainingChance(1, 60, agePenalty(30, 'FIRST_TEAM')), 27);
  assert.equal(trainingChance(1, 60, agePenalty(31, 'FIRST_TEAM')), 17);
  assert.equal(trainingChance(1, 63, 0), 42.6);
  assert.equal(trainingChance(30, 100, 0), 100);
  assert.equal(trainingChance(1, 0, 100), 0);
});

test('coaching uses one best relevant specialist, excluding scouts and unrelated specialist roles', () => {
  const contract = (id, role, type, attacking, fitness) => ({ staff_id: BigInt(id), role, staff: { name: role, staff_type: type, staff_attributes: { attacking, fitness } } });
  const coaches = groupCoaches([
    contract(1, 'HEAD_COACH', 'COACH', 60, 40), contract(2, 'ASSISTANT_COACH', 'COACH', 70, 30),
    contract(3, 'FITNESS_COACH', 'COACH', 100, 90), contract(4, 'SCOUT', 'SCOUT', 100, 100),
  ]);
  assert.equal(coaches.ATTACKING.skill, 70);
  assert.equal(coaches.ATTACKING.bonus, 14);
  assert.equal(coaches.PHYSICAL.skill, 90);
  assert.equal(groupCoaches([]).ATTACKING.bonus, 0);
});

test('one failed drill roll prevents every target from growing', () => {
  const attributes = { fin: 50, cmp: 50, otb: 50 };
  let calls = 0;
  assert.deepEqual(rollDrill(attributes, ['fin', 'cmp', 'otb'], 42, () => { calls++; return 0.42; }), []);
  assert.equal(calls, 1);
  assert.deepEqual(attributes, { fin: 50, cmp: 50, otb: 50 });
  assert.deepEqual(rollDrill(attributes, ['fin'], 0, () => 0), []);
});

test('successful drills grant one, two or three distinct attributes, each by one point', () => {
  for (const [tier, expected] of [[0, 1], [0.8499, 1], [0.85, 2], [0.9499, 2], [0.95, 3], [0.9999, 3]]) {
    const attributes = { fin: 50, cmp: 50, otb: 50, pas: 70 };
    const draws = [0.419, tier];
    const gains = rollDrill(attributes, ['fin', 'cmp', 'otb'], 42, () => draws.shift() ?? 0.999);
    assert.equal(gains.length, expected);
    assert.equal(new Set(gains.map(g => g.attribute)).size, expected);
    assert.ok(gains.every(g => g.from === 50 && g.to === 51));
    assert.equal(attributes.pas, 70);
  }
});

test('all eligible targets can be selected; capped and duplicate targets do not create extra gains', () => {
  for (const [pick, selected] of [[0, 'fin'], [0.5, 'cmp'], [0.999, 'otb']]) {
    const draws = [0, 0, pick];
    const gains = rollDrill({ fin: 50, cmp: 50, otb: 50 }, ['fin', 'cmp', 'otb'], 100, () => draws.shift());
    assert.equal(gains[0].attribute, selected);
  }
  const attributes = { fin: 100, cmp: 99, otb: 50 };
  const draws = [0, 0.9, 0, 0];
  const gains = rollDrill(attributes, ['fin', 'cmp', 'cmp', 'otb'], 100, () => draws.shift());
  assert.equal(gains.length, 2);
  assert.deepEqual(attributes, { fin: 100, cmp: 100, otb: 51 });
  assert.deepEqual(rollDrill({ fin: 100 }, ['fin'], 100, () => { throw Error('No eligible attributes'); }), []);
});

test('42% drill success is unchanged by target count, with 85/10/5 conditional gain tiers', () => {
  for (const targets of [['fin', 'cmp', 'otb'], ['fin', 'cmp']]) {
    const counts = [0, 0, 0, 0];
    for (let successDraw = 0; successDraw < 100; successDraw++) {
      for (let tierDraw = 0; tierDraw < 100; tierDraw++) {
        const draws = [successDraw / 100, tierDraw / 100];
        const gains = rollDrill({ fin: 50, cmp: 50, otb: 50 }, targets, 42, () => draws.shift() ?? 0);
        counts[gains.length]++;
      }
    }
    assert.deepEqual(counts, targets.length === 3 ? [5800, 3570, 420, 210] : [5800, 3780, 420, 0]);
  }
});

test('recommendations follow the active tactic and always contain six editable slots', () => {
  assert.equal(recommendedStyle({ pressing_intensity: 80, passing_style: 'MIXED', mentality: 'BALANCED' }, 'TIKI_TAKA'), 'GEGENPRESSING');
  assert.equal(recommendedStyle({ pressing_intensity: 50, passing_style: 'SHORT', mentality: 'BALANCED' }, 'COUNTER_ATTACK'), 'TIKI_TAKA');
  assert.equal(recommendedStyle(null, 'CATENACCIO'), 'CATENACCIO');
  const types = Object.keys(drillAttributes).map((code, i) => ({ id: BigInt(i + 1), code }));
  for (const style of ['TIKI_TAKA', 'GEGENPRESSING', 'COUNTER_ATTACK', 'CATENACCIO', 'WING_PLAY', 'BALANCED', 'UNKNOWN']) {
    assert.equal(recommendation(style, types).length, 6);
    assert.ok(recommendation(style, types).every(Boolean));
  }
  assert.deepEqual(recommendation('BALANCED', []), Array(6).fill(''));
});

test('DTO accepts repeated drills but rejects incomplete plans, repeated players and invalid IDs', async () => {
  const errors = data => validate(Object.assign(new ScheduleTrainingDto(), data));
  assert.equal((await errors(plan())).length, 0);
  assert.ok((await errors({ ...plan(), trainingTypeIds: ['1'] })).length);
  assert.ok((await errors({ ...plan(), trainingTypeIds: Array(7).fill('1') })).length);
  assert.ok((await errors(plan(['1', '1']))).length);
  assert.ok((await errors(plan([]))).length);
  assert.ok((await errors(plan(['-1']))).length);
  assert.ok((await errors({ trainingTypeId: '1', intensity: 50 })).length);
});

test('training applies all six ordered drills, charges fitness once and persists exact gains', async () => {
  const f = fixture();
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const overview = await f.service.getOverview(100n, 10n);
    const youthOverview = await f.service.getOverview(100n, 10n, 'YOUTH');
    assert.equal(overview.players[0].chances.ATTACKING, 42);
    assert.equal(youthOverview.players[0].chances.ATTACKING, 32);
    const result = await f.service.scheduleSession(100n, 10n, plan());
    const youthResult = await f.service.scheduleSession(100n, 10n, plan(['2'], 'YOUTH'));
    const state = f.state();
    assert.equal(state.sessions.length, 2);
    assert.equal(result.session.status, 'COMPLETED');
    assert.equal(result.session.season_id, 7n);
    assert.equal(result.session.season_day, 8);
    assert.deepEqual(result.session.plan.drills.map(d => d.id), plan().trainingTypeIds);
    for (const player of state.players) {
      assert.equal(player.player_status.fitness, 88);
      assert.equal(player.player_attributes.fin, 53);
      assert.equal(player.player_attributes.tac, 53);
      assert.equal(player.player_attributes.pas, 50);
    }
    assert.equal(state.history.length, 12);
    assert.equal(state.participation.length, 2);
    assert.equal(result.session.results.players[0].drills[0].chance, overview.players[0].chances.ATTACKING);
    assert.equal(youthResult.session.results.players[0].drills[0].chance, youthOverview.players[0].chances.ATTACKING);
    assert.equal(result.session.plan.squadType, 'FIRST_TEAM');
    assert.equal(youthResult.session.plan.squadType, 'YOUTH');
    assert.equal(result.session.results.players[0].fitnessAfter, 88);
    assert.equal(result.session.plan.chanceScope, 'DRILL');
    assert.deepEqual(result.session.plan.gainCountWeights, [85, 10, 5]);
    assert.ok(result.session.results.players.every(p => p.drills.every(d => d.gains.length === 1)));
    assert.ok(state.participation.every(p => p.performance === 6));
    assert.deepEqual(await f.service.getClubSessions(100n, 10n), state.sessions);
  } finally { Math.random = originalRandom; }
});

test('rare multi-attribute drill gains persist the same changes in results, history and player attributes', async () => {
  const f = fixture();
  const originalRandom = Math.random;
  let draw = 0;
  // Three-target drills: success, highest gain tier, then three selections.
  Math.random = () => draw++ % 5 === 1 ? 0.96 : 0;
  try {
    const result = await f.service.scheduleSession(100n, 10n, plan());
    const drills = result.session.results.players[0].drills;
    assert.ok(drills.every(drill => drill.gains.length === 3));
    assert.equal(f.state().history.length, 18);
    assert.equal(f.state().participation[0].performance, 18);
    const player = f.state().players[0];
    for (const key of ['fin', 'cmp', 'otb', 'tac', 'mar', 'str']) assert.equal(player.player_attributes[key], 53);
    assert.equal(player.player_status.fitness, 88);
  } finally { Math.random = originalRandom; }
});

test('training persists weighted OVR from the preferred position and newly increased attributes', async () => {
  const f = fixture();
  const player = f.state().players[0];
  Object.assign(player.player_attributes, { fin: 80, cmp: 40, gk_ref: 10 });
  player.player_positions = [
    { is_preferred: false, positions: { position_attributes: [{ attribute_id: 999n, multiplier: 3, attributes: { code: 'GK_REF' } }] } },
    { is_preferred: true, positions: { position_attributes: [
      { attribute_id: 1n, multiplier: '3.00', attributes: { code: 'FIN' } },
      { attribute_id: 2n, multiplier: '1.00', attributes: { code: 'CMP' } },
      { attribute_id: 3n, multiplier: '0.00', attributes: { code: 'GK_REF' } },
    ] } },
  ];
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    await f.service.scheduleSession(100n, 10n, plan());
    assert.equal(player.player_attributes.fin, 83);
    assert.equal(player.player_attributes.cmp, 40);
    assert.equal(player.ovr, 72); // round((83 * 3 + 40) / 4), not average of all stats or GK position.
  } finally { Math.random = originalRandom; }
});

test('gains in zero-weight attributes do not dilute the selected position OVR', async () => {
  const f = fixture();
  const player = f.state().players[0];
  player.player_attributes.sta = 80;
  player.player_positions = [{ is_preferred: true, positions: { position_attributes: [
    { attribute_id: 1n, multiplier: 0, attributes: { code: 'FIN' } },
    { attribute_id: 2n, multiplier: 3, attributes: { code: 'STA' } },
  ] } }];
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    await f.service.scheduleSession(100n, 10n, plan());
    assert.equal(player.player_attributes.fin, 53);
    assert.equal(player.ovr, 80);
  } finally { Math.random = originalRandom; }
});

test('failed growth still costs 12 fitness and sessions have no daily quota', async () => {
  const f = fixture();
  const originalRandom = Math.random;
  Math.random = () => 0.999;
  try {
    for (let i = 0; i < 8; i++) await f.service.scheduleSession(100n, 10n, plan());
    assert.equal(f.state().sessions.length, 8);
    assert.equal(f.state().players[0].player_status.fitness, 4);
    assert.equal(f.state().history.length, 0);
    await assert.rejects(() => f.service.scheduleSession(100n, 10n, plan()), /12%/);
    assert.equal(f.state().sessions.length, 8);
  } finally { Math.random = originalRandom; }
});

test('invalid club, ownership, roster, health, fitness and inactive season produce no side effects', async () => {
  for (const scenario of ['club', 'owner', 'foreign', 'duplicate', 'missing-drill', 'injured', 'national', 'fitness', 'missing-data', 'season']) {
    const f = fixture(); let user = 100n, club = 10n, dto = plan();
    if (scenario === 'club') club = 999n;
    if (scenario === 'owner') user = 999n;
    if (scenario === 'foreign') dto.playerIds = ['999'];
    if (scenario === 'duplicate') dto.playerIds = ['1', '1'];
    if (scenario === 'missing-drill') dto.trainingTypeIds[0] = '999';
    if (scenario === 'injured') f.state().players[0].player_status.is_injured = true;
    if (scenario === 'national') f.state().players[0].player_status.is_on_national_duty = true;
    if (scenario === 'fitness') f.state().players[0].player_status.fitness = 11;
    if (scenario === 'missing-data') f.state().players[0].player_attributes = null;
    if (scenario === 'season') f.state().season.status = 'COMPLETED';
    const playersBefore = structuredClone(f.state().players);
    await assert.rejects(() => f.service.scheduleSession(user, club, dto), error => [400, 403, 404].includes(error.getStatus()), scenario);
    assert.equal(f.state().sessions.length, 0, scenario);
    assert.deepEqual(f.state().players, playersBefore, scenario);
  }
});

test('persistence failure rolls back fitness, attributes, participation and session history together', async () => {
  const f = fixture(); f.state().fail = true;
  await assert.rejects(() => f.service.scheduleSession(100n, 10n, plan()), /persistence failed/);
  assert.equal(f.state().sessions.length, 0);
  assert.equal(f.state().history.length, 0);
  assert.equal(f.state().participation.length, 0);
  assert.equal(f.state().players[0].player_status.fitness, 100);
  assert.equal(f.state().players[0].player_attributes.fin, 50);
});

test('concurrent training checks fresh fitness after serialization and cannot overspend', async () => {
  const f = fixture(); f.state().players[0].player_status.fitness = 12;
  const outcomes = await Promise.allSettled([f.service.scheduleSession(100n, 10n, plan()), f.service.scheduleSession(100n, 10n, plan())]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(f.state().players[0].player_status.fitness, 0);
  assert.equal(f.state().sessions.length, 1);
});

const { PlayersService } = require('../dist/modules/players/players.service');
const { CompetitionsService } = require('../dist/modules/competitions/competitions.service');

function playerProfileFixture(history) {
  const player = {
    id: 1n, current_club_id: 10n, world_id: 9n, first_name: 'Test', last_name: 'Player', age: 25, ovr: 55,
    player_positions: [{ is_preferred: true, positions: { code: 'ST', name: 'Striker', position_attributes: [{ attribute_id: 1n, is_key: true, multiplier: 2, order_no: 1 }] } }],
    player_attributes: { player_id: 1n, fin: 55, sta: 48 },
    player_statistics: [], match_players: [], transfers: [], player_contracts: [], injuries: [],
  };
  const prisma = {
    players: { findUnique: async ({ include }) => ({
      ...player, ...(include?.player_attribute_history ? { player_attribute_history: history } : {}),
    }) },
    player_contracts: { findFirst: async () => null },
    attributes: { findMany: async () => [
      { id: 1n, code: 'FIN', name: 'Finishing', category: 'TECHNICAL' },
      { id: 2n, code: 'STA', name: 'Stamina', category: 'PHYSICAL' },
    ] },
    seasons: { findMany: async () => [] },
    server_timeline: { findUnique: async ({ where }) => {
      assert.equal(where.world_id, 9n);
      return { season_number: 4 };
    } },
  };
  return new PlayersService(prisma);
}

test('player profile reports the net season gain beside every representation of each attribute', async () => {
  const history = [
    { attribute_id: 1n, old_value: 50, new_value: 51 },
    { attribute_id: 1n, old_value: 51, new_value: 52 },
    { attribute_id: 1n, old_value: 52, new_value: 49 },
    { attribute_id: 1n, old_value: 49, new_value: 55 },
    { attribute_id: 2n, old_value: 50, new_value: 48 },
  ];
  const profile = await playerProfileFixture(history).getPlayerById(1n, 10n);
  assert.equal(profile.skills.growth_season, 4);
  assert.equal(profile.skills.all_attributes.find(a => a.code === 'FIN').growth, '+5');
  assert.equal(profile.skills.categories.technical[0].growth, '+5');
  assert.equal(profile.skills.key_attributes[0].growth, '+5');
  assert.equal(profile.skills.left_column[0].growth, '+5');
  assert.equal(profile.skills.categories.physical[0].growth, '-2');
  assert.equal(profile.skills.all_attributes[0].value, 55);
});

test('empty or zero-net seasonal history shows no fabricated gain; outsiders do not get growth', async () => {
  const balancedHistory = [
    { attribute_id: 1n, old_value: 50, new_value: 52 },
    { attribute_id: 1n, old_value: 52, new_value: 50 },
  ];
  const noChange = await playerProfileFixture(balancedHistory).getPlayerById(1n, 10n);
  assert.equal(noChange.skills.all_attributes[0].growth, null);
  const newSeason = await playerProfileFixture([]).getPlayerById(1n, 10n);
  assert.ok(newSeason.skills.all_attributes.every(a => a.growth === null));
  const outsider = await playerProfileFixture(balancedHistory.slice(0, 1)).getPlayerById(1n, 999n);
  assert.equal(outsider.is_own_club, false);
  assert.ok(outsider.skills.all_attributes.every(a => a.growth === null));
});

function seasonTransitionFixture() {
  let history = [
    { id: 1n, world_id: 9n, attribute_id: 1n, old_value: 50, new_value: 51 },
    { id: 2n, world_id: 10n, attribute_id: 1n, old_value: 60, new_value: 62 },
  ];
  let closed = false;
  const season = { id: 7n, world_id: 9n, season_number: 4, name: 'Season 4' };
  const prisma = {
    seasons: { findUnique: async () => season, update: async () => { closed = true; } },
    player_attribute_history: { deleteMany: async ({ where } = {}) => {
      history = history.filter(row => where?.players?.world_id && row.world_id !== where.players.world_id);
      return { count: 1 };
    } },
    transfer_offers: { deleteMany: async () => ({ count: 0 }) },
  };
  const service = new CompetitionsService(prisma,
    { updateCountryRankingsForNewSeason: async () => ({}) },
    { awardSeasonTrophies: async () => ({}) },
    { expireSeason: async () => {} });
  service.processPromotionsAndRelegations = async () => ({ promotions: [], relegations: [], continentalQualifications: [], domesticCompSeasons: [] });
  const dto = { worldId: '9', completedSeasonId: '7', processContracts: false, processSuspensions: false, agePlayers: false, processAwards: false, initializeNewSeason: false, distributeFinances: false };
  return { service, dto, history: () => history, closed: () => closed };
}

test('season transition clears current-world growth while preserving a different world in mid-season', async () => {
  const f = seasonTransitionFixture();
  const result = await f.service.processSeasonTransition(f.dto);
  assert.equal(result.success, true);
  assert.equal(f.closed(), true);
  assert.deepEqual(f.history().map(row => row.id), [2n]);
});

test('a mismatched season and world cannot reset either world history', async () => {
  const f = seasonTransitionFixture();
  await assert.rejects(() => f.service.processSeasonTransition({ ...f.dto, worldId: '10' }), error => error.getStatus() === 400);
  assert.equal(f.history().length, 2);
  assert.equal(f.closed(), false);
});
const { calculateDynamicOvr } = require('../dist/modules/players/players.service');
const { Prisma } = require('@prisma/client');

test('OVR applies decimal multipliers to both flat and legacy attributes, including non-key attributes', () => {
  const config = [
    { attribute_id: 1n, multiplier: new Prisma.Decimal('3.00'), is_key: true, attributes: { code: 'FIN' } },
    { attribute_id: 2n, multiplier: new Prisma.Decimal('1.50'), is_key: false, attributes: { code: 'PAS' } },
    { attribute_id: 3n, multiplier: new Prisma.Decimal('0.00'), is_key: false, attributes: { code: 'GK_REF' } },
  ];
  const flat = { player_id: 99999999n, fin: 80, pas: 40, gk_ref: 1 };
  const legacy = [{ attribute_id: 1n, value: 80 }, { attribute_id: 2n, value: 40 }, { attribute_id: 3n, value: 1 }];
  // round((80 * 3 + 40 * 1.5) / (3 + 1.5)) = 67.
  assert.equal(calculateDynamicOvr(flat, config), 67);
  assert.equal(calculateDynamicOvr(legacy, config), 67);
});

test('OVR excludes missing attributes from the denominator and safely falls back without position configuration', () => {
  const config = [
    { attribute_id: 1n, multiplier: 3, attributes: { code: 'FIN' } },
    { attribute_id: 2n, multiplier: 1, attributes: { code: 'PAS' } },
  ];
  assert.equal(calculateDynamicOvr({ player_id: 1n, fin: 80 }, config), 80);
  assert.equal(calculateDynamicOvr({ player_id: 1n, fin: 80, pas: 40 }, []), 60);
  assert.equal(calculateDynamicOvr([{ attribute_id: 1n, value: 80 }, { attribute_id: 2n, value: 40 }], []), 60);
  assert.equal(calculateDynamicOvr(null, config), 50);
  assert.equal(calculateDynamicOvr({}, config), 50);
});

test('coaches stay with their team, including youth roles on legacy first-team-tagged contracts', () => {
  const contract = (id, role, squad_type, attacking) => ({ staff_id: BigInt(id), role, squad_type, staff: { name: role, staff_type: 'COACH', staff_attributes: { attacking } } });
  const contracts = [contract(1, 'HEAD_COACH', 'FIRST_TEAM', 50), contract(2, 'HEAD_COACH_YOUTH', 'FIRST_TEAM', 90), contract(3, 'ASSISTANT_COACH', 'YOUTH_U19', 80)];
  assert.equal(groupCoaches(contracts, 'FIRST_TEAM').ATTACKING.skill, 50);
  assert.equal(groupCoaches(contracts, 'YOUTH').ATTACKING.skill, 90);
  assert.equal(coachTrainingSquad({ role: 'FITNESS_COACH', squad_type: 'YOUTH_U21' }), 'YOUTH');
  assert.equal(coachTrainingSquad({ role: 'ASSISTANT_COACH', squad_type: 'RESERVES' }), null);
});

test('overview separates rosters, head coaches, group bonuses and active tactics by team', async () => {
  const f = fixture();
  const head = (id, role, squad_type, attacking) => ({ staff_id: BigInt(id), role, squad_type, staff: { name: role, staff_type: 'COACH', tactical_style: 'BALANCED', staff_attributes: { attacking } } });
  f.staffContracts.push(head(31, 'HEAD_COACH', 'FIRST_TEAM', 50), head(32, 'HEAD_COACH_YOUTH', 'FIRST_TEAM', 90));
  f.state().tactics = [
    { squad_type: 'FIRST_TEAM', pressing_intensity: 50, passing_style: 'SHORT', mentality: 'BALANCED' },
    { squad_type: 'YOUTH_U21', pressing_intensity: 50, passing_style: 'DIRECT', mentality: 'BALANCED' },
  ];
  const first = await f.service.getOverview(100n, 10n, 'FIRST_TEAM');
  const youth = await f.service.getOverview(100n, 10n, 'YOUTH');
  assert.deepEqual(first.players.map(p => p.id), ['1']);
  assert.deepEqual(youth.players.map(p => p.id), ['2']);
  assert.equal(first.headCoach.id, '31');
  assert.equal(youth.headCoach.id, '32');
  assert.equal(first.coaches.ATTACKING.skill, 60);
  assert.equal(youth.coaches.ATTACKING.skill, 90);
  assert.equal(first.recommendation.style, 'TIKI_TAKA');
  assert.equal(youth.recommendation.style, 'COUNTER_ATTACK');
  assert.equal(first.players[0].chances.ATTACKING, 42);
  assert.equal(youth.players[0].chances.ATTACKING, 38);
});

test('youth training records only youth participants and the youth head coach', async () => {
  const f = fixture();
  f.staffContracts.push({ staff_id: 32n, role: 'HEAD_COACH_YOUTH', squad_type: 'YOUTH_U21', staff: { name: 'Youth head', staff_type: 'COACH', tactical_style: 'BALANCED', staff_attributes: { attacking: 90 } } });
  const result = await f.service.scheduleSession(100n, 10n, plan(['2'], 'YOUTH'));
  assert.equal(result.session.coach_staff_id, 32n);
  assert.equal(result.session.plan.squadType, 'YOUTH');
  assert.deepEqual(result.session.results.players.map(p => p.id), ['2']);
  assert.equal(result.session.results.players[0].drills[0].chance, 38);
  assert.equal(f.state().players[0].player_status.fitness, 100);
  assert.equal(f.state().players[1].player_status.fitness, 88);
});

test('missing youth coaches do not borrow first-team coaching bonuses or head coach', async () => {
  const f = fixture();
  f.staffContracts.splice(1);
  const youth = await f.service.getOverview(100n, 10n, 'YOUTH');
  assert.equal(youth.headCoach, null);
  assert.equal(youth.coaches.ATTACKING.bonus, 0);
  assert.equal(youth.players[0].chances.ATTACKING, 20);
});

test('cross-team, mixed-team, missing and unsupported squad submissions have no side effects', async () => {
  for (const dto of [plan(['2']), plan(['1'], 'YOUTH'), plan(['1', '2']), plan(['1'], 'RESERVES'), { trainingTypeIds: plan().trainingTypeIds, playerIds: ['1'] }]) {
    const f = fixture();
    await assert.rejects(() => f.service.scheduleSession(100n, 10n, dto), error => error.getStatus() === 400);
    assert.equal(f.state().sessions.length, 0);
    assert.equal(f.state().players[0].player_status.fitness, 100);
    assert.equal(f.state().players[1].player_status.fitness, 100);
  }
  const f = fixture();
  await assert.rejects(() => f.service.getOverview(100n, 10n, 'RESERVES'), error => error.getStatus() === 400);
  const missingScope = { trainingTypeIds: plan().trainingTypeIds, playerIds: ['1'] };
  assert.ok((await validate(Object.assign(new ScheduleTrainingDto(), missingScope))).length);
});
