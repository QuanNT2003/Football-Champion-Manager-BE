const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { AcademyService } = require('../dist/modules/academy/academy.service');
const { academyRules, generateCandidate } = require('../dist/modules/academy/academy.rules');
const { TransfersService } = require('../dist/modules/transfers/transfers.service');

function fixture() {
  let state = {
    level: 1, hasCurrency: true,
    season: { id: 1n, world_id: 1n, status: 'ACTIVE', season_number: 1, name: 'Season 1', total_days: 36, start_date: new Date('2026-11-01Z'), is_transfer_window_open: true },
    timeline: { season_id: 1n, season_day: 1, world_id: 1n, real_date: new Date('2026-11-01Z'), is_transfer_window_open: true },
    intakes: [], candidates: [], players: [], news: [],
  };
  let tail = Promise.resolve();
  const club = () => ({ id: 10n, world_id: 1n, owner_user_id: 100n, country_id: 3n, facilities: [{ facility_levels: { level: state.level } }] });
  const candidateMatches = (candidate, where) => {
    for (const key of ['id', 'status', 'youth_intake_id', 'signed_player_id']) {
      if (key in where && candidate[key] !== where[key]) return false;
    }
    if (where.youth_intakes) {
      const intake = state.intakes.find(row => row.id === candidate.youth_intake_id);
      for (const key of ['club_id', 'season_id']) if (key in where.youth_intakes && intake[key] !== where.youth_intakes[key]) return false;
      if (where.youth_intakes.seasons && !(intake.season_id < state.season.id)) return false;
    }
    return true;
  };
  const tx = {
    $queryRaw: async () => [{ id: 1n }],
    clubs: {
      findUnique: async ({ where }) => where.id === 10n ? club() : null,
      findMany: async () => state.intakes.some(row => row.club_id === 10n && row.season_id === state.season.id) ? [] : [club()],
    },
    seasons: { findUnique: async () => state.season, findMany: async () => [state.season] },
    server_timeline: { findUnique: async () => ({ ...state.timeline, seasons: { ...state.season } }) },
    positions: { findMany: async () => [{ id: 1n, code: 'GK' }, { id: 2n, code: 'ST' }] },
    currencies: { findFirst: async () => state.hasCurrency ? { id: 1n } : null },
    youth_intakes: {
      findUnique: async ({ where }) => state.intakes.find(row => row.club_id === where.club_id_season_id.club_id && row.season_id === where.club_id_season_id.season_id) ?? null,
      create: async ({ data }) => {
        const row = { id: BigInt(state.intakes.length + 1), quality_rating: 0, ...data };
        state.intakes.push(row);
        return row;
      },
      createMany: async ({ data }) => {
        for (const row of data) {
          if (!state.intakes.some(intake => intake.club_id === row.club_id && intake.season_id === row.season_id)) await tx.youth_intakes.create({ data: row });
        }
        return { count: data.length };
      },
      update: async ({ where, data }) => Object.assign(state.intakes.find(row => row.id === where.id), data),
      updateMany: async ({ where, data }) => {
        const rows = state.intakes.filter(row => row.season_id === where.season_id);
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    youth_intake_candidates: {
      count: async ({ where }) => state.candidates.filter(row => candidateMatches(row, where)).length,
      createMany: async ({ data }) => {
        state.candidates.push(...data.map((row, i) => ({ id: BigInt(state.candidates.length + i + 1), status: 'AVAILABLE', signed_player_id: null, ...structuredClone(row) })));
        return { count: data.length };
      },
      findMany: async ({ where }) => state.candidates.filter(row => candidateMatches(row, where)).map(row => ({ ...row, countries: { id: 3n, name: 'England', code: 'ENG' }, positions: { code: 'ST', name: 'Striker' } })),
      findFirst: async ({ where }) => state.candidates.find(row => candidateMatches(row, where)) ?? null,
      updateMany: async ({ where, data }) => {
        const rows = state.candidates.filter(row => candidateMatches(row, where));
        rows.forEach(row => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }) => Object.assign(state.candidates.find(row => row.id === where.id), data),
    },
    players: {
      findMany: async () => state.players,
      create: async ({ data }) => {
        const row = { id: BigInt(1000 + state.players.length), ...structuredClone(data), player_positions: [{ positions: { code: 'ST' } }] };
        state.players.push(row);
        return row;
      },
    },
    club_news: { create: async ({ data }) => { state.news.push(data); return data; } },
  };
  const prisma = {
    ...tx,
    $transaction: async work => {
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await previous;
      const before = structuredClone(state);
      try { return await work(tx); }
      catch (error) { state = before; throw error; }
      finally { release(); }
    },
  };
  return { service: new AcademyService(prisma), state: () => state, tx };
}

test('candidate counts follow the even-level rule through level 10', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => academyRules(i + 1).candidateCount), [5, 6, 6, 7, 7, 8, 8, 9, 9, 10]);
  assert.equal(academyRules(99).eliteProbability, 0.3);
});

