// Run the entire existing execution/invariants suite against the new tactical model as well.
const fixture = require('./helpers/match-engine-fixture.cjs');
const original = fixture.engineInput;
fixture.engineInput = seed => {
  const input = original(seed);
  input.config.tacticalModel = 'contextual_v1';
  return input;
};
require('./match-engine.test.cjs');
