const { test } = require('node:test');
const assert = require('node:assert/strict');
const { playerAvailability, playerAvailabilityInclude } = require('../dist/modules/players/player-availability');
const { PlayersService } = require('../dist/modules/players/players.service');
const { TacticsService } = require('../dist/modules/tactics/tactics.service');
const { loadYellowCards, yellowCardMatchScopes } = require('../dist/modules/players/player-yellow-cards');
const upcoming = { id: 44n, competition_season_id: 100n, season_id: 7n, match_type: 'COMPETITIVE', competition_seasons: { name: 'Vietnam League', season_id: 7n, country_id: 1n, competitions: { competition_type: 'DOMESTIC_LEAGUE' } } };
const yellowRows = () => [1, 1].map(yellow_cards => ({ player_id: 7n, yellow_cards,
  matches: { season_id: 7n, competition_season_id: 100n, competition_seasons: { name: 'Vietnam League' } } }));


function restrictedPlayer() {
  return {
    id: 7n, first_name: 'Nguyễn', last_name: 'An', player_positions: [], ovr: 60,
    player_status: { is_injured: false, is_suspended: false, condition: 80 },
    injuries: [
      { id: 1n, status: 'ACTIVE', days_remaining: 4, injury_types: { name: 'Căng cơ' } },
      { id: 2n, status: 'RECOVERING', days_remaining: 9, injury_types: { name: 'Bong gân' } },
      { id: 3n, status: 'RECOVERED', days_remaining: 20 },
    ],
    player_suspensions: [
      { id: 10n, status: 'ACTIVE', reason: 'RED_CARD', matches_banned: 2, matches_served: 1, competition_season_id: 100n, competition_seasons: { name: 'Vietnam League' } },
      { id: 11n, status: 'ACTIVE', reason: 'FIVE_YELLOW_CARDS', matches_banned: 1, matches_served: 0, competition_season_id: 200n, competition_seasons: { name: 'Vietnam Cup' } },
      { id: 12n, status: 'ACTIVE', reason: 'RED_CARD', matches_banned: 2, matches_served: 2, competition_season_id: null },
      { id: 13n, status: 'SERVED', reason: 'RED_CARD', matches_banned: 2, matches_served: 0, competition_season_id: null },
    ],
  };
}

test('remaining restrictions exclude recovered injuries and served bans, preserving competition scope', () => {
  const p = restrictedPlayer();
  const before = structuredClone(p);
  const status = playerAvailability(p);
  assert.equal(status.is_injured, true);
  assert.equal(status.is_suspended, true);
  assert.equal(status.injury_days_remaining, 9);
  assert.equal(status.active_injuries.length, 2);
  assert.deepEqual(status.suspensions.map(b => [b.competition_season_id, b.matches_remaining]), [['100', 1], ['200', 1]]);
  assert.equal(status.suspensions[0].matches_banned, 2);
  assert.equal(status.suspensions[0].matches_served, 1);
  assert.doesNotThrow(() => JSON.stringify(status));
  assert.deepEqual(p, before);
});

test('legacy flags retain unknown durations and cleared players have no active restriction', () => {
  assert.deepEqual(playerAvailability({}), { is_injured: false, is_suspended: false, injury_days_remaining: null, active_injuries: [], suspensions: [], yellow_cards: [] });
  const legacy = playerAvailability({ player_status: { is_injured: true, is_suspended: true } });
  assert.equal(legacy.injury_days_remaining, null);
  assert.deepEqual(legacy.suspensions, []);
  assert.equal(legacy.is_injured, true);
  assert.equal(legacy.is_suspended, true);
});

