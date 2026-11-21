export const TRAINING_SLOTS = 6;
export const FITNESS_PER_DRILL = 2;
export const TRAINING_COST = TRAINING_SLOTS * FITNESS_PER_DRILL;
export const ATTRIBUTE_CAP = 100;
// Conditional on drill success: one / two / three distinct attributes gain +1.
export const DRILL_GAIN_WEIGHTS = [85, 10, 5] as const;
export type TrainingSquad = 'FIRST_TEAM' | 'YOUTH';

export const drillAttributes = {
  ATT_PATTERNS: ['pas', 'otb', 'tec'],
  ATT_CHANCE_CREATION: ['vis', 'pas', 'dec'],
  ATT_FINISHING: ['fin', 'cmp', 'otb'],
  ATT_CROSSING_HEADING: ['cro', 'hea', 'jum'],
  DEF_SHAPE_DISCIPLINE: ['pos', 'mar', 'dec'],
  DEF_AERIAL_DEFENCE: ['hea', 'jum', 'mar'],
  DEF_PRESSING_VAY_RAP: ['tac', 'wor', 'pos'],
  DEF_1V1_TACKLING: ['tac', 'mar', 'str'],
  TAC_MATCH_PREPARATION: ['dec', 'pos', 'otb'],
  TAC_SET_PIECE_ATTACK: ['lsh', 'cro', 'hea'],
  TAC_SET_PIECE_DEFENCE: ['pos', 'mar', 'hea'],
  PHY_STAMINA_BUILD: ['sta', 'wor'],
  PHY_SPEED_AGILITY: ['pac', 'acc', 'agi'],
  PHY_STRENGTH_WEIGHTS: ['str', 'bal', 'jum'],
  PHY_RECOVERY_HYDRO: ['sta', 'bal'],
  GK_SHOT_STOPPING: ['gk_ref', 'gk_ooo', 'agi'],
  GK_AERIAL_DOMINANCE: ['gk_aer', 'gk_han', 'jum'],
  GK_FEET_DISTRIBUTION: ['gk_kic', 'pas', 'fir'],
  MEN_TEAM_BONDING: ['wor', 'dec'],
  MEN_PRESSURE_TRAINING: ['cmp', 'dec', 'fin'],
} as const;
export type AttributeKey = typeof drillAttributes[keyof typeof drillAttributes][number];

export const categoryCoachAttribute = {
  ATTACKING: 'attacking', DEFENDING: 'defending', TACTICAL: 'tactical',
  TECHNICAL: 'technical', PHYSICAL: 'fitness', GOALKEEPING: 'gk_stopping', MENTAL: 'tactical',
} as const;

export function agePenalty(age: number, squadType: string): number {
  if (age > 30) return 25;
  if (age > 25) return 15;
  if (age < 18 || squadType === 'YOUTH_U19' || squadType === 'YOUTH_U21') return 10;
  return 0;
}

export function trainingChance(level: number, coachSkill: number, penalty: number) {
  const levelBonus = (Math.max(1, level) - 1) * 5;
  return Math.min(100, Math.max(0, 30 + levelBonus + coachSkill / 5 - penalty));
}

type CoachContract = {
  staff_id: bigint;
  role: string;
  squad_type?: string;
  staff: { name: string; staff_type: string; staff_attributes: Record<string, unknown> | null };
};

export function coachTrainingSquad(contract: { role: string; squad_type?: string }): TrainingSquad | null {
  // Youth roles remain youth even on legacy contracts whose squad field defaults to FIRST_TEAM.
  if (['HEAD_COACH_YOUTH', 'ASSISTANT_COACH_YOUTH'].includes(contract.role)
    || ['YOUTH_U19', 'YOUTH_U21'].includes(contract.squad_type)) return 'YOUTH';
  if (!contract.squad_type || contract.squad_type === 'FIRST_TEAM') return 'FIRST_TEAM';
  return null;
}

