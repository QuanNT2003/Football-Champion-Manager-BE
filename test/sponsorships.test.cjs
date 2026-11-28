const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { SponsorshipsService } = require('../dist/modules/finances/sponsorships.service');
const { selectSponsors, rollSponsorshipAmount, sponsorshipProfile } = require('../dist/modules/finances/sponsorship.rules');

function fixture() {
  let state = {
    club: { id: 10n, world_id: 9n, owner_user_id: 100n, reputation: 3000 },
    season: { id: 7n, world_id: 9n, season_number: 1, name: 'Season 1', start_date: new Date('2026-01-01'), end_date: null, current_day: 8, status: 'ACTIVE' },
    level: 3, cash: 5000000, rows: [], ledger: [], failLedger: false, account: true,
    currency: { id: 1n, code: 'CASH', type: 'SOFT', is_active: true },
  };
  const sponsors = Array.from({ length: 12 }, (_, i) => ({ id: BigInt(i + 1), reputation: i * 800, name: `Sponsor ${i + 1}`, industry: 'Sport', description: 'Test brand', logo_url: null }));
  const locks = [];
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(branch => matches(row, branch));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('not' in value) return row[key] !== value.not && row[key] != null;
      if ('gte' in value) return row[key] != null && row[key] >= value.gte;
      if ('lt' in value) return row[key] != null && row[key] < value.lt;
    }
    return row[key] === value;
  });
  const tx = {
    $queryRaw: async strings => { locks.push(strings.join('?')); return [{ id: 1n }]; },
    clubs: { findUnique: async ({ where }) => where.id === state.club.id ? { ...state.club } : null },
    seasons: { findFirst: async () => state.season.status === 'ACTIVE' ? { ...state.season } : null },
    facilities: { findFirst: async ({ where }) => {
      assert.equal(where.facility_types.code, 'COMMERCIAL_OFFICE');
      return state.level ? { facility_levels: { level: state.level } } : null;
    } },
    currencies: { findUnique: async () => state.currency },
    sponsors: { findMany: async ({ where }) => sponsors.filter(sponsor => !state.rows.some(row => row.sponsor_id === sponsor.id && matches(row, where.club_sponsorships.none))) },
    club_sponsorships: {
      findMany: async ({ where }) => state.rows.filter(row => matches(row, where)).map(row => ({ ...row, sponsors: sponsors.find(sponsor => sponsor.id === row.sponsor_id) })),
      findFirst: async ({ where }) => {
        const row = state.rows.find(row => matches(row, where));
        return row ? { ...row, sponsors: sponsors.find(sponsor => sponsor.id === row.sponsor_id) } : null;
      },
      count: async ({ where }) => state.rows.filter(row => matches(row, where)).length,
      createMany: async ({ data }) => { for (const row of data) state.rows.push({ id: BigInt(state.rows.length + 1), ...row }); return { count: data.length }; },
      updateMany: async ({ where, data }) => {
        const rows = state.rows.filter(row => matches(row, where));
        rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
      },
      update: async ({ where, data }) => Object.assign(state.rows.find(row => row.id === where.id), data),
    },
    financial_accounts: {
      findFirst: async () => state.account ? { id: 20n, club_id: 10n, balance_cash: state.cash } : null,
      update: async ({ data }) => { state.cash += Number(data.balance_cash.increment); return { balance_cash: state.cash }; },
    },
    financial_transactions: { create: async ({ data }) => {
      if (state.failLedger) throw new Error('ledger failed');
      assert.ok(!state.ledger.some(row => row.idempotency_key === data.idempotency_key));
      state.ledger.push(data); return data;
    } },
  };
  let tail = Promise.resolve();
  const prisma = { $transaction: async work => {
    const previous = tail;
    let release; tail = new Promise(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone(state);
    try { return await work(tx); }
    catch (error) { state = snapshot; throw error; }
    finally { release(); }
  } };
  return { get state() { return state; }, service: new SponsorshipsService(prisma), locks };
}

test('offers are persisted once even when opened concurrently; upgrades do not reroll', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.service.openOffers(100n, 10n), f.service.openOffers(100n, 10n)]);
  assert.deepEqual(a, b);
  assert.equal(a.offers.length, 5);
  assert.equal(a.available_slots, 4);
  assert.equal(a.finance_level, 3);
  assert.equal(a.season_number, 1);
  assert.equal(new Set(a.offers.map(row => row.sponsor_id)).size, a.offers.length);
  f.state.level = 10;
  assert.deepEqual((await f.service.openOffers(100n, 10n)).offers, a.offers);
  assert.equal(f.state.ledger.length, 0);
  assert.equal(f.state.cash, 5000000);
  assert.match(f.locks[0], /clubs.*FOR UPDATE/);
  assert.match(f.locks[1], /seasons.*FOR UPDATE/);
});