test('renewing an academy contract extends its existing dates and season numbers', async () => {
  const contract = {
    id: 100n, player_id: 1n, club_id: 10n, status: 'ACTIVE', is_loan_contract: false,
    squad_role: 'ACADEMY', end_season_id: 3n, end_date: new Date('2030-04-01T00:00:00Z'), salary: 300,
  };
  const transfers = new TransfersService({ player_contracts: {
    findFirst: async () => contract,
    update: async ({ data }) => Object.assign(contract, data),
  } });
  await transfers.renewPlayerContract(1n, { additional_seasons: 2, proposed_wage: 400, club_id: '10' });
  assert.equal(contract.end_season_id, 5n);
  assert.equal(contract.end_date.getTime(), Date.parse('2030-04-01T00:00:00Z') + 72 * 86400000);
  assert.equal(contract.salary, 400);
});

test('generated players stay 14-16, OVR <= potential, with fixed full profiles and capped elite odds', () => {
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let level = 1; level <= 10; level++) {
    let elite = 0;
    for (let i = 0; i < 2000; i++) {
      const candidate = generateCandidate(level, 3n, 1, { id: 1n, code: 'GK' }, random);
      assert.ok(candidate.age >= 14 && candidate.age <= 16);
      assert.ok(candidate.ovr <= candidate.potential && candidate.potential <= 99);
      const profile = candidate.profile_data;
      assert.equal(Object.values(profile.attributes).reduce((a, b) => a + b, 0) / 28, candidate.ovr);
      assert.equal(Object.keys(profile.mentality).length, 11);
      assert.equal(Object.keys(profile.tactics).length, 13);
      elite += Number(candidate.potential >= 80);
    }
    assert.ok(Math.abs(elite / 2000 - academyRules(level).eliteProbability) < 0.03);
  }
});

test('reopening recruitment preserves candidate IDs and all generated data', async () => {
  const f = fixture();
  const first = await f.service.getRecruitment(100n, 10n);
  const profiles = structuredClone(f.state().candidates);
  assert.equal(first.candidates.length, 5);
  assert.deepEqual(await f.service.getRecruitment(100n, 10n), first);
  assert.deepEqual(f.state().candidates, profiles);
  assert.equal(f.state().intakes.length, 1);
});

test('season initialization snapshots the academy before the recruitment button is used', async () => {
  const f = fixture();
  await f.service.initializeSeason(1n);
  f.state().level = 10;
  await f.service.initializeSeason(1n);
  const overview = await f.service.getOverview(100n, 10n);
  assert.equal(overview.academyLevel, 10);
  assert.equal(overview.intakeLevel, 1);
  assert.equal((await f.service.getRecruitment(100n, 10n)).candidates.length, 5);
});

test('signing removes exactly one candidate and creates a complete U21 player from the snapshot', async () => {
  const f = fixture();
  const pool = await f.service.getRecruitment(100n, 10n);
  const before = structuredClone(f.state().candidates[0]);
  const result = await f.service.signCandidate(100n, 10n, pool.candidates[0].id);
  assert.equal(result.remainingCandidates, 4);
  const player = f.state().players[0];
  assert.equal(player.squad_type, 'YOUTH_U21');
  assert.equal(player.current_club_id, 10n);
  assert.equal(player.ovr, before.ovr);
  assert.equal(player.potential, before.potential);
  assert.deepEqual(player.player_attributes.create, before.profile_data.attributes);
  assert.deepEqual(player.player_mentality.create, before.profile_data.mentality);
  assert.deepEqual(player.player_tactics.create, before.profile_data.tactics);
  assert.equal(player.player_contracts.create.salary, before.profile_data.weekly_wage);
  assert.equal(player.player_contracts.create.status, 'ACTIVE');
  assert.equal(f.state().intakes[0].player_count, 5);
  assert.equal(f.state().candidates[0].signed_player_id, player.id);
  assert.equal((await f.service.getRecruitment(100n, 10n)).candidates.length, 4);
});

