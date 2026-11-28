const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, formation, player, savedXI } = require('./helpers/match-lineup-fixture.cjs');
const { selectMatchLineup } = require('../dist/modules/matches/match-lineup.rules');

test('creates both lineups using the active head coach formation and style, with unique suitable players', async () => {
  const f = fixture();
  const result = await f.prepare();
  assert.equal(f.state().tactics.length, 2);
  assert.equal(f.state().positions.length, 40);
  assert.equal(f.state().lineups.length, 2);
  for (const t of f.state().tactics) {
    assert.equal(t.formation_id, 2n);
    assert.equal(t.passing_style, 'SHORT');
    assert.equal(t.mentality, 'ATTACKING');
    const rows = f.state().positions.filter(p => p.tactic_id === t.id);
    assert.equal(new Set(rows.map(p => p.player_id)).size, 20);
  }
  assert.equal(result.home.starters.length, 11);
  assert.equal(result.home.outfieldPlayers.length, 10);
  const starterRows = f.state().matchPlayers.filter(p => p.started);
  for (const row of starterRows) {
    const player = f.state().players.find(p => p.id === row.player_id);
    assert.ok(player.player_positions.some(p => p.positions.code === row.position_code));
  }
  assert.deepEqual(f.state().locks.map(l => l[1]), [10n, 20n]);
});

test('keeps healthy saved starters, custom roles, duties and tactic settings', async () => {
  const f = fixture();
  const { tactic, positions } = f.addTactic();
  const before = structuredClone(positions);
  const result = await f.prepare();
  assert.deepEqual(result.home.starters.map(p => p.id), before.map(p => p.player_id));
  for (const p of before) assert.deepEqual(f.state().positions.find(row => row.id === p.id), p);
  assert.equal(tactic.formation_id, 1n);
  assert.equal(f.state().lineups[0].tactics_snapshot.tempo, 33);
});

test('replaces injuries, recovering injuries, suspension and national duty, including the bench, but keeps tired players', async () => {
  const f = fixture();
  f.addTactic();
  const home = f.state().players.filter(p => p.current_club_id === 10n);
  home[1].player_status.is_injured = true;
  home[2].injuries = [{ status: 'RECOVERING', days_remaining: 3 }];
  home[3].player_status.is_suspended = true;
  home[4].player_status.is_on_national_duty = true;
  home[5].player_status.fitness = 69;
  home[6].player_status.fitness = 70;
  // Fill a previously saved bench with unavailable players too.
  const tacticId = f.state().tactics[0].id;
  f.state().positions.push(...[1, 2, 3, 4, 5].map((i, seat) => ({ id: BigInt(900 + seat), tactic_id: tacticId,
    player_id: home[i].id, formation_position_id: null, lineup_role: 'SUBSTITUTE', order_no: seat + 1, role: 'BENCH', duty: 'SUPPORT' })));
  const result = await f.prepare();
  const selected = [...result.home.starters, ...result.home.substitutes];
  for (const p of home.slice(1, 5)) assert.ok(!selected.some(s => s.id === p.id));
  assert.ok(result.home.starters.some(p => p.id === home[5].id), '69% fitness remains eligible');
  assert.ok(result.home.starters.some(p => p.id === home[6].id), '70% fitness remains eligible');
  assert.equal(new Set(selected.map(p => p.id)).size, selected.length);
  assert.equal(f.state().positions.filter(p => p.tactic_id === tacticId).length, 20);
});

test('zero fitness does not block either team, saved starters or substitutes', async () => {
  const f = fixture();
  const { positions } = f.addTactic();
  const savedIds = positions.map(p => p.player_id);
  for (const p of f.state().players) p.player_status.fitness = 0;
  const result = await f.prepare();
  for (const side of ['home', 'away']) {
    assert.equal(result[side].starters.length, 11);
    assert.equal(result[side].substitutes.length, 9);
    assert.ok([...result[side].starters, ...result[side].substitutes].every(p => p.player_status.fitness === 0));
  }
  assert.deepEqual(new Set(result.home.starters.map(p => p.id)), new Set(savedIds));
});

test('repairs empty and duplicate positions and excludes players from another club', () => {
  const players = Array.from({ length: 22 }, (_, i) => player(BigInt(i + 1), 10n, i));
  const saved = savedXI(players);
  saved[1].player_id = 999n;
  saved[2].player_id = saved[3].player_id;
  saved[4].player_id = null;
  const result = selectMatchLineup(formation(1n).formation_positions, players, saved);
  const selected = result.filter(p => p.player);
  assert.equal(selected.filter(p => p.lineup_role === 'STARTING').length, 11);
  assert.equal(new Set(selected.map(p => p.player.id)).size, 20);
  assert.ok(!selected.some(p => p.player.id === 999n));
});

