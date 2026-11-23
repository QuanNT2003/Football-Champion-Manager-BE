const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { ClubsService } = require('../dist/modules/clubs/clubs.service');
const { GameWorldService } = require('../dist/modules/game-world/game-world.service');
const { facilityUpgradeDetails, progressFacilityUpgrades, stadiumUpgradeDetails, upgradeTiming } = require('../dist/common/facility-upgrades');
const { FacilityUpgradeScheduler } = require('../dist/modules/clubs/facility-upgrade.scheduler');

function fixture() {
  let state = {
    cash: 1000000, failLedger: false, failStadiumWrite: false, upgrades: [], ledger: [], levelWrites: 0,
    stadiums: [{ id: 30n, club_id: 10n, capacity: 5000, name: 'Test Arena' }],
    club: { id: 10n, world_id: 9n, owner_user_id: 100n },
    seasons: [{ id: 7n, world_id: 9n, season_number: 1, current_day: 8, total_days: 36, status: 'ACTIVE' }],
    facilities: [1n, 2n].map(id => ({ id, club_id: 10n, facility_type_id: id, facility_level_id: id * 10n, status: 'OPERATIONAL' })),
    levels: [1n, 2n].flatMap(type => [1, 2, 3].map(level => ({ id: type * 10n + BigInt(level - 1), facility_type_id: type, level, cost: [50000, 107500, 231125][level - 1], upgrade_days: 90 }))),
  };
  const locks = [];
  const enrich = row => row && ({ ...row, facility_types: { name: 'Facility', code: 'TRAINING_GROUND' }, facility_levels: state.levels.find(level => level.id === row.facility_level_id) });
  const matchesUpgrade = (row, where) => {
    const facility = state.facilities.find(f => f.id === row.facility_id);
    const stadium = state.stadiums.find(s => s.id === row.stadium_id);
    return (!where.id || row.id === where.id) && (!where.status || row.status === where.status)
      && (!where.started_at?.lte || row.started_at <= where.started_at.lte)
      && (!where.started_at || row.started_at <= where.started_at.lte)
      && (!where.OR || where.OR.some(branch => matchesUpgrade(row, branch)))
      && (!where.facility_id || where.facility_id.in.includes(row.facility_id))
      && (!where.stadium_id || row.stadium_id === where.stadium_id)
      && (!where.facilities || Boolean(facility)
        && (!where.facilities.club_id || facility.club_id === where.facilities.club_id)
        && (!where.facilities.clubs?.world_id || (facility.world_id ?? state.club.world_id) === where.facilities.clubs.world_id))
      && (!where.stadiums || Boolean(stadium)
        && (!where.stadiums.club_id || stadium.club_id === where.stadiums.club_id)
        && (!where.stadiums.clubs?.world_id || (stadium.world_id ?? state.club.world_id) === where.stadiums.clubs.world_id));
  };
  const tx = {
    $queryRaw: async (strings) => { locks.push(strings.join('?')); return [{ id: 1n }]; },
    $executeRaw: async () => 1,
    clubs: { findUnique: async ({ where }) => where.id === state.club.id ? { ...state.club, financial_accounts: [{ id: 20n, balance_cash: state.cash }] } : null },
    stadiums: {
      findFirst: async ({ where }) => structuredClone(state.stadiums.find(s => s.club_id === where.club_id)),
      updateMany: async ({ where, data }) => {
        if (state.failStadiumWrite) throw new Error('stadium write failed');
        const row = state.stadiums.find(s => s.id === where.id && s.capacity === where.capacity);
        if (!row) return { count: 0 };
        row.capacity += data.capacity.increment; return { count: 1 };
      },
    },
    seasons: {
      findFirst: async ({ where }) => structuredClone(state.seasons.find(s => s.world_id === where.world_id && s.status === where.status)),
      findMany: async ({ where }) => state.seasons.filter(s => s.world_id === where.world_id),
      updateMany: async ({ where, data }) => {
        const row = state.seasons.find(s => s.id === where.id && s.current_day === where.current_day && s.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data); return { count: 1 };
      },
    },
    facilities: {
      findUnique: async ({ where }) => enrich(state.facilities.find(f => f.id === where.id)),
      update: async ({ where, data }) => {
        const row = state.facilities.find(f => f.id === where.id);
        if (data.facility_level_id) state.levelWrites++;
        Object.assign(row, data); return enrich(row);
      },
    },
    facility_levels: {
      findFirst: async ({ where }) => state.levels.find(l => l.facility_type_id === where.facility_type_id && l.level === where.level),
      findMany: async ({ where }) => state.levels.filter(l => where.facility_type_id.in.includes(l.facility_type_id)),
    },
    financial_accounts: { updateMany: async ({ where, data }) => {
      if (state.cash < where.balance_cash.gte) return { count: 0 };
      state.cash -= data.balance_cash.decrement; return { count: 1 };
    } },
    financial_transactions: { create: async ({ data }) => {
      if (state.failLedger) throw new Error('ledger unavailable');
      state.ledger.push(data); return data;
    } },
    transfer_offers: { updateMany: async () => ({ count: 0 }) },
    facility_upgrades: {
      findFirst: async ({ where }) => state.upgrades.find(row => matchesUpgrade(row, where)),
      findMany: async ({ where, include, select }) => state.upgrades.filter(row => matchesUpgrade(row, where)).map(row => ({ ...row,
        ...(select ? { facilities: state.facilities.find(f => f.id === row.facility_id) ?? null, stadiums: state.stadiums.find(s => s.id === row.stadium_id) ?? null } : {}),
        ...(include ? { facility_levels_facility_upgrades_to_level_idTofacility_levels: state.levels.find(l => l.id === row.to_level_id) } : {}),
      })),
      count: async ({ where }) => state.upgrades.filter(row => matchesUpgrade(row, where)).length,
      create: async ({ data }) => {
        const row = { id: BigInt(state.upgrades.length + 1), facility_id: null, stadium_id: null, from_level_id: null, to_level_id: null, from_capacity: null, to_capacity: null, ...data };
        assert.notEqual(row.facility_id == null, row.stadium_id == null, 'each shared history row references exactly one construction target');
        state.upgrades.push(row); return row;
      },
      updateMany: async ({ where, data }) => {
        const row = state.upgrades.find(row => matchesUpgrade(row, where));
        if (!row) return { count: 0 };
        Object.assign(row, data); return { count: 1 };
      },
    },
  };
  let tail = Promise.resolve();
  const prisma = { ...tx, $transaction: async work => {
    const previous = tail;
    let release; tail = new Promise(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone(state);
    try { return await work(tx); }
    catch (error) { state = snapshot; throw error; }
    finally { release(); }
  } };
  const competitions = {
    progressKnockoutStages: async () => ({ progressedCount: 0 }),
    checkAndAwardCompletedCompetitions: async () => ({ awardedCount: 0 }),
    processSeasonTransition: async () => {
      const old = state.seasons.find(s => s.status === 'ACTIVE');
      old.status = 'COMPLETED';
      state.seasons.push({ ...old, id: 900n, season_number: old.season_number + 1, current_day: 1, status: 'ACTIVE' });
      return { nextSeason: { seasonNumber: old.season_number + 1 }, summary: 'test rollover' };
    },
  };
  return {
    get state() { return state; }, tx, prisma, locks,
    clubs: new ClubsService(prisma), world: new GameWorldService(prisma, competitions), scheduler: new FacilityUpgradeScheduler(prisma),
    elapsed: async (hours, worldId = 9n) => {
      const now = new Date(state.upgrades[0].started_at.getTime() + hours * 3600000);
      await prisma.$transaction(tx => progressFacilityUpgrades(tx, worldId, now));
      return now;
    },
    level: id => enrich(state.facilities.find(f => f.id === id)).facility_levels.level,
  };
}

test('charges the next-level price once and keeps the existing level for a full 48 hours', async () => {
  const f = fixture();
  const result = await f.clubs.upgradeFacility(100n, 10n, 1n);
  assert.equal(result.cost, 107500);
  assert.equal(result.remaining_cash, 892500);
  assert.equal(result.days_remaining, 2);
  assert.equal(f.level(1n), 1);
  assert.equal(f.state.facilities[0].status, 'UPGRADING');
  assert.equal(f.state.ledger.length, 1);
  assert.equal(f.state.upgrades[0].status, 'IN_PROGRESS');
  assert.match(f.locks[0], /clubs.*FOR UPDATE/);
  assert.match(f.locks[1], /seasons.*FOR UPDATE/);
  await f.elapsed(24);
  assert.equal(f.state.upgrades[0].days_remaining, 1);
  assert.equal(f.level(1n), 1);
  await f.elapsed(48);
  assert.equal(f.level(1n), 2);
  assert.equal(f.state.facilities[0].status, 'OPERATIONAL');
  assert.equal(f.state.upgrades[0].status, 'COMPLETED');
  assert.ok(f.state.upgrades[0].completed_at);
  assert.equal(f.state.cash, 892500);
  assert.equal(f.state.ledger.length, 1);
  const completedFacility = await f.tx.facilities.findUnique({ where: { id: 1n } });
  assert.equal((await facilityUpgradeDetails(f.tx, [completedFacility])).get(1n).upgrade_cost, 231125);
  await f.clubs.upgradeFacility(100n, 10n, 2n);
  assert.equal(f.state.upgrades.length, 2, 'another building is available only after completion');
});

test('simultaneous requests for different buildings allow only one construction and one charge', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.clubs.upgradeFacility(100n, 10n, 1n), f.clubs.upgradeFacility(100n, 10n, 2n)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.getStatus(), 409);
  assert.equal(f.state.upgrades.length, 1);
  assert.equal(f.state.ledger.length, 1);
  assert.equal(f.state.cash, 892500);
});