test('simultaneous signing requests produce one player and one conflict', async () => {
  const f = fixture();
  const pool = await f.service.getRecruitment(100n, 10n);
  const results = await Promise.allSettled([f.service.signCandidate(100n, 10n, pool.candidates[0].id), f.service.signCandidate(100n, 10n, pool.candidates[0].id)]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(results.find(row => row.status === 'rejected').reason.getStatus(), 409);
  assert.equal(f.state().players.length, 1);
});

test('closing either transfer-window flag blocks both opening and signing', async () => {
  for (const source of ['timeline', 'season']) {
    const f = fixture();
    const pool = await f.service.getRecruitment(100n, 10n);
    f.state()[source].is_transfer_window_open = false;
    assert.equal((await f.service.getOverview(100n, 10n)).canRecruit, false);
    await assert.rejects(() => f.service.getRecruitment(100n, 10n), error => error.getStatus() === 400);
    await assert.rejects(() => f.service.signCandidate(100n, 10n, pool.candidates[0].id), error => error.getStatus() === 400);
    assert.equal(f.state().players.length, 0);
  }
});

test('the midseason window reuses the depleted pool', async () => {
  const f = fixture();
  const pool = await f.service.getRecruitment(100n, 10n);
  await f.service.signCandidate(100n, 10n, pool.candidates[0].id);
  f.state().timeline.season_day = 18;
  const midseason = await f.service.getRecruitment(100n, 10n);
  assert.deepEqual(midseason.candidates, pool.candidates.slice(1));
});

test('an exhausted pool never replenishes when reopened', async () => {
  const f = fixture();
  const pool = await f.service.getRecruitment(100n, 10n);
  for (const candidate of pool.candidates) await f.service.signCandidate(100n, 10n, candidate.id);
  assert.equal((await f.service.getRecruitment(100n, 10n)).candidates.length, 0);
  assert.equal((await f.service.getOverview(100n, 10n)).canRecruit, false);
  assert.equal(f.state().players.length, 5);
});

test('other managers and candidates outside the current intake are rejected', async () => {
  const f = fixture();
  await assert.rejects(() => f.service.getOverview(999n, 10n), error => error.getStatus() === 403);
  await f.service.getRecruitment(100n, 10n);
  f.state().intakes[0].club_id = 20n;
  await assert.rejects(() => f.service.signCandidate(100n, 10n, 1n), error => error.getStatus() === 404);
  assert.equal(f.state().players.length, 0);
});

test('failure after claiming a candidate rolls back signing and leaves the pool unchanged', async () => {
  const f = fixture();
  const pool = await f.service.getRecruitment(100n, 10n);
  f.state().hasCurrency = false;
  await assert.rejects(() => f.service.signCandidate(100n, 10n, pool.candidates[0].id));
  assert.equal(f.state().players.length, 0);
  assert.equal(f.state().candidates[0].status, 'AVAILABLE');
  assert.equal((await f.service.getRecruitment(100n, 10n)).candidates.length, 5);
});

test('season rollover expires unsigned candidates, preserves signed players, and uses upgraded facilities', async () => {
  const f = fixture();
  const pool = await f.service.getRecruitment(100n, 10n);
  await f.service.signCandidate(100n, 10n, pool.candidates[0].id);
  await f.service.expireSeason(1n);
  f.state().season.id = 2n;
  f.state().season.season_number = 2;
  f.state().timeline.season_id = 2n;
  f.state().level = 10;
  await f.service.initializeSeason(2n);
  assert.equal(f.state().candidates.filter(row => row.status === 'EXPIRED').length, 4);
  assert.equal(f.state().candidates.filter(row => row.status === 'SIGNED').length, 1);
  assert.equal(f.state().players.length, 1);
  const next = await f.service.getRecruitment(100n, 10n);
  assert.equal(next.candidates.length, 10);
  assert.ok(next.candidates.every(row => !pool.candidates.some(old => old.id === row.id)));
  await assert.rejects(() => f.service.signCandidate(100n, 10n, pool.candidates[1].id), error => error.getStatus() === 404);
});