test('prioritizes specialist positions and never fills an outfield position with a pure goalkeeper', () => {
  const players = Array.from({ length: 22 }, (_, i) => player(BigInt(i + 1), 10n, i));
  players.find(p => p.id === 12n).ovr = 100;
  const result = selectMatchLineup(formation(1n).formation_positions, players, []);
  assert.equal(result[0].player.id, 12n);
  assert.ok(result.slice(1, 11).every(p => p.player.player_positions[0].positions.code !== 'GK'));
  assert.equal(result[11].player.id, 1n, 'reserve goalkeeper takes first free bench seat');
});

test('does not reuse an unavailable player when the roster is too small or lacks a goalkeeper', async () => {
  for (const missingKeeper of [false, true]) {
    const f = fixture();
    f.state().players = f.state().players.filter(p => p.current_club_id !== 20n ||
      (missingKeeper ? p.player_positions[0].positions.code !== 'GK' : p.id < 111n));
    await assert.rejects(f.prepare(), /Không đủ 11/);
    assert.equal(f.state().lineups.length, 0, 'home changes roll back when away cannot field XI');
    assert.equal(f.state().tactics.length, 0);
  }
});

test('can field eleven players with an empty bench; unknown medical status is unavailable', async () => {
  const f = fixture();
  f.state().players = f.state().players.filter(p => p.id <= 11n || (p.id > 100n && p.id <= 111n));
  const result = await f.prepare();
  assert.equal(result.home.starters.length, 11);
  assert.equal(result.home.substitutes.length, 0);
  assert.equal(f.state().positions.filter(p => p.player_id === null).length, 18);
  const g = fixture();
  for (const p of g.state().players.filter(p => p.current_club_id === 20n)) p.player_status = null;
  await assert.rejects(g.prepare(), /Không đủ 11/);
});

test('U21 uses age eligibility, its own tactic and active youth head coach', async () => {
  const f = fixture();
  const senior = f.addTactic();
  const before = structuredClone(senior);
  Object.assign(f.state().match.competition_seasons.competitions, { is_youth: true, age_limit: 21, participant_type: 'YOUTH_CLUB' });
  for (const p of f.state().players) { p.age = 21; p.squad_type = 'YOUTH_U21'; }
  const seniorStar = player(900n, 10n, 1); seniorStar.age = 22; seniorStar.ovr = 100;
  f.state().players.push(seniorStar);
  f.state().players[1].squad_type = 'FIRST_TEAM';
  f.state().coaches.unshift({ id: 100n, club_id: 10n, role: 'HEAD_COACH_YOUTH', squad_type: 'YOUTH_U21', status: 'ACTIVE',
    staff: { preferred_formation_id: 1n, tactical_style: 'COUNTER_ATTACK' } });
  const result = await f.prepare();
  const youth = f.state().tactics.find(t => t.club_id === 10n && t.squad_type === 'YOUTH_U21');
  assert.equal(youth.formation_id, 1n);
  assert.equal(youth.passing_style, 'DIRECT');
  assert.ok(result.home.starters.every(p => p.age <= 21));
  assert.ok(!result.home.starters.some(p => p.id === 900n));
  assert.deepEqual(senior, before);
  assert.ok(f.state().queries.every(q => q.age.lte === 21 && !q.squad_type));
});

test('U19 respects its age limit and missing youth configuration fails before writing', async () => {
  const f = fixture();
  Object.assign(f.state().match.competition_seasons.competitions, { is_youth: true, age_limit: 19 });
  for (const p of f.state().players) { p.age = 19; p.squad_type = 'YOUTH_U19'; }
  await f.prepare();
  assert.ok(f.state().tactics.every(t => t.squad_type === 'YOUTH_U19'));
  const g = fixture();
  g.state().match.competition_seasons.competitions.is_youth = true;
  await assert.rejects(g.prepare(), /giới hạn tuổi/);
  assert.equal(g.state().tactics.length, 0);
});

test('ignores inactive coaches and falls back when no head coach exists', async () => {
  const f = fixture();
  for (const c of f.state().coaches) c.status = 'EXPIRED';
  await f.prepare();
  assert.ok(f.state().tactics.every(t => t.formation_id === 1n && t.mentality === 'BALANCED'));
  const g = fixture();
  for (const c of g.state().coaches) c.staff.preferred_formation_id = null;
  await g.prepare();
  assert.ok(g.state().tactics.every(t => t.formation_id === 1n), 'uses secondary formation');
});