test('squad endpoint fetches and exposes restrictions in the roster query', async () => {
  let queries = 0;
  const service = new PlayersService({ match_players: { findMany: async () => yellowRows() }, matches: { findFirst: async () => upcoming }, players: { findMany: async ({ include, where }) => {
    queries++;
    assert.equal(where.current_club_id, 5n);
    assert.deepEqual(include.injuries, playerAvailabilityInclude.injuries);
    assert.deepEqual(include.player_suspensions, playerAvailabilityInclude.player_suspensions);
    return [restrictedPlayer()];
  } } });
  const [p] = await service.getClubSquad(5n);
  assert.equal(queries, 1);
  assert.equal(p.status.injury_days_remaining, 9);
  assert.equal(p.status.suspensions[0].matches_remaining, 1);
  assert.equal(p.status.suspensions[0].applies_to_next_match, true);
  assert.equal(p.status.suspensions[1].applies_to_next_match, false);
  assert.equal(p.status.next_match.id, '44');
  assert.equal(p.status.condition, 80);
  assert.equal(p.status.yellow_cards[0].count, 2);
  assert.equal(p.status.yellow_cards[0].applies_to_next_match, true);
  assert.doesNotThrow(() => JSON.stringify(p));
});

test('roster availability uses each squad next fixture and batches the fixture lookup per squad', async () => {
  let lookups = 0;
  const roster = Array.from({ length: 20 }, (_, i) => ({ ...restrictedPlayer(), id: BigInt(i + 1), squad_type: i < 10 ? 'FIRST_TEAM' : 'YOUTH_U21' }));
  const service = new PlayersService({
    match_players: { findMany: async () => [] },
    players: { findMany: async () => roster },
    matches: { findFirst: async ({ where }) => {
      lookups++;
      const youth = where.AND[1].competition_seasons?.competitions?.age_limit === 21;
      return { ...upcoming, id: youth ? 45n : 44n, competition_season_id: youth ? 200n : 100n };
    } },
  });
  const players = await service.getClubSquad(5n);
  assert.equal(lookups, 2);
  assert.deepEqual(players[0].status.suspensions.map(b => b.applies_to_next_match), [true, false]);
  assert.deepEqual(players[10].status.suspensions.map(b => b.applies_to_next_match), [false, true]);
});

test('saved tactics carry the same restrictions for starters and substitutes', async () => {
  const p = restrictedPlayer();
  const service = new TacticsService({
    match_players: { findMany: async () => yellowRows() },
    matches: { findFirst: async () => upcoming },
    staff_contracts: { findFirst: async () => null },
    club_tactics: { findFirst: async ({ include }) => {
      assert.deepEqual(include.club_tactic_positions.include.players.select.player_suspensions, playerAvailabilityInclude.player_suspensions);
      return { id: 1n, club_tactic_positions: [
        { id: 2n, formation_position_id: 1n, lineup_role: 'STARTING', players: p },
        { id: 3n, formation_position_id: null, lineup_role: 'SUBSTITUTE', order_no: 1, players: p },
      ] };
    } },
  });
  const tactic = await service.getClubTactic(5n);
  assert.equal(tactic.club_tactic_positions[0].players.status.injury_days_remaining, 9);
  assert.equal(tactic.substitutes[0].players.status.suspensions[0].matches_remaining, 1);
  assert.equal(tactic.club_tactic_positions[0].players.status.yellow_cards[0].count, 2);
  assert.equal(tactic.substitutes[0].players.status.yellow_cards[0].applies_to_next_match, true);
});

function profileFixture() {
  let historyQueries = 0;
  const p = { ...restrictedPlayer(), current_club_id: 5n, world_id: 9n, age: 24,
    player_statistics: [], match_players: [], transfers: [], player_contracts: [], player_attribute_history: [],
    injuries: [
      { id: 99n, status: 'RECOVERED', days_remaining: 0, injury_types: { name: 'Old injury' } },
      ...restrictedPlayer().injuries,
    ],
  };
  const db = {
    match_players: { findMany: async () => yellowRows() },
    players: { findUnique: async ({ include }) => {
      if (include) {
        assert.deepEqual(include.injuries, playerAvailabilityInclude.injuries);
        assert.deepEqual(include.player_suspensions, playerAvailabilityInclude.player_suspensions);
      }
      return p;
    } },
    player_contracts: { findFirst: async () => null }, attributes: { findMany: async () => [] },
    seasons: { findMany: async () => [] }, server_timeline: { findUnique: async () => ({ season_id: 7n, season_number: 1 }) },
    injuries: { findMany: async ({ where, take }) => {
      historyQueries++; assert.equal(where.player_id, 7n); assert.equal(take, 20);
      return [{ id: 99n, status: 'RECOVERED', days_remaining: 0, injury_types: { name: 'Old injury' } }];
    } },
  };
  return { service: new PlayersService(db), player: p, historyQueries: () => historyQueries };
}