test('repeated requests for the same building cannot charge or queue it twice', async () => {
  const f = fixture();
  await f.clubs.upgradeFacility(100n, 10n, 1n);
  await assert.rejects(f.clubs.upgradeFacility(100n, 10n, 1n), /đang nâng cấp/);
  assert.equal(f.state.cash, 892500);
  assert.equal(f.state.upgrades.length, 1);
});

test('insufficient funds, wrong owner, foreign building and max level make no changes', async () => {
  for (const scenario of ['funds', 'owner', 'foreign', 'max']) {
    const f = fixture();
    if (scenario === 'funds') f.state.cash = 1;
    if (scenario === 'foreign') f.state.facilities[0].club_id = 99n;
    if (scenario === 'max') f.state.facilities[0].facility_level_id = 12n;
    const cash = f.state.cash;
    await assert.rejects(f.clubs.upgradeFacility(scenario === 'owner' ? 99n : 100n, 10n, 1n));
    assert.equal(f.state.cash, cash);
    assert.equal(f.state.upgrades.length, 0);
    assert.equal(f.state.ledger.length, 0);
  }
});

test('ledger failure rolls back the debit, construction record and facility status', async () => {
  const f = fixture(); f.state.failLedger = true;
  await assert.rejects(f.clubs.upgradeFacility(100n, 10n, 1n), /ledger unavailable/);
  assert.equal(f.state.cash, 1000000);
  assert.equal(f.state.upgrades.length, 0);
  assert.equal(f.state.facilities[0].status, 'OPERATIONAL');
});

