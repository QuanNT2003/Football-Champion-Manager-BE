const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const {
  COUNTRY_TIME_ZONES, GAME_TIME_ZONE, LEAGUE_KICKOFF_SLOTS, CUP_KICKOFF_SLOTS,
  YOUTH_KICKOFF_SLOTS, getMatchScheduleFromLocalSlot: schedule, formatKickoffTime,
} = require('../dist/common/match-schedule');
const { CompetitionsService } = require('../dist/modules/competitions/competitions.service');
const { GameWorldService } = require('../dist/modules/game-world/game-world.service');
const { MatchesService } = require('../dist/modules/matches/matches.service');

const date = value => new Date(`${value}T00:00:00.000Z`);
const display = result => [result.match_date.toISOString().slice(0, 10), formatKickoffTime(result.kickoff_time)];

test('Vietnam league uses 19:00-21:00, cups use 10:00-12:00 and youth uses 17:00', () => {
  assert.deepEqual(LEAGUE_KICKOFF_SLOTS, ['19:00', '19:30', '20:00', '20:30', '21:00']);
  assert.deepEqual(CUP_KICKOFF_SLOTS, ['10:00', '10:30', '11:00', '11:30', '12:00']);
  assert.deepEqual(YOUTH_KICKOFF_SLOTS, ['17:00']);
  for (const slots of [LEAGUE_KICKOFF_SLOTS, CUP_KICKOFF_SLOTS, YOUTH_KICKOFF_SLOTS]) {
    assert.deepEqual(slots.map((_, seed) => display(schedule(slots, seed, { code: 'VIE' }, date('2026-11-22')))),
      slots.map(slot => ['2026-11-22', slot]));
  }
});

test('England follows winter/summer time and preserves rollover into the next month/year', () => {
  assert.deepEqual(display(schedule(['20:00'], 0, { code: 'ENG' }, date('2026-12-31'))), ['2027-01-01', '03:00']);
  assert.deepEqual(display(schedule(['20:00'], 0, { code: 'ENG' }, date('2026-07-31'))), ['2026-08-01', '02:00']);
  assert.deepEqual(display(schedule(['12:00'], 0, { code: 'ENG' }, date('2026-03-28'))), ['2026-03-28', '19:00']);
  assert.deepEqual(display(schedule(['12:00'], 0, { code: 'ENG' }, date('2026-03-29'))), ['2026-03-29', '18:00']);
});

test('fractional offsets and preceding server dates are preserved', () => {
  assert.deepEqual(display(schedule(['19:00'], 0, { code: 'IND' }, date('2026-11-22'))), ['2026-11-22', '20:30']);
  assert.deepEqual(display(schedule(['19:00'], 0, { code: 'MYA' }, date('2026-11-22'))), ['2026-11-22', '19:30']);
  assert.deepEqual(display(schedule(['00:30'], 0, { code: 'AUS' }, date('2026-01-01'))), ['2025-12-31', '20:30']);
});