test('career profile shows one row per season and club for legacy competition statistics', async () => {
  const f = profileFixture();
  const base = { player_id: 7n, season_id: 1n, club_id: 5505n, seasons: { name: 'Mùa 1' }, clubs: { name: 'Club A' } };
  f.player.player_statistics.push(
    { ...base, competition_season_id: null, appearances: 0, average_rating: 0 },
    { ...base, competition_season_id: 578n, appearances: 1, minutes: 129, average_rating: 6.36 },
    { ...base, competition_season_id: 257n, appearances: 2, minutes: 195, average_rating: 6.63, clean_sheets: 1 },
    { ...base, club_id: 5506n, clubs: { name: 'Club B' }, appearances: 1, minutes: 90, average_rating: 8 },
  );
  const detail = await f.service.getPlayerById(7n, 5n);
  assert.equal(detail.statistics.seasons.length, 2);
  assert.deepEqual(detail.statistics.seasons.map(row => [row.team, row.matches, row.minutes, row.rating]),
    [['Club A', 3, 324, 6.54], ['Club B', 1, 90, 8]]);
});

test('player profile exposes remaining bans and the longest active injury even when the newest injury recovered', async () => {
  const f = profileFixture(), detail = await f.service.getPlayerById(7n, 5n);
  assert.equal(detail.status.is_suspended, true); assert.equal(detail.discipline.is_suspended, true);
  assert.deepEqual(detail.status.suspensions.map(b => [b.competition_season_id, b.matches_remaining]), [['100', 1], ['200', 1]]);
  assert.equal(detail.status.injury_days_remaining, 9); assert.equal(detail.active_injury.id, '2');
  assert.equal(detail.active_injury.days_remaining, 9); assert.equal(detail.injuries_tab.current.days_remaining, 9);
  assert.equal(detail.status.yellow_cards[0].count, 2);
  assert.equal(detail.injuries_tab.history[0].status, 'RECOVERED');
  assert.equal(f.historyQueries(), 1); assert.doesNotThrow(() => JSON.stringify(detail));
});

test('non-owner profile keeps public restrictions but does not fetch or expose confidential injury history', async () => {
  const f = profileFixture(), detail = await f.service.getPlayerById(7n, 999n);
  assert.equal(detail.status.suspensions.length, 2); assert.equal(detail.status.injury_days_remaining, 9);
  assert.equal(detail.active_injury, null); assert.deepEqual(detail.injuries_tab.history, []);
  assert.equal(f.historyQueries(), 0);
});

test('yellow warnings batch finished official appearances across clubs with isolated competition/season cycles', async () => {
  let queries = 0;
  const rows = [...yellowRows(),
    { player_id: 7n, yellow_cards: 3, matches: { season_id: 7n, competition_season_id: 200n, competition_seasons: { name: 'Cup' } } },
    { player_id: 8n, yellow_cards: 4, matches: { season_id: 7n, competition_season_id: 100n } },
    { player_id: 7n, yellow_cards: 2, matches: { season_id: 6n, competition_season_id: 90n } },
  ];
  const db = { match_players: { findMany: async query => {
    queries++;
    assert.deepEqual(query.where.player_id.in, [7n, 8n]);
    assert.deepEqual(query.where.matches.OR, [{ season_id: 7n }]);
    assert.deepEqual(query.where.matches.status.in, ['FINISHED', 'COMPLETED']);
    assert.equal(query.where.matches.match_type.not, 'FRIENDLY');
    assert.equal(query.where.yellow_cards.gt, 0);
    assert.equal(query.where.match_lineups, undefined); // No current-club restriction after a transfer.
    return rows.filter(row => row.matches.season_id === 7n);
  } } };
  const cards = await loadYellowCards(db, [7n, 8n, 7n], [{ season_id: 7n }]);
  assert.equal(queries, 1);
  assert.deepEqual(cards.get(7n).map(c => [c.competition_season_id, c.total, c.count, c.threshold]), [['100', 2, 2, 3], ['200', 3, 0, 3]]);
  assert.equal(cards.get(8n)[0].count, 1); // Fourth yellow starts the next cycle.
  const status = playerAvailability({}, upcoming, cards.get(7n));
  assert.equal(status.is_suspended, false); // A warning alone never prevents playing.
  assert.deepEqual(status.yellow_cards.map(c => c.applies_to_next_match), [true, false]);
  assert.doesNotThrow(() => JSON.stringify(status));
  const [scope] = yellowCardMatchScopes([null, { ...upcoming, match_type: 'FRIENDLY' }, upcoming]);
  assert.equal(scope.season_id, 7n);
  assert.deepEqual(scope.competition_seasons.competitions.competition_type.in, ['DOMESTIC_LEAGUE', 'DOMESTIC_SUPER_CUP']);
  assert.deepEqual(playerAvailability({}, null, cards.get(7n)).yellow_cards.map(c => c.applies_to_next_match), [false, false]);
  await loadYellowCards(db, [7n], []);
  await loadYellowCards(db, [], [{ season_id: 7n }]);
  assert.equal(queries, 1);
});

