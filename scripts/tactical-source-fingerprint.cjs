const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
module.exports = function tacticalSourceFingerprint() {
  const hash = createHash('sha256');
  for (const name of ['match-engine.ts', 'match-engine.legacy.ts', 'tactical-matchups.ts', 'tactical-dominance.ts',
    'tactic-normalizer.ts', 'player-decision-policy.ts', 'coaching-adaptation.ts', 'tactical-rulebook.ts', 'tactical-rulebook-v2.ts']) {
    hash.update(name + '\n');
    hash.update(fs.readFileSync(path.resolve(__dirname, '../src/modules/matches', name), 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
};
module.exports.guideHash = function guideHash() {
  const rows = fs.readFileSync(path.resolve(__dirname, '../../BANG_THAM_KHAO_KHAC_CHE_CHO_NGUOI_CHOI.md'), 'utf8')
    .split(/\r?\n/).filter(line => /^\|.*\([A-Z0-9_]+\).*\|.*\([A-Z0-9_]+\)/.test(line)).slice(0, 16);
  return createHash('sha256').update(rows.join('\n')).digest('hex');
};