function assertLocalClock(match, code, day, slots) {
  // Reconstruct the real instant from the persisted server date and time, independently of the converter.
  const instant = new Date(`${match.match_date.toISOString().slice(0, 10)}T${formatKickoffTime(match.kickoff_time)}:00+07:00`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: COUNTRY_TIME_ZONES[code], year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  assert.equal(`${parts.year}-${parts.month}-${parts.day}`, day, code);
  assert.ok(slots.includes(`${parts.hour}:${parts.minute}`), `${code}: local ${parts.hour}:${parts.minute}`);
}

test('all 96 seed countries keep their local slots in winter and summer without continent fallbacks', () => {
  const seed = fs.readFileSync('../qkaito_football_champion_seed_data.sql', 'utf8');
  const block = seed.slice(seed.indexOf('INSERT INTO `countries`'), seed.indexOf('-- 3. CITIES'));
  const codes = [...block.matchAll(/\(\d+, '([^']+)', '[^']+', '[^']+'/g)].map(match => match[1]);
  assert.equal(codes.length, 96);
  for (const code of codes) {
    assert.ok(COUNTRY_TIME_ZONES[code], code);
    for (const day of ['2026-01-15', '2026-07-15']) {
      for (const slots of [LEAGUE_KICKOFF_SLOTS, CUP_KICKOFF_SLOTS, YOUTH_KICKOFF_SLOTS]) {
        for (let i = 0; i < slots.length; i++) assertLocalClock(schedule(slots, i, { code }, date(day)), code, day, [slots[i]]);
      }
    }
  }
  assert.deepEqual(schedule(['20:00'], 0, { code: 'CHI' }, date('2026-11-22')), schedule(['20:00'], 0, { code: 'CHL' }, date('2026-11-22')));
  assert.throws(() => schedule(['20:00'], 0, { code: 'UNKNOWN' }, date('2026-11-22')), /Missing match timezone/);
  assert.throws(() => schedule(['20:00'], 0, null, date('2026-11-22')), /Missing match timezone/);
});

test('TIME carriers serialize as HH:mm without converting the historical epoch date', () => {
  assert.equal(formatKickoffTime(new Date('1970-01-01T20:00:00.000Z')), '20:00');
  assert.equal(formatKickoffTime(null), '--:--');
});

test('midnight cron always uses Vietnam time', () => {
  const options = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', GameWorldService.prototype.handleAutomaticMidnightCycle);
  assert.equal(options.timeZone, GAME_TIME_ZONE);
  assert.equal(options.cronTime, '0 0 * * *');
});

for (const [currentDay, targetDay, expectedMatches, legCount] of [[23, 25, 16, 8], [27, 28, 8, 8], [30, 31, 4, 4], [33, 34, 1, 2]]) {
  test(`continental knockout day ${targetDay} uses the host country of each leg`, async () => {
    const season = { id: 1n, world_id: 1n, start_date: date('2026-03-01') };
    const groups = Array.from({ length: 8 }, (_, i) => ({ id: BigInt(i + 1) }));
    const generated = [];
    const clubCountry = id => ({ code: Number(id) % 2 ? 'ENG' : 'VIE' });
    const service = new CompetitionsService({
      seasons: { findUnique: async () => season },
      countries: { findMany: async () => [] },
      clubs: { findMany: async () => Array.from({ length: 32 }, (_, i) => ({ id: BigInt(i + 1), countries: clubCountry(i + 1) })) },
      competition_seasons: { findMany: async ({ where }) => typeof where.competitions.competition_type === 'object' ? [{
        id: 1n, competition_stages: [{ id: 1n, stage_type: 'GROUP', stage_groups: groups }, { id: 2n, stage_type: 'KNOCKOUT' }],
      }] : [] },
      matches: {
        count: async ({ where }) => where.season_day === targetDay ? 0 : 1,
        findMany: async ({ where }) => {
          if (where.stage_id === 1n) {
            return groups.flatMap((group, index) => {
              const ids = Array.from({ length: 4 }, (_, i) => BigInt(index * 4 + i + 1));
              return service.generateBergerPairings(ids).map(pair => ({
                group_id: group.id, home_club_id: pair.home, away_club_id: pair.away,
                home_score: pair.home < pair.away ? 2 : 0, away_score: pair.home < pair.away ? 0 : 2, status: 'COMPLETED',
              }));
            });
          }
          const secondLeg = [26, 29, 32].includes(where.season_day);
          return Array.from({ length: legCount }, (_, i) => ({
            home_club_id: BigInt(secondLeg ? i + 17 : i + 1), away_club_id: BigInt(secondLeg ? i + 1 : i + 17),
            home_score: secondLeg ? 0 : 2, away_score: secondLeg ? 2 : 0, status: 'COMPLETED',
          }));
        },
        createMany: async ({ data }) => { generated.push(...data); },
        create: async ({ data }) => { generated.push(data); },
      },
    }, {}, {}, {});
    service.ensureStageRound = async (_stage, _season, roundNo) => ({ id: BigInt(roundNo) });
    const result = await service.progressKnockoutStages(1n, currentDay);
    assert.equal(generated.length, expectedMatches);
    assert.equal(result.progressedCount, expectedMatches);
    for (const match of generated) {
      const localDay = new Date(season.start_date.getTime() + (match.season_day - 1) * 86400000).toISOString().slice(0, 10);
      assertLocalClock(match, clubCountry(match.home_club_id).code, localDay, CUP_KICKOFF_SLOTS);
    }
    if (expectedMatches > 1) assert.notEqual(formatKickoffTime(generated[0].kickoff_time), formatKickoffTime(generated[1].kickoff_time));
  });
}

test('match API returns HH:mm and sorts by the actual server date/time', async () => {
  let orderBy;
  const service = new MatchesService({ matches: {
    count: async () => 1,
    findMany: async args => { orderBy = args.orderBy; return [{ id: 1n, kickoff_time: new Date('1970-01-01T20:00Z') }]; },
  } }, {});
  const result = await service.getMatches();
  assert.equal(result.items[0].kickoff_time, '20:00');
  assert.deepEqual(orderBy, [{ match_date: 'asc' }, { kickoff_time: 'asc' }, { id: 'asc' }]);
});

test('Day 1 league generation persists correct server dates/times for home and away fixtures', async () => {
  for (const code of ['VIE', 'ENG', 'IRN', 'CHI', 'USA']) {
    const season = { id: 1n, start_date: date('2026-12-29'), season_number: 1 };
    const generated = [];
    const service = new CompetitionsService({
      seasons: { findUnique: async () => season },
      stadiums: { findMany: async () => [] },
      clubs: { findMany: async () => [1n, 2n].map(id => ({ id, countries: { code } })) },
      countries: { findMany: async () => [] },
      competition_seasons: { findMany: async () => [{
        id: 1n, competition_stages: [{
          id: 1n, stage_groups: [{ id: 1n }],
          stage_teams: [1n, 2n].map(club_id => ({ club_id, group_id: 1n })),
        }],
      }] },
      matches: {
        findMany: async () => [], count: async () => 0,
        createMany: async ({ data }) => { generated.push(...data); },
      },
    }, {}, {}, {});
    service.ensureStageRound = async (_stage, _season, roundNo) => ({ id: BigInt(roundNo) });
    const result = await service.generateSeasonFixtures({ seasonId: '1', competitionSeasonId: '1' });
    assert.equal(result.matchesGenerated, 2);
    for (const match of generated) {
      const localDay = new Date(season.start_date.getTime() + (match.season_day - 1) * 86400000).toISOString().slice(0, 10);
      assertLocalClock(match, code, localDay, LEAGUE_KICKOFF_SLOTS);
    }
  }
});

function startupFixture({ day = 1, hasSeason = true, competitions = 0, matches = 0 } = {}) {
  const calls = [];
  const season = { id: 7n, world_id: 1n, season_number: 3, current_day: day };
  const service = new GameWorldService({
    seasons: { findFirst: async () => hasSeason ? season : null },
    competition_seasons: { count: async () => competitions },
    matches: { count: async () => matches },
  }, {
    initializeNewSeason: async dto => {
      calls.push({ initialize: dto }); competitions = 2; matches = 30;
      return { message: 'Season initialized' };
    },
    generateSeasonFixtures: async dto => {
      calls.push({ generate: dto }); matches = 30;
      return { message: 'Fixtures generated' };
    },
  });
  service.logger = { log() {}, error(error) { throw new Error(error); } };
  return { service, calls };
}

test('startup still initializes missing Day 1 competitions and fixtures once', async () => {
  const f = startupFixture();
  await f.service.onApplicationBootstrap();
  await f.service.onApplicationBootstrap();
  assert.deepEqual(f.calls, [{ initialize: { worldId: '1', seasonNumber: 3, autoGenerateFixtures: true } }]);
});

test('startup still generates missing Day 1 fixtures for existing competitions once', async () => {
  const f = startupFixture({ competitions: 2 });
  await f.service.onApplicationBootstrap();
  await f.service.onApplicationBootstrap();
  assert.deepEqual(f.calls, [{ generate: { seasonId: '7' } }]);
});

test('startup keeps existing matches and leaves later season days untouched', async () => {
  for (const options of [{ competitions: 2, matches: 30 }, { day: 2 }, { day: 36 }, { hasSeason: false }]) {
    const f = startupFixture(options);
    await f.service.onApplicationBootstrap();
    assert.deepEqual(f.calls, []);
  }
});

test('a four-team U21 group plays each opponent once over three rounds', () => {
  const service = new CompetitionsService({}, {}, {}, {});
  const teams = [1n, 2n, 3n, 4n];
  const pairings = service.generateBergerPairings(teams, { doubleRoundRobin: false });
  assert.equal(pairings.length, 6);
  assert.deepEqual([...new Set(pairings.map(match => match.round))], [1, 2, 3]);
  const pairs = new Set(pairings.map(match => [match.home, match.away].map(Number).sort((a, b) => a - b).join(':')));
  assert.equal(pairs.size, 6);
  for (const round of [1, 2, 3]) {
    const matches = pairings.filter(match => match.round === round);
    assert.equal(matches.length, 2);
    assert.equal(new Set(matches.flatMap(match => [match.home, match.away])).size, 4);
  }
});

test('league and continental groups retain the default home-and-away format', () => {
  const service = new CompetitionsService({}, {}, {}, {});
  for (const teamCount of [4, 16]) {
    const teams = Array.from({ length: teamCount }, (_, i) => BigInt(i + 1));
    const pairings = service.generateBergerPairings(teams);
    assert.equal(pairings.length, teamCount * (teamCount - 1));
    assert.equal(new Set(pairings.map(match => match.round)).size, 2 * (teamCount - 1));
    for (const team of teams) {
      assert.equal(pairings.filter(match => match.home === team).length, teamCount - 1);
      assert.equal(pairings.filter(match => match.away === team).length, teamCount - 1);
    }
  }
});

test('U21 generation creates 48 group matches, one per club on days 7, 12 and 17, without duplicates on restart', async () => {
  const season = { id: 1n, season_number: 1, start_date: date('2026-08-01') };
  const clubs = Array.from({ length: 32 }, (_, i) => ({ id: BigInt(i + 1), country_id: 65n }));
  const generated = [];
  const service = new CompetitionsService({
    seasons: { findUnique: async () => season },
    stadiums: { findMany: async () => [] },
    clubs: { findMany: async () => clubs.map(club => ({ ...club, countries: { code: 'VIE', continent: 'Asia' } })) },
    countries: { findMany: async () => [{ id: 65n, name: 'Vietnam' }] },
    competition_seasons: {
      findMany: async () => [],
      findFirst: async () => ({ id: 130n }),
    },
    competition_stages: { findFirst: async ({ where }) => ({ id: where.stage_type === 'GROUP' ? 1n : 2n }) },
    matches: {
      findMany: async () => generated,
      count: async () => generated.length,
      createMany: async ({ data }) => { generated.push(...data); },
    },
  }, {}, {}, {});
  service.getTopYouthClubsByCountry = async () => clubs;
  service.ensureStageGroup = async (_stage, _name, _code, order) => ({ id: BigInt(order) });
  service.ensureStageParticipants = async () => 0;
  service.ensureStageRound = async (stage, _season, roundNo) => ({ id: stage * 100n + BigInt(roundNo) });
  const dto = { seasonId: '1', countryId: '65', competitionId: '13', competitionSeasonId: '130' };
  const result = await service.generateSeasonFixtures(dto);
  assert.equal(result.breakdown.youthCupMatches, 48);
  assert.equal(generated.length, 48);
  for (const [index, day] of [7, 12, 17].entries()) {
    const matches = generated.filter(match => match.season_day === day);
    assert.equal(matches.length, 16);
    const appearances = matches.flatMap(match => [match.home_club_id, match.away_club_id]);
    assert.equal(new Set(appearances).size, 32, `Each club must play once on day ${day}`);
    for (const match of matches) {
      assert.equal(match.round_id, 101n + BigInt(index));
      assert.equal(formatKickoffTime(match.kickoff_time), '17:00');
    }
  }
  for (let group = 1n; group <= 8n; group++) {
    const matches = generated.filter(match => match.group_id === group);
    const pairs = matches.map(match => [match.home_club_id, match.away_club_id].map(Number).sort((a, b) => a - b).join(':'));
    assert.equal(matches.length, 6);
    assert.equal(new Set(pairs).size, 6, 'No return leg in a U21 group');
  }
  const repeated = await service.generateSeasonFixtures(dto);
  assert.equal(repeated.matchesGenerated, 0);
  assert.equal(generated.length, 48);
});