test('repeating checks at the same real time cannot complete early or apply a level twice', async () => {
  const f = fixture(); await f.clubs.upgradeFacility(100n, 10n, 1n);
  for (let i = 0; i < 3; i++) await f.elapsed(24);
  assert.equal(f.state.upgrades[0].days_remaining, 1);
  assert.equal(f.level(1n), 1);
  for (let i = 0; i < 3; i++) await f.elapsed(48);
  assert.equal(f.level(1n), 2);
  assert.equal(f.state.levelWrites, 1);
});

test('simultaneous advances of the same game day cannot shorten construction', async () => {
  const f = fixture(); await f.clubs.upgradeFacility(100n, 10n, 1n);
  const results = await Promise.allSettled([f.world.advanceDay(9n), f.world.advanceDay(9n)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  assert.equal(f.level(1n), 1);
});

test('manual day advancement and season rollover do not shorten the 48-hour duration', async () => {
  const f = fixture(); f.state.seasons[0].current_day = 36;
  await f.clubs.upgradeFacility(100n, 10n, 1n);
  assert.equal(f.state.upgrades[0].completion_season_day, null);
  await f.world.advanceDay(9n);
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  assert.equal(f.level(1n), 1);
  await f.world.advanceDay(9n);
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  assert.equal(f.level(1n), 1);
  await f.elapsed(48);
  assert.equal(f.state.upgrades[0].days_remaining, 0);
  assert.equal(f.level(1n), 2);
});

test('advancing another world cannot affect construction', async () => {
  const f = fixture(); await f.clubs.upgradeFacility(100n, 10n, 1n);
  await f.elapsed(48, 999n);
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  assert.equal(f.level(1n), 1);
});

test('API metadata exposes actual next price, fixed duration, maximum and remaining construction', async () => {
  const f = fixture();
  const rows = await Promise.all(f.state.facilities.map(row => f.tx.facilities.findUnique({ where: { id: row.id } })));
  let data = (await facilityUpgradeDetails(f.tx, rows)).get(1n);
  assert.equal(data.upgrade_cost, 107500);
  assert.equal(data.upgrade_days, 2, 'ignores obsolete 90-day configuration');
  assert.equal(data.max_level, 3);
  assert.equal(data.active_upgrade, null);
  await f.clubs.upgradeFacility(100n, 10n, 1n);
  data = (await facilityUpgradeDetails(f.tx, rows)).get(1n);
  assert.equal(data.active_upgrade.days_remaining, 2);
  assert.equal(data.active_upgrade.target_level, 2);
  f.state.facilities[0].facility_level_id = 12n;
  const max = await f.tx.facilities.findUnique({ where: { id: 1n } });
  assert.equal((await facilityUpgradeDetails(f.tx, [max])).get(1n).upgrade_cost, null);
});

test('stadium expansion charges exactly 10M and adds 5000 seats only after a full 48 hours', async () => {
  const f = fixture(); f.state.cash = 25000000; f.state.stadiums[0].capacity = 12345;
  const result = await f.clubs.upgradeStadium(100n, 10n);
  assert.equal(result.cost, 10000000);
  assert.equal(result.remaining_cash, 15000000);
  assert.equal(result.from_capacity, 12345);
  assert.equal(result.to_capacity, 17345);
  assert.equal(f.state.stadiums[0].capacity, 12345);
  assert.equal(f.state.upgrades[0].status, 'IN_PROGRESS');
  assert.equal(f.state.ledger[0].reference_type, 'STADIUM');
  assert.equal(f.state.ledger[0].amount, 10000000);
  await f.elapsed(24);
  assert.equal(f.state.stadiums[0].capacity, 12345);
  assert.equal(f.state.upgrades[0].days_remaining, 1);
  await f.elapsed(48);
  assert.equal(f.state.stadiums[0].capacity, 17345);
  assert.equal(f.state.upgrades[0].status, 'COMPLETED');
  assert.ok(f.state.upgrades[0].completed_at);
  await f.elapsed(49);
  assert.equal(f.state.stadiums[0].capacity, 17345, 'retry cannot add another 5000');
  assert.equal(f.state.ledger.length, 1);
  assert.equal(f.state.cash, 15000000);
  const next = await f.clubs.upgradeStadium(100n, 10n);
  assert.equal(next.cost, 10000000);
  assert.equal(next.to_capacity, 22345, 'repeat expansions have the same fee and increment');
});

test('simultaneous stadium and facility upgrades share one construction slot in either order', async () => {
  for (const stadiumFirst of [true, false]) {
    const f = fixture(); f.state.cash = 30000000;
    const requests = stadiumFirst
      ? [() => f.clubs.upgradeStadium(100n, 10n), () => f.clubs.upgradeFacility(100n, 10n, 1n)]
      : [() => f.clubs.upgradeFacility(100n, 10n, 1n), () => f.clubs.upgradeStadium(100n, 10n)];
    const results = await Promise.allSettled(requests.map(work => work()));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.getStatus(), 409);
    assert.equal(f.state.upgrades.length, 1);
    assert.equal(f.state.ledger.length, 1);
  }
});

test('duplicate stadium requests charge once and reject the second construction', async () => {
  const f = fixture(); f.state.cash = 30000000;
  const results = await Promise.allSettled([f.clubs.upgradeStadium(100n, 10n), f.clubs.upgradeStadium(100n, 10n)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.cash, 20000000);
  assert.equal(f.state.upgrades.length, 1);
});

test('stadium expansion rejects insufficient cash, wrong ownership and missing stadium without charging', async () => {
  for (const scenario of ['funds', 'owner', 'missing']) {
    const f = fixture(); f.state.cash = scenario === 'funds' ? 9999999 : 30000000;
    if (scenario === 'missing') f.state.stadiums = [];
    const original = f.state.cash;
    await assert.rejects(f.clubs.upgradeStadium(scenario === 'owner' ? 99n : 100n, 10n));
    assert.equal(f.state.cash, original);
    assert.equal(f.state.upgrades.length, 0);
    assert.equal(f.state.ledger.length, 0);
  }
});

test('stadium ledger failure rolls back debit and history atomically', async () => {
  const f = fixture(); f.state.cash = 30000000; f.state.failLedger = true;
  await assert.rejects(f.clubs.upgradeStadium(100n, 10n), /ledger unavailable/);
  assert.equal(f.state.cash, 30000000);
  assert.equal(f.state.upgrades.length, 0);
  assert.equal(f.state.stadiums[0].capacity, 5000);
});

test('stadium construction survives rollover, stays world-scoped and exposes persisted metadata', async () => {
  const f = fixture(); f.state.cash = 30000000; f.state.seasons[0].current_day = 36;
  await f.clubs.upgradeStadium(100n, 10n);
  let details = await stadiumUpgradeDetails(f.tx, f.state.stadiums[0]);
  assert.equal(details.upgrade_cost, 10000000);
  assert.equal(details.capacity_increment, 5000);
  assert.equal(details.next_capacity, 10000);
  assert.equal(details.completed_expansions, 0);
  assert.equal(details.active_upgrade.days_remaining, 2);
  await f.prisma.$transaction(tx => progressFacilityUpgrades(tx, 999n));
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  await f.world.advanceDay(9n);
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  await f.elapsed(24);
  assert.equal(f.state.upgrades[0].days_remaining, 1);
  await f.elapsed(48);
  details = await stadiumUpgradeDetails(f.tx, f.state.stadiums[0]);
  assert.equal(details.active_upgrade, null);
  assert.equal(details.completed_expansions, 1);
  assert.equal(details.next_capacity, 15000);
});

test('a failed capacity write rolls back completion and can be retried', async () => {
  const f = fixture(); f.state.cash = 30000000;
  await f.clubs.upgradeStadium(100n, 10n);
  await f.elapsed(24);
  f.state.failStadiumWrite = true;
  await assert.rejects(f.elapsed(48), /stadium write failed/);
  assert.equal(f.state.seasons[0].current_day, 8);
  assert.equal(f.state.upgrades[0].status, 'IN_PROGRESS');
  assert.equal(f.state.upgrades[0].days_remaining, 1);
  assert.equal(f.state.stadiums[0].capacity, 5000);
});

test('shared history keeps stadium and facility metadata separate and resumes the next construction', async () => {
  const f = fixture(); f.state.cash = 30000000;
  await f.clubs.upgradeStadium(100n, 10n);
  const stadiumRow = f.state.upgrades[0];
  assert.equal(stadiumRow.stadium_id, 30n);
  assert.equal(stadiumRow.facility_id, null);
  assert.equal(stadiumRow.from_level_id, null);
  assert.equal(stadiumRow.to_level_id, null);
  const facility = await f.tx.facilities.findUnique({ where: { id: 1n } });
  assert.equal((await facilityUpgradeDetails(f.tx, [facility])).get(1n).active_upgrade, null);
  await f.elapsed(24);
  await f.elapsed(48);
  await f.clubs.upgradeFacility(100n, 10n, 1n);
  assert.equal(f.state.upgrades.length, 2, 'both types use the same history collection');
  const facilityRow = f.state.upgrades[1];
  assert.equal(facilityRow.stadium_id, null);
  assert.equal(facilityRow.facility_id, 1n);
  assert.equal(facilityRow.from_capacity, null);
  assert.equal(facilityRow.to_capacity, null);
  const stadiumDetails = await stadiumUpgradeDetails(f.tx, f.state.stadiums[0]);
  assert.equal(stadiumDetails.active_upgrade, null);
  assert.equal(stadiumDetails.completed_expansions, 1);
  assert.equal((await facilityUpgradeDetails(f.tx, [facility])).get(1n).active_upgrade.target_level, 2);
});

test('starting at 23:00 still has 47 hours left at midnight and finishes exactly 48 hours later', async () => {
  const f = fixture(); await f.clubs.upgradeFacility(100n, 10n, 1n);
  f.state.upgrades[0].started_at = new Date('2026-11-23T23:00:00+07:00');
  const atMidnight = upgradeTiming(f.state.upgrades[0], new Date('2026-11-24T00:00:00+07:00'));
  assert.equal(atMidnight.remaining_seconds, 47 * 3600);
  assert.equal(atMidnight.days_remaining, 2);
  assert.equal(atMidnight.completes_at, '2026-11-25T16:00:00.000Z');
  await f.elapsed(1);
  assert.equal(f.state.upgrades[0].status, 'IN_PROGRESS');
  assert.equal(f.level(1n), 1);
  await f.elapsed(48 - 1 / 3600000);
  assert.equal(f.state.upgrades[0].status, 'IN_PROGRESS', 'one millisecond before the deadline is still too early');
  await f.elapsed(48);
  assert.equal(f.level(1n), 2);
  assert.equal(f.state.upgrades[0].completed_at.toISOString(), '2026-11-25T16:00:00.000Z');
});

test('API timing is derived from timestamps even when the stored day counter is stale', async () => {
  const f = fixture(); await f.clubs.upgradeFacility(100n, 10n, 1n);
  f.state.upgrades[0].started_at = new Date(Date.now() - 3600000);
  f.state.upgrades[0].days_remaining = 1;
  const facility = await f.tx.facilities.findUnique({ where: { id: 1n } });
  const active = (await facilityUpgradeDetails(f.tx, [facility])).get(1n).active_upgrade;
  assert.equal(active.days_remaining, 2);
  assert.ok(active.remaining_seconds <= 47 * 3600 && active.remaining_seconds >= 47 * 3600 - 2);
  assert.equal(Date.parse(active.completes_at) - Date.parse(active.started_at), 48 * 3600000);
});

test('startup completes overdue construction without advancing game days or requiring an active season', async () => {
  const f = fixture(); f.state.cash = 30000000;
  await f.clubs.upgradeStadium(100n, 10n);
  f.state.upgrades[0].started_at = new Date(Date.now() - 49 * 3600000);
  f.state.seasons = [];
  f.state.club.world_id = 88n;
  await f.scheduler.onApplicationBootstrap();
  assert.equal(f.state.stadiums[0].capacity, 10000);
  assert.equal(f.state.upgrades[0].status, 'COMPLETED');
  assert.equal(f.state.ledger.length, 1);
  await f.scheduler.onApplicationBootstrap();
  assert.equal(f.state.stadiums[0].capacity, 10000);
});

test('two scheduler instances cannot add stadium seats twice', async () => {
  const f = fixture(); f.state.cash = 30000000;
  await f.clubs.upgradeStadium(100n, 10n);
  const now = new Date(f.state.upgrades[0].started_at.getTime() + 48 * 3600000);
  const other = new FacilityUpgradeScheduler(f.prisma);
  await Promise.all([f.scheduler.process(now), other.process(now)]);
  assert.equal(f.state.stadiums[0].capacity, 10000);
  assert.equal(f.state.upgrades[0].status, 'COMPLETED');
  assert.equal(f.state.ledger.length, 1);
});

test('the minute scheduler leaves construction unchanged at midnight and retries a failed completion', async () => {
  const f = fixture(); f.state.cash = 30000000;
  await f.clubs.upgradeStadium(100n, 10n);
  f.state.upgrades[0].started_at = new Date('2026-11-23T23:00:00+07:00');
  await f.scheduler.process(new Date('2026-11-24T00:00:00+07:00'));
  assert.equal(f.state.upgrades[0].days_remaining, 2);
  assert.equal(f.state.stadiums[0].capacity, 5000);
  const errors = [];
  f.scheduler.logger = { error: (...args) => errors.push(args) };
  f.state.failStadiumWrite = true;
  const deadline = new Date('2026-11-25T23:00:00+07:00');
  await f.scheduler.process(deadline);
  assert.equal(errors.length, 1);
  assert.equal(f.state.upgrades[0].status, 'IN_PROGRESS');
  assert.equal(f.state.stadiums[0].capacity, 5000);
  f.state.failStadiumWrite = false;
  await f.scheduler.process(deadline);
  assert.equal(f.state.upgrades[0].status, 'COMPLETED');
  assert.equal(f.state.stadiums[0].capacity, 10000);
});

test('starting another job settles an expired construction before checking the shared slot', async () => {
  const f = fixture(); f.state.cash = 30000000;
  await f.clubs.upgradeStadium(100n, 10n);
  f.state.upgrades[0].started_at = new Date(Date.now() - 49 * 3600000);
  await f.clubs.upgradeFacility(100n, 10n, 1n);
  assert.equal(f.state.stadiums[0].capacity, 10000);
  assert.equal(f.state.upgrades[0].status, 'COMPLETED');
  assert.equal(f.state.upgrades[1].status, 'IN_PROGRESS');
  assert.equal(f.state.cash, 19892500);
});