test('signing credits the stored amount once and records the current season', async () => {
  const f = fixture();
  const offers = await f.service.openOffers(100n, 10n);
  const offer = offers.offers[0];
  const result = await f.service.sign(100n, 10n, offer.id);
  assert.equal(result.signed_count, 1);
  assert.equal(result.available_slots, 3);
  assert.equal(result.contracts[0].amount, offer.amount);
  assert.equal(result.total_income, offer.amount);
  assert.equal(f.state.cash, 5000000 + offer.amount);
  assert.equal(f.state.ledger.length, 1);
  assert.equal(f.state.ledger[0].season_id, 7n);
  assert.equal(f.state.ledger[0].reference_id, offer.id);
  assert.equal(f.state.ledger[0].currency_type, 'CASH');
  await assert.rejects(f.service.sign(100n, 10n, offer.id), /đã được ký/);
  assert.equal(f.state.cash, 5000000 + offer.amount);
});

test('concurrent duplicate signing pays exactly once', async () => {
  const f = fixture();
  const { offers } = await f.service.openOffers(100n, 10n);
  const results = await Promise.allSettled([f.service.sign(100n, 10n, offers[0].id), f.service.sign(100n, 10n, offers[0].id)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.state.ledger.length, 1);
});

test('concurrent signatures cannot exceed four; expired signatures still consume the season quota', async () => {
  const f = fixture(); f.state.level = 10;
  const { offers } = await f.service.openOffers(100n, 10n);
  const results = await Promise.allSettled(offers.map(offer => f.service.sign(100n, 10n, offer.id)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 4);
  assert.equal(f.state.ledger.length, 4);
  assert.equal(f.state.rows.filter(row => row.status === 'ACTIVE').length, 4);
  const result = await f.service.getSponsorships(100n, 10n);
  assert.equal(result.available_slots, 0);
  f.state.rows.find(row => row.status === 'ACTIVE').status = 'EXPIRED';
  await assert.rejects(f.service.sign(100n, 10n, result.offers[0].id), /tối đa 4/);
});

test('ledger or account failure leaves the offer unsigned and balance unchanged', async () => {
  for (const failure of ['ledger', 'account']) {
    const f = fixture();
    const { offers } = await f.service.openOffers(100n, 10n);
    f.state.failLedger = failure === 'ledger'; f.state.account = failure !== 'account';
    await assert.rejects(f.service.sign(100n, 10n, offers[0].id));
    assert.equal(f.state.cash, 5000000);
    assert.equal(f.state.rows.filter(row => row.status === 'ACTIVE').length, 0);
    assert.equal(f.state.ledger.length, 0);
  }
});

test('wrong owner, foreign club, foreign offer and missing season are rejected', async () => {
  const f = fixture();
  await assert.rejects(f.service.openOffers(999n, 10n), error => error.getStatus() === 403);
  await assert.rejects(f.service.openOffers(100n, 999n), error => error.getStatus() === 404);
  const { offers } = await f.service.openOffers(100n, 10n);
  f.state.rows.find(row => row.id === offers[0].id).club_id = 999n;
  await assert.rejects(f.service.sign(100n, 10n, offers[0].id), error => error.getStatus() === 404);
  f.state.season.status = 'COMPLETED';
  await assert.rejects(f.service.sign(100n, 10n, offers[1].id), /chưa có mùa/);
  assert.equal(f.state.cash, 5000000);
});

test('new season expires old offers/contracts and grants fresh slots without repaying old contracts', async () => {
  const f = fixture();
  const old = await f.service.openOffers(100n, 10n);
  await f.service.sign(100n, 10n, old.offers[0].id);
  const cash = f.state.cash;
  f.state.season = { ...f.state.season, id: 18n, season_number: 2, name: 'Season 2', start_date: new Date('2026-02-01') };
  const next = await f.service.openOffers(100n, 10n);
  assert.equal(next.available_slots, 4);
  assert.equal(next.season_number, 2);
  assert.equal(next.contracts.length, 0);
  assert.equal(next.total_income, 0);
  assert.equal(next.offers.length, 5);
  assert.ok(f.state.rows.filter(row => row.season_id === 7n).every(row => row.status === 'EXPIRED'));
  await assert.rejects(f.service.sign(100n, 10n, old.offers[1].id), error => error.getStatus() === 404);
  assert.equal(f.state.cash, cash);
  await f.service.sign(100n, 10n, next.offers[0].id);
  assert.equal(f.state.ledger.length, 2);
});

test('legacy active contracts occupy slots and still allow incoming offers', async () => {
  const f = fixture();
  f.state.rows.push({ id: 1n, club_id: 10n, season_id: null, sponsor_id: 1n, amount: 1000000, status: 'ACTIVE', start_date: new Date('2026-01-01'), end_date: null });
  const result = await f.service.openOffers(100n, 10n);
  assert.equal(result.contracts.length, 1);
  assert.equal(result.available_slots, 3);
  assert.equal(result.offers.length, 4);
  assert.ok(result.offers.every(offer => offer.sponsor_id !== 1n));
});

test('missing CASH configuration creates no offers; missing office uses level zero', async () => {
  const f = fixture(); f.state.currency.is_active = false;
  await assert.rejects(f.service.openOffers(100n, 10n), /CASH/);
  assert.equal(f.state.rows.length, 0);
  f.state.currency.is_active = true; f.state.level = 0;
  const result = await f.service.openOffers(100n, 10n);
  assert.equal(result.finance_level, 0);
  assert.equal(result.offers.length, 4);
});

test('amounts stay between 1 and 100M and both reputation and office level improve chances', () => {
  for (const rep of [-100, 0, 3000, 10000, 20000]) for (const level of [-1, 0, 5, 10, 20]) {
    const { appeal } = sponsorshipProfile(rep, level);
    for (const roll of [0, 0.01, 0.5, 0.99, 1]) {
      const amount = rollSponsorshipAmount(appeal, () => roll);
      assert.ok(amount >= 1000000 && amount <= 100000000);
      assert.equal(amount % 1000000, 0);
    }
  }
  for (let i = 0; i < 1000; i++) {
    const roll = () => i / 1000;
    const low = rollSponsorshipAmount(sponsorshipProfile(1000, 1).appeal, roll);
    assert.ok(rollSponsorshipAmount(sponsorshipProfile(9000, 1).appeal, roll) >= low);
    assert.ok(rollSponsorshipAmount(sponsorshipProfile(1000, 10).appeal, roll) >= low);
  }
  // Uniform quantiles make this distribution check deterministic and non-flaky.
  const bands = [0, 0, 0, 0, 0];
  for (let i = 0; i < 100000; i++) {
    const amount = rollSponsorshipAmount(1, () => (i + 0.5) / 100000);
    bands[Math.min(4, Math.floor((amount / 1000000 - 1) / 20))]++;
  }
  for (let i = 1; i < bands.length; i++) assert.ok(bands[i] < bands[i - 1]);
  assert.equal(rollSponsorshipAmount(1, () => 0.999999), 100000000);
});

test('weighted brand selection never duplicates or mutates the catalog', () => {
  const sponsors = [{ reputation: 1000 }, { reputation: 5000 }, { reputation: 10000 }];
  const selected = selectSponsors(sponsors, 8, 0.1, () => 0.5);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected).size, 3);
  assert.equal(sponsors.length, 3);
  assert.deepEqual(selectSponsors([], 4, 1), []);
});