test('league and Super Cup warnings form one cycle, clear at three, and never resurrect served cards', async () => {
  const { fixture } = require('./helpers/match-lineup-fixture.cjs');
  const f = fixture(), state = f.state();
  const league = { ...state.match }, superCup = { ...league, competition_season_id: 31n, competition_seasons: state.competitions.find(c => c.id === 31n) };
  const appearance = (competition, overrides = {}) => ({ player_id: 7n, match_id: 40n, yellow_cards: 1,
    matches: { season_id: 7n, competition_season_id: competition, status: 'FINISHED', match_type: 'COMPETITIVE', ...overrides } });
  state.pastMatchPlayers = [appearance(9n), appearance(31n), { ...appearance(31n), yellow_cards: 2, red_cards: 1 }, appearance(30n),
    appearance(9n, { season_id: 6n }), appearance(31n, { match_type: 'FRIENDLY' }), appearance(9n, { status: 'SCHEDULED' }),
    appearance(9n, { competition_seasons: { ...league.competition_seasons, country_id: 2n } }),
    appearance(9n, { competition_seasons: { ...league.competition_seasons, competitions: { ...league.competition_seasons.competitions, is_youth: true } } }),
  ];
  for (const next of [league, superCup]) {
    const cards = (await loadYellowCards(f.tx, [7n], yellowCardMatchScopes([next]))).get(7n);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].count, 2);
    assert.equal(cards[0].scope, 'DOMESTIC_LEAGUE_AND_SUPER_CUP');
    assert.equal(playerAvailability({}, next, cards).yellow_cards[0].applies_to_next_match, true);
  }
  const allCards = (await loadYellowCards(f.tx, [7n], [{ season_id: 7n }])).get(7n);
  assert.equal(allCards.filter(c => c.scope === 'DOMESTIC_LEAGUE_AND_SUPER_CUP' && c.country_id === '1').length, 1);
  assert.equal(allCards.find(c => c.competition_season_id === '30').count, 1);
  state.pastMatchPlayers.push(appearance(31n));
  let cards = (await loadYellowCards(f.tx, [7n], yellowCardMatchScopes([league]))).get(7n);
  assert.equal(cards[0].count, 0);
  const stale = { player_status: { is_suspended: true }, player_suspensions: [
    { id: 1n, status: 'SERVED', matches_banned: 1, matches_served: 1, reason: 'YELLOW_ACCUMULATION', competition_season_id: 31n },
    { id: 2n, status: 'ACTIVE', matches_banned: 2, matches_served: 2, reason: 'RED_CARD', competition_season_id: 9n },
  ] };
  const clean = playerAvailability(stale, league, cards);
  assert.equal(clean.is_suspended, false);
  assert.deepEqual(clean.suspensions, []);
  state.pastMatchPlayers.push(appearance(9n));
  cards = (await loadYellowCards(f.tx, [7n], yellowCardMatchScopes([superCup]))).get(7n);
  assert.equal(cards[0].count, 1);
  assert.equal(cards[0].total, 4);
});
