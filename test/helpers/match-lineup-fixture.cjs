require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { MatchLineupService } = require('../../dist/modules/matches/match-lineup.service');
const { MatchSimulatorService } = require('../../dist/modules/matches/match-simulator.service');
const { MatchResultService } = require('../../dist/modules/matches/match-result.service');
const { MatchesService } = require('../../dist/modules/matches/matches.service');

const codes = ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'ST', 'RW'];
const category = code => code === 'GK' ? 'GK' : ['LB', 'CB', 'RB'].includes(code) ? 'DEF' : ['DM', 'CM'].includes(code) ? 'MID' : 'FWD';
const positionId = code => BigInt(['GK', 'LB', 'CB', 'RB', 'DM', 'CM', 'LW', 'ST', 'RW'].indexOf(code) + 1);
function formation(id) {
  return { id, code: '4-3-3', name: '4-3-3', formation_positions: codes.map((code, i) => ({
    id: id * 100n + BigInt(i), formation_id: id, position_id: positionId(code), order_no: i + 1,
    positions: { id: positionId(code), code, category: category(code) },
  })) };
}
function player(id, clubId, index) {
  const code = codes[index % 11];
  return {
    id, current_club_id: clubId, first_name: 'Player', last_name: String(id), squad_number: index + 1,
    squad_type: 'FIRST_TEAM', age: 25, reputation: 1000 + index, ovr: 60 + Math.floor(index / 11),
    player_status: { condition: 100, fitness: 100, fatigue: 0, morale: 60, form: 60, match_sharpness: 60, is_injured: false, is_suspended: false, is_on_national_duty: false },
    player_positions: [{ position_id: positionId(code), ability: 90, positions: { code, category: category(code) } }],
    injuries: [],
  };
}
function savedXI(players, form = formation(1n)) {
  return form.formation_positions.map((slot, i) => ({
    id: BigInt(i + 1), player_id: players[i].id, formation_position_id: slot.id,
    role: 'CUSTOM_ROLE', duty: 'ATTACK', lineup_role: 'STARTING', order_no: i + 1,
  }));
}