test('repairs a submitted match lineup and preserves its formation, tactics and captain independently of club edits', async () => {
  const f = fixture();
  await f.prepare();
  const lineup = f.state().lineups[0];
  const homeRows = f.state().matchPlayers.filter(p => p.lineup_id === lineup.id && p.started);
  homeRows[0].is_captain = true;
  const captain = homeRows[0].player_id;
  f.state().players.find(p => p.id === homeRows[1].player_id).player_status.is_injured = true;
  const clubTactic = f.state().tactics.find(t => t.id === lineup.club_tactic_id);
  Object.assign(clubTactic, { formation_id: 1n, tempo: 99 });
  const clubBefore = structuredClone(f.state().positions);
  const result = await f.prepare();
  assert.equal(f.state().lineups.length, 2);
  assert.equal(lineup.formation_id, 2n);
  assert.equal(lineup.tactics_snapshot.tempo, 55);
  assert.ok(!result.home.starters.some(p => p.id === homeRows[1].player_id));
  assert.ok(f.state().matchPlayers.some(p => p.player_id === captain && p.is_captain));
  assert.deepEqual(f.state().positions, clubBefore);
  assert.equal(f.state().matchPlayers.filter(p => p.lineup_id === lineup.id && p.started).length, 11);
});

test('simulator events use prepared participants and retry does not duplicate lineups or income', async () => {
  const f = fixture();
  const { positions } = f.addTactic();
  const banned = positions[1].player_id;
  f.state().players.find(p => p.id === banned).player_status.is_injured = true;
    const result = await f.simulator.simulateMatch(50n);
    assert.ok(result.events.length > 0);
    const participants = new Set(f.state().matchPlayers.filter(p => p.minutes > 0).map(p => p.player_id.toString()));
    assert.ok(result.events.filter(e => e.playerId).every(e => participants.has(e.playerId) && e.playerId !== banned.toString()));
    assert.ok(result.events.filter(e => e.eventType === 'GOAL').every(e =>
      f.state().matchPlayers.some(p => p.player_id.toString() === e.playerId && p.position_code !== 'GK')));
    const firstBalance = f.state().balance;
    await f.simulator.simulateMatch(50n);
    assert.equal(f.state().lineups.length, 2);
    assert.equal(f.state().transactions.length, 1);
    assert.equal(f.state().balance, firstBalance);
    assert.equal(f.state().transactions[0].idempotency_key, 'MATCH_TICKET_50');
    assert.ok(f.state().locks[0][0].includes('FROM matches'));
});

test('result persistence errors roll back prepared lineups, tactics and financial effects', async () => {
  const f = fixture(); f.state().failEvents = true;
  await assert.rejects(f.simulator.simulateMatch(50n), /event persistence failed/);
  assert.equal(f.state().match.status, 'SCHEDULED');
  assert.equal(f.state().lineups.length, 0);
  assert.equal(f.state().tactics.length, 0);
  assert.equal(f.state().balance, 0);
});

test('legacy completed matches skip lineup preparation entirely', async () => {
  const f = fixture(); f.state().match.status = 'COMPLETED';
  await f.simulator.simulateMatch(50n);
  assert.equal(f.state().lineups.length, 0);
  assert.equal(f.state().queries.length, 0);
  assert.equal(f.state().transactions.length, 0);
});

test('expired injury records do not exclude recovered players; active injuries do', async () => {
  const f = fixture(); f.addTactic();
  const home = f.state().players.filter(p => p.current_club_id === 10n);
  home[1].injuries = [{ status: 'ACTIVE', days_remaining: 0 }];
  home[2].injuries = [{ status: 'HEALED', days_remaining: 2 }];
  home[3].injuries = [{ status: 'ACTIVE', days_remaining: 2 }];
  const result = await f.prepare();
  assert.ok(result.home.starters.some(p => p.id === home[1].id));
  assert.ok(result.home.starters.some(p => p.id === home[2].id));
  assert.ok(!result.home.starters.some(p => p.id === home[3].id));
});

test('replaces saved players who moved clubs or squads; first-team fixtures do not select youth stars', async () => {
  const f = fixture(); f.addTactic();
  f.state().players[1].current_club_id = 99n;
  f.state().players[2].squad_type = 'YOUTH_U21';
  f.state().players[2].ovr = 100;
  const result = await f.prepare();
  assert.ok(result.home.starters.every(p => p.current_club_id === 10n && p.squad_type === 'FIRST_TEAM'));
});