test('API errors expose stable codes for localized clients', async () => {
  const f = fixture();
  const codeIs = code => error => error.getResponse().code === `SPONSORSHIP_${code}`;
  await assert.rejects(f.service.openOffers(999n, 10n), codeIs('FORBIDDEN'));
  await assert.rejects(f.service.openOffers(100n, 999n), codeIs('CLUB_NOT_FOUND'));
  f.state.currency.is_active = false;
  await assert.rejects(f.service.openOffers(100n, 10n), codeIs('CASH_NOT_CONFIGURED'));
  f.state.currency.is_active = true;
  const { offers } = await f.service.openOffers(100n, 10n);
  await assert.rejects(f.service.sign(100n, 10n, 999n), codeIs('OFFER_NOT_FOUND'));
  await f.service.sign(100n, 10n, offers[0].id);
  await assert.rejects(f.service.sign(100n, 10n, offers[0].id), codeIs('OFFER_UNAVAILABLE'));
  f.state.account = false;
  await assert.rejects(f.service.sign(100n, 10n, offers[1].id), codeIs('ACCOUNT_NOT_FOUND'));
  f.state.season.status = 'COMPLETED';
  await assert.rejects(f.service.openOffers(100n, 10n), codeIs('NO_ACTIVE_SEASON'));
});