function fixture() {
  let state = {
    competitions: [
      { id: 9n, season_id: 7n, country_id: 1n, name: 'Vietnam League', competitions: { competition_type: 'DOMESTIC_LEAGUE', country_id: 1n, is_youth: false } },
      { id: 30n, season_id: 7n, country_id: 1n, name: 'Vietnam Cup', competitions: { competition_type: 'DOMESTIC_CUP', country_id: 1n, is_youth: false } },
      { id: 31n, season_id: 7n, country_id: 1n, name: 'Vietnam Super Cup', competitions: { competition_type: 'DOMESTIC_SUPER_CUP', country_id: 1n, is_youth: false } },
    ],
    nextId: 1000n, formations: [formation(1n), formation(2n)],
    players: [10n, 20n].flatMap((clubId, team) => Array.from({ length: 22 }, (_, i) => player(BigInt(team * 100 + i + 1), clubId, i))),
    tactics: [], positions: [], lineups: [], matchPlayers: [], events: [], transactions: [], balance: 0,
    locks: [], queries: [], rankBatches: [], rankHistory: [], failEvents: false,
    stats: [], bans: [], injuries: [], standings: [],
    clubs: [
      { id: 10n, world_id: 1n, ranking_points: 1000, world_rank: 2, previous_world_rank: 0 },
      { id: 20n, world_id: 1n, ranking_points: 1000, world_rank: 3, previous_world_rank: 0 },
      { id: 30n, world_id: 1n, ranking_points: 1010, world_rank: 1, previous_world_rank: 0 },
      { id: 40n, world_id: 2n, ranking_points: 5000, world_rank: 1, previous_world_rank: 0 },
    ],
    coaches: [10n, 20n].map((clubId, i) => ({ id: BigInt(i + 1), staff_id: BigInt(i + 1), club_id: clubId, status: 'ACTIVE', role: 'HEAD_COACH', squad_type: 'FIRST_TEAM',
      staff: { id: BigInt(i + 1), name: 'Head coach', preferred_formation_id: 2n, secondary_formation_id: 1n, tactical_style: 'TIKI_TAKA', staff_attributes: {} } })),
    match: { id: 50n, home_club_id: 10n, away_club_id: 20n, status: 'SCHEDULED',
      season_id: 7n, competition_season_id: 9n, stage_id: 12n, group_id: 1n, tie_id: null,
      match_date: new Date('2026-11-25T00:00:00Z'), kickoff_time: new Date('1970-01-01T19:00:00Z'), season_day: 4, match_type: 'COMPETITIVE',
      competition_stages: { id: 12n, stage_type: 'LEAGUE' },
      competition_seasons: { id: 9n, name: 'Test League', season_id: 7n, country_id: 1n, competitions: { is_youth: false, age_limit: null, participant_type: 'CLUB', competition_type: 'DOMESTIC_LEAGUE', format_type: 'LEAGUE' } },
      clubs_matches_home_club_idToclubs: { id: 10n, world_id: 1n, name: 'Home', reputation: 1000, stadiums: [], financial_accounts: [{ id: 8n }] },
      clubs_matches_away_club_idToclubs: { id: 20n, world_id: 1n, name: 'Away', reputation: 1000 },
    },
  };
  const id = () => state.nextId++;
  const form = formId => state.formations.find(f => f.id === formId);
  const hydrateTactic = t => t ? { ...t, formations: form(t.formation_id), club_tactic_positions: state.positions.filter(p => p.tactic_id === t.id) } : null;
  const tx = {
    $queryRaw: async (strings, value) => { state.locks.push([strings.join('?'), value]); return []; },
    $executeRaw: async query => {
      // Emulate the parameterized CASE update against this fixture's in-memory clubs.
      const values = query.values, size = (values.length - 1) / 3;
      if (!Number.isInteger(size) || !query.sql.includes('previous_world_rank = world_rank')) throw new Error('Unexpected ranking SQL');
      const worldId = values[size * 2];
      const ids = new Set(values.slice(size * 2 + 1));
      const positions = new Map(Array.from({ length: size }, (_, i) => [values[i * 2], values[i * 2 + 1]]));
      state.rankBatches.push({ sql: query.sql, values: structuredClone(values) });
      let changed = 0;
      for (const club of state.clubs) if (club.world_id === worldId && ids.has(club.id)) {
        club.previous_world_rank = club.world_rank;
        club.world_rank = positions.get(club.id);
        changed++;
      }
      return changed;
    },
    club_rankings: {
      findFirst: async ({ where }) => state.rankHistory.find(row => row.world_id === where.world_id &&
        row.ranking_type === where.ranking_type && row.ranking_date.getTime() === where.ranking_date.getTime()) || null,
      createMany: async ({ data }) => { state.rankHistory.push(...data.map(row => ({ id: id(), ...row }))); return { count: data.length }; },
    },
    clubs: {
      findMany: async ({ where, orderBy }) => {
        const rows = state.clubs.filter(c => c.world_id === where.world_id && (!where.id || where.id.in.includes(c.id)));
        if (orderBy) rows.sort((a,b) => b.ranking_points - a.ranking_points || Number(a.id-b.id));
        return structuredClone(rows);
      },
      update: async ({ where, data }) => Object.assign(state.clubs.find(c => c.id === where.id), data),
    },
    matches: {
      findUnique: async ({ include } = {}) => include?.match_lineups ? { ...state.match,
        match_lineups: state.lineups.map(l => ({ ...l, formations: form(l.formation_id), match_players: state.matchPlayers.filter(p => p.lineup_id === l.id).map(p => ({ ...p, players: state.players.find(row => row.id === p.player_id) })) })),
        match_events: state.events.map(e => ({ ...e, players_match_events_player_idToplayers: state.players.find(p => p.id === e.player_id),
          players_match_events_related_player_idToplayers: state.players.find(p => p.id === e.related_player_id) })),
      } : state.match,
      update: async ({ data }) => Object.assign(state.match, data),
    },
    staff_contracts: { findMany: async ({ where }) => state.coaches.filter(c => c.club_id === where.club_id && c.status === where.status && where.role.in.includes(c.role)) },
    formations: { findUnique: async ({ where }) => form(where.id), findFirst: async () => state.formations[0] || null },
    players: { findMany: async ({ where }) => {
      state.queries.push(structuredClone(where));
      return state.players.filter(p => p.current_club_id === where.current_club_id && (!where.squad_type || p.squad_type === where.squad_type) && (!where.age || p.age <= where.age.lte)).map(p => ({ ...p, player_suspensions: state.bans.filter(b => b.player_id === p.id && b.status === 'ACTIVE').map(b => ({ ...b, competition_seasons: state.competitions.find(c => c.id === b.competition_season_id) || null })) }));
    } },
    club_tactics: {
      findFirst: async ({ where }) => hydrateTactic(state.tactics.find(t => t.club_id === where.club_id && t.squad_type === where.squad_type)),
      create: async ({ data }) => { const row = { id: id(), ...data }; state.tactics.push(row); return hydrateTactic(row); },
    },
    club_tactic_positions: {
      createMany: async ({ data }) => { state.positions.push(...data.map(p => ({ id: id(), ...p }))); },
      update: async ({ where, data }) => Object.assign(state.positions.find(p => p.id === where.id), data),
      deleteMany: async ({ where }) => { state.positions = state.positions.filter(p => !where.id.in.includes(p.id)); },
    },
    match_lineups: {
      findUnique: async ({ where }) => state.lineups.find(l => l.id === where.id),
      findFirst: async ({ where }) => {
        const row = state.lineups.find(l => l.match_id === where.match_id && l.club_id === where.club_id);
        return row ? { ...row, formations: form(row.formation_id), match_players: state.matchPlayers.filter(p => p.lineup_id === row.id) } : null;
      },
      create: async ({ data }) => { const row = { id: id(), ...data }; state.lineups.push(row); return row; },
      update: async ({ where, data }) => Object.assign(state.lineups.find(l => l.id === where.id), data),
    },
    match_players: {
      findMany: async ({ where }) => [...state.matchPlayers, ...(state.pastMatchPlayers || [])].filter(row => {
        const match = row.matches || (row.match_id === state.match.id ? state.match : null);
        const matchesWhere = (value, filter) => Object.entries(filter).every(([key, expected]) => {
          if (key === 'OR') return expected.some(child => matchesWhere(value, child));
          if (key === 'AND') return expected.every(child => matchesWhere(value, child));
          const actual = key === 'competition_seasons' ? value?.competition_seasons || state.competitions.find(c => c.id === value?.competition_season_id) : value?.[key];
          if (expected && typeof expected === 'object') {
            if ('in' in expected) return expected.in.includes(actual);
            if ('not' in expected) return actual !== expected.not;
            if ('gt' in expected) return actual > expected.gt;
            return matchesWhere(actual, expected);
          }
          return actual === expected;
        });
        return match && where.player_id.in.includes(row.player_id) && (!where.match_id || row.match_id !== where.match_id.not) &&
          (!where.yellow_cards || row.yellow_cards > where.yellow_cards.gt) && matchesWhere(match, where.matches);
      }).map(row => ({ ...row, matches: { ...(row.matches || state.match),
        competition_seasons: row.matches?.competition_seasons || state.competitions.find(c => c.id === (row.matches || state.match).competition_season_id) } })),
      deleteMany: async ({ where }) => { state.matchPlayers = state.matchPlayers.filter(p => p.lineup_id !== where.lineup_id); },
      createMany: async ({ data }) => { state.matchPlayers.push(...data.map(p => ({ id: id(), ...p }))); },
      updateMany: async ({ where, data }) => { for (const p of state.matchPlayers.filter(p => p.lineup_id === where.lineup_id && p.player_id === where.player_id)) Object.assign(p, data); },
    },
    match_events: { createMany: async ({ data }) => { if (state.failEvents) throw new Error('event persistence failed'); state.events.push(...data.map(e => ({ id: id(), ...e }))); } },
    injury_types: { findFirst: async () => ({ id: 1n }) },
    injuries: { create: async ({ data }) => { const row = { id: id(), ...data }; state.injuries.push(row); state.players.find(p => p.id === data.player_id).injuries.push(row); return row; } },
    player_status: { update: async ({ where, data }) => Object.assign(state.players.find(p => p.id === where.player_id).player_status, data) },
    player_statistics: {
      findMany: async ({ where }) => state.stats.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)),
      deleteMany: async ({ where }) => { state.stats = state.stats.filter(row => !where.id.in.includes(row.id)); },
      findFirst: async ({ where }) => state.stats.find(row => Object.entries(where).every(([key, v]) => row[key] === v)) || null,
      create: async ({ data }) => { const row = { id: id(), ...data }; state.stats.push(row); return row; },
      update: async ({ where, data }) => Object.assign(state.stats.find(row => row.id === where.id), data),
    },
    player_suspensions: {
      findMany: async ({ where }) => state.bans.filter(b => b.status === where.status &&
        (!where.player_id || (typeof where.player_id === 'bigint' ? b.player_id === where.player_id : where.player_id.in.includes(b.player_id))) &&
        (!where.OR || where.OR.some(w => w.competition_season_id === b.competition_season_id))).map(b => ({ ...b, competition_seasons: state.competitions.find(c => c.id === b.competition_season_id) || null })),
      create: async ({ data }) => { const row = { id: id(), matches_served: 0, ...data }; state.bans.push(row); return row; },
      update: async ({ where, data }) => Object.assign(state.bans.find(b => b.id === where.id), data),
    },
    stage_standings: {
      findFirst: async ({ where }) => state.standings.find(row => Object.entries(where).every(([key, v]) => row[key] === v)),
      findMany: async ({ where }) => state.standings.filter(row => row.stage_id === where.stage_id && row.group_id === where.group_id)
        .sort((a, b) => b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for || Number(a.club_id - b.club_id)),
      create: async ({ data }) => { const row = { id: id(), ...data }; state.standings.push(row); return row; },
      update: async ({ where, data }) => Object.assign(state.standings.find(row => row.id === where.id), data),
    },
    financial_accounts: { update: async ({ data }) => { state.balance += data.balance_cash.increment; } },
    financial_transactions: { create: async ({ data }) => { state.transactions.push(data); } },
  };
  let tail = Promise.resolve();
  const db = { $transaction: work => {
    const operation = tail.then(async () => {
      const before = structuredClone(state);
      try { return await work(tx); } catch (error) { state = before; throw error; }
    });
    tail = operation.catch(() => {});
    return operation;
  } };
  const service = new MatchLineupService();
  const prepare = () => db.$transaction(t => service.prepareMatchLineups(t, state.match));
  const addTactic = (clubId = 10n) => {
    const tactic = { id: id(), club_id: clubId, squad_type: 'FIRST_TEAM', formation_id: 1n,
      mentality: 'DEFENSIVE', tempo: 33, passing_style: 'LONG', pressing_intensity: 22, defensive_line: 30 };
    state.tactics.push(tactic);
    const players = state.players.filter(p => p.current_club_id === clubId);
    const positions = savedXI(players).map(p => ({ ...p, id: id(), tactic_id: tactic.id }));
    state.positions.push(...positions);
    return { tactic, positions };
  };
  const results = new MatchResultService();
  const simulator = new MatchSimulatorService(db, service, results);
  return { state: () => state, prepare, addTactic, simulator, results, tx, db, matches: new MatchesService({ ...tx, ...db }, simulator) };
}


module.exports = { fixture, formation, player, savedXI };
