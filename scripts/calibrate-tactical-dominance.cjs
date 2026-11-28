/** Offline only: load pure TypeScript sources. Never imports Prisma/services or writes game data. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('typescript');
const option = (key, fallback) => process.argv.find(s => s.startsWith(`--${key}=`))?.split('=')[1] ?? fallback;
const samples = Number(option('samples', 16)), startSeed = Number(option('seed', 7000));
const strengths = option('strengths', '').split(',').filter(Boolean).map(Number);
const suite = option('suite', 'guide');
const scenario = option('scenario', 'normal');
assert.ok(['normal', 'counterplay', 'stronger_opponent', 'tired_favored', 'weak_staff'].includes(scenario));
assert.ok(samples >= 2 && samples <= 1000 && Number.isInteger(samples));
const root = path.resolve(__dirname, '..');
const baseline = require('../test/fixtures/legacy-engine-baseline.json').cases.find(c => c.scenario === 'regular').input;
function sourceModel(strength) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} }; cache.set(file, m);
    let source = fs.readFileSync(file, 'utf8');
    if (strength != null && file.endsWith('tactical-rulebook-v2.ts')) source = source.replace(/strength: [\d.]+/, `strength: ${strength}`);
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    new Function('require', 'module', 'exports', js)(name => name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name), m, m.exports);
    return m.exports;
  }
  return { run: load(path.join(root, 'src/modules/matches/match-engine.ts')).simulateMatchEngine,
    book: load(path.join(root, 'src/modules/matches/tactical-rulebook-v2.ts')).TACTICAL_RULEBOOK_V2 };
}
const guide = fs.readFileSync(path.join(root, '../BANG_THAM_KHAO_KHAC_CHE_CHO_NGUOI_CHOI.md'), 'utf8').split('\n')
  .filter(line => /^\|.*\([A-Z0-9_]+\).*\|.*\([A-Z0-9_]+\)/.test(line)).slice(0, 16).map(line => {
    const cells = line.split('|').map(s => s.trim());
    const codes = [...line.matchAll(/\(([A-Z0-9_]+)\)/g)].map(m => m[1]);
    const sliders = cells[5].replaceAll('*', '').split('/').map(Number);
    return { opponent: codes[0], favored: codes[1], tactic: {
      mentality: { 'Cân bằng': 'BALANCED', 'Tấn công': 'ATTACKING', 'Phòng ngự': 'DEFENSIVE' }[cells[3]],
      passingStyle: { 'Ngắn': 'SHORT', 'Hỗn hợp': 'MIXED', 'Trực diện': 'DIRECT' }[cells[4]],
      tempo: sliders[0], pressing: sliders[1], defensiveLine: sliders[2],
    } };
  });
assert.equal(guide.length, 16);
function formation(team, code, book) {
  team.formationCode = code; team.tacticalStyle = 'BALANCED'; team.instructions = [];
  for (const [i, slot] of book.formations.find(f => f.code === code).positions.entries()) {
    Object.assign(team.players[i], { position: slot.position, coordinates: { x: slot.x, y: slot.y } });
  }
}
const reports = [];
for (const strength of strengths.length ? strengths : [undefined]) {
  assert.ok(strength == null || Number.isFinite(strength) && strength >= 0 && strength <= 10);
  const { run, book } = sourceModel(strength);
  const pairs = suite === 'all' ? book.formationPairs.filter(p => p.basePenalty).map(p => ({ opponent: p.disadvantaged, favored: p.winner,
    tactic: guide.find(g => g.favored === p.winner)?.tactic || baseline.home.tactic })) : guide;
  const report = { engine: '2.3.0', ruleset: book.version, hash: book.hash, strength: book.dominance.strength,
    sourceHash: strength == null ? require('./tactical-source-fingerprint.cjs')() : null,
    guideHash: require('./tactical-source-fingerprint.cjs').guideHash(),
    suite, scenario, samples, startSeed, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, pairs: [] };
  const start = Date.now();
  for (const spec of pairs) {
    const row = { opponent: spec.opponent, favored: spec.favored, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
    for (let seed = startSeed; seed < startSeed + samples; seed++) for (const side of ['home', 'away']) {
      const input = structuredClone(baseline); input.seed = seed;
      input.config = { injuryRate: 0, homeAdvantage: 1, userAttributeBonus: 0, tacticalModel: 'contextual_v2', rulesetVersion: book.version, rulesetHash: book.hash };
      const other = side === 'home' ? 'away' : 'home';
      formation(input[side], spec.favored, book); formation(input[other], spec.opponent, book);
      input[side].tactic = { ...spec.tactic };
      if (scenario === 'counterplay') {
        Object.assign(input[other].tactic, { mentality: 'BALANCED', tempo: 35, passingStyle: 'DIRECT', pressing: 35, defensiveLine: 35 });
        input[other].instructions = ['WING_PLAY', 'REGROUP_DEFENCE', 'WORK_BALL_INTO_BOX', 'MID_BLOCK'];
        for (const p of input[other].players) {
          if (p.position === 'ST') p.role = 'FALSE_NINE';
          p.traits.switches_play = 1;
          p.duty = ['ST', 'SS', 'LW', 'RW'].includes(p.position) ? 'SUPPORT' : 'DEFEND';
        }
      }
      if (scenario === 'stronger_opponent') for (const p of input[other].players) {
        p.ovr = 85; for (const key of Object.keys(p.attributes)) p.attributes[key] = 85;
      }
      if (scenario === 'tired_favored') for (const p of input[side].players) p.status.fitness = 0;
      if (scenario === 'weak_staff') for (const c of input[side].coaches) for (const key of Object.keys(c.attributes)) c.attributes[key] = 20;
      const result = run(input), ownGoals = result[`${side}Score`], otherGoals = result[`${other}Score`];
      const outcome = ownGoals > otherGoals ? 'wins' : ownGoals === otherGoals ? 'draws' : 'losses';
      row[outcome]++; row.goalsFor += ownGoals; row.goalsAgainst += otherGoals;
      report[outcome]++; report.matches++; report.goalsFor += ownGoals; report.goalsAgainst += otherGoals;
    }
    report.pairs.push(row);
  }
  report.winRate = report.wins / report.matches; report.elapsedMs = Date.now() - start;
  reports.push(report); console.log(JSON.stringify({ strength: report.strength, suite, scenario, matches: report.matches, wins: report.wins,
    draws: report.draws, losses: report.losses, winRate: report.winRate, goalsFor: report.goalsFor, goalsAgainst: report.goalsAgainst, elapsedMs: report.elapsedMs }));
}
const output = option('output'); if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(reports, null, 2) + '\n');
