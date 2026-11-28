const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const oldResolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  return oldResolve.call(this, name.startsWith('@/') ? require('node:path').join(__dirname, '../dist', name.slice(2)) : name, ...args);
};
const { TacticsService } = require('../dist/modules/tactics/tactics.service');
Module._resolveFilename = oldResolve;

function fixture() {
  let state = { tactic: { id: 1n }, positions: [{ id: 2n, formation_position_id: 4n }], instructions: [{ tactic_position_id: 2n, instruction_id: 8n }], writes: 0 };
  let fail = false;
  const tx = {
    club_tactics: { findFirst: async () => state.tactic, update: async () => { state.writes++; } },
    club_tactic_positions: {
      findMany: async () => state.positions,
      update: async ({ where, data }) => { state.writes++; return Object.assign(state.positions.find(p => p.id === where.id), data); },
      deleteMany: async () => {},
    },
    tactic_position_instructions: {
      deleteMany: async () => { state.instructions = []; },
      createMany: async ({ data }) => { if (fail) throw Error('join failed'); state.instructions = data; },
    },
  };
  const db = {
    tactical_instructions: { findMany: async ({ where }) => where.code.in.map((code, i) => ({ id: BigInt(i + 10), code })) },
    $transaction: async fn => { const before = structuredClone(state); try { return await fn(tx); } catch (e) { state = before; throw e; } },
  };
  const service = new TacticsService(db); service.getClubTactic = async () => structuredClone(state);
  return { service, state: () => state, fail: () => fail = true };
}
const payload = instructions => ({ positions: [{ formationPositionId: '4', playerId: '7', role: 'ANCHOR_MAN', duty: 'DEFEND', ...(instructions === undefined ? {} : { instructions }) }] });

test('position instruction replacement is deduplicated, omission preserves it, [] clears it, no bench clearing', async () => {
  const f = fixture();
  await f.service.updateClubTactic(5n, payload(['MID_BLOCK', 'MID_BLOCK', 'LOW_BLOCK_BUS']));
  assert.equal(f.state().instructions.length, 1); assert.equal(f.state().instructions[0].tactic_position_id, 2n);
  const saved = structuredClone(f.state().instructions);
  await f.service.updateClubTactic(5n, payload()); assert.deepEqual(f.state().instructions, saved);
  await f.service.updateClubTactic(5n, payload([])); assert.deepEqual(f.state().instructions, []);
});
test('unknown instruction is rejected before writes and join failure rolls back tactic and position', async () => {
  const f = fixture(), before = structuredClone(f.state());
  await assert.rejects(f.service.updateClubTactic(5n, payload(['UNKNOWN'])), /không hợp lệ/);
  assert.deepEqual(f.state(), before);
  f.fail(); await assert.rejects(f.service.updateClubTactic(5n, payload(['MID_BLOCK'])), /join failed/);
  assert.deepEqual(f.state(), before);
});
