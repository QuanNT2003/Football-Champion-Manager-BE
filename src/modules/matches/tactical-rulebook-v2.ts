import { createHash } from 'node:crypto';
import { TACTICAL_RULEBOOK } from './tactical-rulebook';
import type { TacticalRulebook } from './tactical-types';

// Keep rulebook 1.0.0 unchanged for contextual_v1 replays. No winner is assigned by this model.
const { hash: previousHash, ...previous } = TACTICAL_RULEBOOK;
const data: Omit<TacticalRulebook, 'hash'> = {
  ...previous, version: '2.0.0',
  dominance: { strength: .5, tierExponent: .15, mitigationExponent: 1, styleWeight: .25,
    incoherenceWeight: .5, maxPressure: 3, controlWeight: .35, opportunityWeight: .9,
    outletCompletionWeight: .04, routeFloor: .75, referenceResidualFloor: .05 },
};
export const TACTICAL_RULEBOOK_V2: TacticalRulebook = {
  ...data, hash: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
};