/** One best relevant coach at the club, never a sum of the whole staff. */
export function groupCoaches(contracts: CoachContract[], squadType: TrainingSquad = 'FIRST_TEAM') {
  return Object.fromEntries(Object.entries(categoryCoachAttribute).map(([category, attribute]) => {
    const roles = ['HEAD_COACH', 'ASSISTANT_COACH', 'HEAD_COACH_YOUTH', 'ASSISTANT_COACH_YOUTH'];
    if (category === 'PHYSICAL') roles.push('FITNESS_COACH');
    if (category === 'GOALKEEPING') roles.push('GOALKEEPING_COACH');
    const candidates = contracts.filter(c => coachTrainingSquad(c) === squadType && c.staff.staff_type === 'COACH' && roles.includes(c.role));
    const score = (c: CoachContract) => Math.max(0, Math.min(100, Number(c.staff.staff_attributes?.[attribute] ?? 0)));
    const best = [...candidates].sort((a, b) => score(b) - score(a) || (a.staff_id < b.staff_id ? -1 : 1))[0];
    const skill = best ? score(best) : 0;
    return [category, { staffId: best?.staff_id.toString() ?? null, name: best?.staff.name ?? null, attribute, skill, bonus: skill / 5 }];
  }));
}

export function recommendedStyle(tactic: { pressing_intensity: number; passing_style: string; mentality: string } | null, coachStyle?: string) {
  if (tactic) {
    if (tactic.pressing_intensity >= 70) return 'GEGENPRESSING';
    if (tactic.passing_style === 'SHORT') return 'TIKI_TAKA';
    if (['DEFENSIVE', 'VERY_DEFENSIVE', 'CAUTIOUS'].includes(tactic.mentality)) return 'CATENACCIO';
    if (['DIRECT', 'LONG'].includes(tactic.passing_style)) return 'COUNTER_ATTACK';
    return 'BALANCED';
  }
  return coachStyle || 'BALANCED';
}

const recommendedDrills: Record<string, readonly string[]> = {
  TIKI_TAKA: ['ATT_PATTERNS', 'ATT_CHANCE_CREATION', 'TAC_MATCH_PREPARATION', 'ATT_PATTERNS', 'ATT_FINISHING', 'PHY_STAMINA_BUILD'],
  GEGENPRESSING: ['DEF_PRESSING_VAY_RAP', 'PHY_STAMINA_BUILD', 'PHY_SPEED_AGILITY', 'TAC_MATCH_PREPARATION', 'ATT_PATTERNS', 'ATT_FINISHING'],
  COUNTER_ATTACK: ['DEF_SHAPE_DISCIPLINE', 'DEF_1V1_TACKLING', 'PHY_SPEED_AGILITY', 'ATT_CHANCE_CREATION', 'ATT_CROSSING_HEADING', 'ATT_FINISHING'],
  CATENACCIO: ['DEF_SHAPE_DISCIPLINE', 'DEF_AERIAL_DEFENCE', 'DEF_1V1_TACKLING', 'TAC_SET_PIECE_DEFENCE', 'PHY_STRENGTH_WEIGHTS', 'ATT_FINISHING'],
  WING_PLAY: ['ATT_CROSSING_HEADING', 'PHY_SPEED_AGILITY', 'ATT_PATTERNS', 'ATT_CROSSING_HEADING', 'PHY_STRENGTH_WEIGHTS', 'ATT_FINISHING'],
  BALANCED: ['ATT_PATTERNS', 'ATT_FINISHING', 'DEF_SHAPE_DISCIPLINE', 'TAC_MATCH_PREPARATION', 'PHY_STAMINA_BUILD', 'MEN_PRESSURE_TRAINING'],
};

export function recommendation(style: string, types: { id: bigint; code: string }[]) {
  const codes = recommendedDrills[style] ?? recommendedDrills.BALANCED;
  return codes.map(code => types.find(type => type.code === code)?.id.toString() ?? '');
}

export function rollDrill(attributes: Record<AttributeKey, number>, targets: readonly AttributeKey[], chance: number, random = Math.random) {
  const gains: { attribute: AttributeKey; from: number; to: number }[] = [];
  const available = [...new Set(targets)].filter(attribute => attributes[attribute] < ATTRIBUTE_CAP);
  // A single success check for the whole drill, regardless of its target count.
  if (!available.length || random() * 100 >= chance) return gains;

  const tier = random() * 100;
  const requested = tier < DRILL_GAIN_WEIGHTS[0] ? 1
    : tier < DRILL_GAIN_WEIGHTS[0] + DRILL_GAIN_WEIGHTS[1] ? 2 : 3;
  // Return an unavailable higher tier to one gain, preserving the 10% two-gain rate.
  const count = requested <= available.length ? requested : 1;
  for (let i = 0; i < count; i++) {
    // Uniform selection without replacement; capped attributes are excluded.
    const [attribute] = available.splice(Math.floor(random() * available.length), 1);
    const from = attributes[attribute];
    attributes[attribute] = from + 1;
    gains.push({ attribute, from, to: from + 1 });
  }
  return gains;
}
