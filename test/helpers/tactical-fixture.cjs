const { engineInput } = require('./match-engine-fixture.cjs');
const { TACTICAL_RULEBOOK: book } = require('../../dist/modules/matches/tactical-rulebook');
function setFormation(team, code) {
  const formation = book.formations.find(f => f.code === code);
  team.formationCode = code;
  for (const [i, slot] of formation.positions.entries()) Object.assign(team.players[i], {
    position: slot.position, coordinates: { x: slot.x, y: slot.y }, formationPositionId: String(i + 1),
  });
  return team;
}
function tacticalInput(seed = 42, home = '433_ATT', away = '442_CLASS') {
  const input = engineInput(seed);
  Object.assign(input.config, { tacticalModel: 'contextual_v1', rulesetVersion: book.version, rulesetHash: book.hash });
  setFormation(input.home, home); setFormation(input.away, away);
  input.home.tacticalStyle = input.away.tacticalStyle = 'BALANCED';
  return input;
}
module.exports = { tacticalInput, setFormation };
