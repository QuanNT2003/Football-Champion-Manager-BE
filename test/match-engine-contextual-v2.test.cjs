// Preserve all execution, fitness, staff, cards, injury and tie-break invariants in the stronger model.
const fixture = require('./helpers/match-engine-fixture.cjs');
const original = fixture.engineInput;
fixture.engineInput = seed => {
  const input = original(seed);
  input.config.tacticalModel = 'contextual_v2';
  return input;
};
require('./match-engine.test.cjs');
