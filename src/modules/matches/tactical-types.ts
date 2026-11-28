export type TacticalAxis = 'CENTRE' | 'WIDE' | 'BETWEEN_LINES' | 'BOX' | 'OUTLET' | 'SHIELD';
export type TacticalPhase = 'BUILDUP' | 'PROGRESSION' | 'CREATION';
export interface TacticalPair {
  a: string; b: string; winner: string | null; disadvantaged: string | null;
  basePenalty: number; mitigationIds: string[]; affectedAxes?: TacticalAxis[]; reason?: string;
}
export interface TacticalRulebook {
  version: string; hash: string;
  limits: { formationTiers: number[]; styleTiers: number[]; maxMitigation: number;
    maxAdditionalMistakePenalty: number; maxCombinedPenaltyPerPossession: number; applyTo?: string };
  formations: { code: string; positions: { position: string; x: number; y: number }[] }[];
  formationPairs: TacticalPair[]; stylePairs: TacticalPair[];
  styles: { code: string; preset: { mentality: string; tempo: number; passingStyle: string; pressing: number; line: number } }[];
  instructions: string[]; roles: string[];
  dominance?: { strength: number; tierExponent: number; mitigationExponent: number;
    styleWeight: number; incoherenceWeight: number; maxPressure: number;
    controlWeight: number; opportunityWeight: number; outletCompletionWeight: number; routeFloor: number;
    referenceResidualFloor: number };
}
