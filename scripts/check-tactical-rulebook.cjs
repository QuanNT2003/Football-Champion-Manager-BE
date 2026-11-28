// Validates the checked-in runtime book against the reviewed catalog. No DB access or writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const refs = path.resolve(__dirname, '../../.agents/skills/match-tactics-system/references');
const rules = JSON.parse(fs.readFileSync(path.join(refs, 'matchup-rules.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(refs, 'catalog-snapshot.json'), 'utf8'));
const data = {
  version: '1.0.0', limits: rules.limits,
  formations: catalog.formations.map(f => ({ code: f.code, positions: f.formation_positions.map(p => ({ position: p.positions.code, x: Number(p.x), y: Number(p.y) })) })),
  formationPairs: rules.formationPairs.map(({ a, b, winner, disadvantaged, basePenalty, affectedAxes, mitigationIds }) => ({ a, b, winner, disadvantaged, basePenalty, affectedAxes, mitigationIds })),
  styles: rules.styles.map(({ code, preset }) => ({ code, preset })), stylePairs: rules.stylePairs,
  instructions: rules.instructions.map(i => i.code), roles: rules.roles.map(r => r.code),
};
const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
const source = fs.readFileSync(path.resolve(__dirname, '../src/modules/matches/tactical-rulebook.ts'), 'utf8');
const runtime = JSON.parse(source.slice(source.indexOf('{', source.indexOf('export const')), source.lastIndexOf('}') + 1));
assert.deepEqual(runtime, { ...data, hash }, 'Runtime rules changed: bump ruleset version and retain the previous replay implementation');
console.log(JSON.stringify({ version: data.version, hash, formationPairs: data.formationPairs.length, stylePairs: data.stylePairs.length, status: 'OK' }));
