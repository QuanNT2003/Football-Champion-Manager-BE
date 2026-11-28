const { test } = require('node:test');
const assert = require('node:assert/strict');
const { banAppliesToMatch, suspensionScope, nextClubMatch, crossesYellowCardThreshold } = require('../dist/modules/players/discipline-scope');
const { playerAvailability } = require('../dist/modules/players/player-availability');
const comp = (type, season = 7n, country = 1n) => ({ name: type, season_id: season, country_id: country,
  competitions: { competition_type: type, country_id: country, is_youth: false } });
const match = (type = 'DOMESTIC_LEAGUE', id = 9n) => ({ id: 50n, competition_season_id: id, season_id: 7n,
  match_type: 'COMPETITIVE', competition_seasons: comp(type) });
const ban = (type = 'DOMESTIC_SUPER_CUP', id = 31n, reason = 'RED_CARD') => ({ id: 1n,
  competition_season_id: id, competition_seasons: comp(type), reason, status: 'ACTIVE', matches_banned: 2, matches_served: 0 });

test('league and Super Cup share yellow, direct-red and second-yellow bans in the same country and season', () => {
  for (const reason of ['RED_CARD', 'SECOND_YELLOW', 'YELLOW_ACCUMULATION', 'YELLOW_CARDS', 'FIVE_YELLOW_CARDS']) {
    assert.equal(banAppliesToMatch(ban('DOMESTIC_SUPER_CUP', 31n, reason), match()), true);
    assert.equal(banAppliesToMatch(ban('DOMESTIC_LEAGUE', 9n, reason), match('DOMESTIC_SUPER_CUP', 31n)), true);
    assert.equal(suspensionScope(ban('DOMESTIC_SUPER_CUP', 31n, reason)), 'DOMESTIC_LEAGUE_AND_SUPER_CUP');
  }
});

test('cup/continental bans stay separate from the domestic group, including metadata mismatches', () => {
  for (const type of ['DOMESTIC_CUP', 'CONTINENTAL_CLUB_C1', 'DOMESTIC_YOUTH_CUP']) {
    assert.equal(banAppliesToMatch(ban(type, 30n), match()), false);
    assert.equal(banAppliesToMatch(ban(), match(type, 30n)), false);
  }
  assert.equal(banAppliesToMatch({ ...ban(), competition_seasons: comp('DOMESTIC_SUPER_CUP', 6n) }, match()), false);
  assert.equal(banAppliesToMatch({ ...ban(), competition_seasons: comp('DOMESTIC_SUPER_CUP', 7n, 2n) }, match()), false);
  const youth = match(); youth.competition_seasons.competitions.is_youth = true;
  assert.equal(banAppliesToMatch(ban(), youth), false);
});

test('served bans and friendlies do not consume or display competitive bans; global official bans still apply', () => {
  assert.equal(banAppliesToMatch({ ...ban(), matches_served: 2 }, match()), false);
  assert.equal(banAppliesToMatch({ ...ban(), status: 'SERVED' }, match()), false);
  assert.equal(banAppliesToMatch(ban(), { ...match(), match_type: 'FRIENDLY' }), false);
  assert.equal(banAppliesToMatch({ ...ban(), competition_season_id: null }, match('DOMESTIC_CUP', 30n)), true);
});

test('full restrictions stay in the profile while next-fixture flags change without changing balances', () => {
  const p = { player_status: { is_suspended: true }, player_suspensions: [ban(), ban('DOMESTIC_CUP', 30n)] };
  const before = structuredClone(p);
  const league = playerAvailability(p, match());
  assert.deepEqual(league.suspensions.map(b => b.applies_to_next_match), [true, false]);
  assert.equal(league.next_match.id, '50'); assert.equal(league.suspensions.length, 2);
  const cup = playerAvailability(p, match('DOMESTIC_CUP', 30n));
  assert.deepEqual(cup.suspensions.map(b => b.applies_to_next_match), [false, true]);
  assert.ok(playerAvailability(p, null).suspensions.every(b => !b.applies_to_next_match));
  assert.deepEqual(p, before);
});

test('next fixture uses game schedule order with separate senior/U19/U21 selection', async () => {
  const queries = [];
  const db = { matches: { findFirst: async query => { queries.push(query); return null; } } };
  for (const type of ['FIRST_TEAM', 'YOUTH_U19', 'YOUTH_U21']) await nextClubMatch(db, 10n, type);
  assert.deepEqual(queries[0].orderBy, [{ match_date: 'asc' }, { kickoff_time: 'asc' }, { id: 'asc' }]);
  assert.deepEqual(queries[0].where.status.in, ['SCHEDULED', 'IN_PROGRESS']);
  assert.equal(queries[1].where.AND[1].competition_seasons.competitions.age_limit, 19);
  assert.equal(queries[2].where.AND[1].competition_seasons.competitions.age_limit, 21);
  assert.ok(!JSON.stringify(queries, (_, value) => typeof value === 'bigint' ? String(value) : value).includes('gte'));
});

test('yellow thresholds repeat at three, six, nine cards instead of resetting after every appearance', () => {
  for (const previous of [2, 5, 8, 11]) assert.equal(crossesYellowCardThreshold(previous, 1), true);
  for (const previous of [0, 1, 3, 4, 6, 9]) assert.equal(crossesYellowCardThreshold(previous, 1), false);
});
