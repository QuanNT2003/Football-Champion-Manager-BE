/** Pure offline sweep: never connects to Prisma or changes game data. Run after npm run build. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { simulateMatchEngine } = require('../dist/modules/matches/match-engine');
const { TACTICAL_RULEBOOK: book } = require('../dist/modules/matches/tactical-rulebook');
const { stylePreset } = require('../dist/modules/matches/tactic-normalizer');
const { tacticalInput } = require('../test/helpers/tactical-fixture.cjs');
const samples = Number(process.argv.find(a => a.startsWith('--samples='))?.split('=')[1] || 8);
assert.ok(Number.isInteger(samples) && samples >= 2 && samples <= 1000);
const start = Date.now();
const report = { engine: '2.2.0', ruleset: book.version, hash: book.hash, samples, matches: 0, formationPairs: [], stylePairs: [], byFormation: {} };
for (const [pairs, field, output] of [[book.formationPairs, 'formationCode', report.formationPairs], [book.stylePairs, 'tacticalStyle', report.stylePairs]]) {
  for (const p of pairs) {
    const row = { a: p.a, b: p.b, baselineDisadvantaged: p.disadvantaged, winsA: 0, draws: 0, winsB: 0, goalsA: 0, goalsB: 0 };
    for (let i = 0; i < samples; i++) for (const swap of [false, true]) {
      const a = swap ? p.b : p.a, b = swap ? p.a : p.b;
      const input = tacticalInput(5000 + i, field === 'formationCode' ? a : '433_ATT', field === 'formationCode' ? b : '433_ATT');
      if (field === 'tacticalStyle') {
        input.home.tacticalStyle = a; input.away.tacticalStyle = b;
        input.home.tactic = stylePreset(a); input.away.tactic = stylePreset(b);
      }
      const r = simulateMatchEngine(input);
      const ga = swap ? r.awayScore : r.homeScore, gb = swap ? r.homeScore : r.awayScore;
      if (ga > gb) row.winsA++; else if (ga < gb) row.winsB++; else row.draws++;
      row.goalsA += ga; row.goalsB += gb;
      assert.ok(Number.isFinite(r.home.statistics.xG) && Number.isFinite(r.away.statistics.xG));
      for (const team of [r.home, r.away]) for (const player of team.players) assert.ok(player.stats.fitnessStart - player.stats.fitnessEnd <= 23.001);
      report.matches++;
    }
    output.push(row);
  }
  process.stdout.write(`${field}: ${output.length} pairs checked\n`);
}
for (const f of book.formations) {
  const rows = report.formationPairs.filter(p => p.a === f.code || p.b === f.code);
  const wins = rows.reduce((n, p) => n + (p.a === f.code ? p.winsA : p.winsB), 0);
  report.byFormation[f.code] = { wins, matches: rows.length * samples * 2, winRate: Math.round(wins / (rows.length * samples * 2) * 1000) / 10 };
}
report.elapsedMs = Date.now() - start;
const output = process.argv.find(a => a.startsWith('--output='))?.slice('--output='.length);
if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ matches: report.matches, elapsedMs: report.elapsedMs, byFormation: report.byFormation }));
