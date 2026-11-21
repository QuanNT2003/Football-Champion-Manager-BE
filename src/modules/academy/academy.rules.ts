import { Prisma, players_preferred_foot } from '@prisma/client';
import { NameGenerator } from '../../common/utils/name-generator';
import { AvatarGenerator } from '../../common/utils/avatar-generator';

/** Academy contracts use season numbers, so gaps/shared world IDs cannot shorten a contract. */
export function academyContractExpirationWhere(
  worldId: bigint, completedSeasonId: bigint, completedSeasonNumber: number,
): Prisma.player_contractsWhereInput {
  return {
    is_loan_contract: false, status: 'ACTIVE', players: { world_id: worldId },
    OR: [
      { squad_role: 'ACADEMY', end_season_id: { lte: BigInt(completedSeasonNumber) } },
      { squad_role: { not: 'ACADEMY' }, end_season_id: { lte: completedSeasonId } },
    ],
  };
}

export function academyRules(level: number) {
  const academyLevel = Math.max(1, Math.min(10, Math.trunc(level) || 1));
  return {
    level: academyLevel,
    candidateCount: 5 + Math.floor(academyLevel / 2),
    eliteProbability: academyLevel * 0.03,
    minOvr: 20 + academyLevel * 2,
    maxOvr: 34 + academyLevel * 2,
  };
}

const attributeKeys = [
  'pac', 'acc', 'sta', 'str', 'agi', 'bal', 'jum', 'fin', 'lsh', 'hea',
  'dri', 'fir', 'pas', 'cro', 'tec', 'tac', 'mar', 'vis', 'dec', 'cmp',
  'pos', 'otb', 'wor', 'gk_ref', 'gk_han', 'gk_aer', 'gk_ooo', 'gk_kic',
] as const;
const mentalityKeys = [
  'professionalism', 'determination', 'complacency', 'leadership', 'temperament',
  'pressure_handling', 'greed', 'ambition', 'loyalty', 'adaptability', 'injury_proneness',
] as const;
const habitKeys = [
  'shoots_distance', 'places_shots', 'first_time_shots', 'killer_balls', 'dictates_tempo',
  'switches_play', 'cuts_inside', 'hugs_touchline', 'beats_offside', 'comes_deep',
  'dives_into_tackles', 'tight_marking',
] as const;

export interface AcademyProfile {
  version: 1;
  birth_season: number;
  birth_season_day: number;
  preferred_foot: players_preferred_foot;
  height: number;
  weight: number;
  photo_url: string;
  market_value: number;
  weekly_wage: number;
  attributes: Record<typeof attributeKeys[number], number>;
  mentality: Record<typeof mentalityKeys[number], number>;
  tactics: { primary_style: string } & Record<typeof habitKeys[number], number>;
}

export function generateCandidate(
  level: number,
  nationalityId: bigint,
  seasonNumber: number,
  position: { id: bigint; code: string },
  random: () => number = Math.random,
) {
  const rules = academyRules(level);
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const age = integer(14, 16);
  // Each candidate gets an independent roll; 30% is a probability, not a quota per intake.
  const potential = random() < rules.eliteProbability
    ? integer(80, 99)
    : integer(45 + rules.level * 2, 79);
  const ovr = Math.min(potential, integer(rules.minOvr, rules.maxOvr) + (age - 14) * 2);
  const seed = integer(1, 0x7fffffff);
  const name = NameGenerator.generatePlayerName(Number(nationalityId), seed);
  const attributes = {} as AcademyProfile['attributes'];
  // Balanced pairs keep the mean equal to the persisted OVR used by the squad API.
  for (let i = 0; i < attributeKeys.length; i += 2) {
    const delta = integer(-10, 10);
    attributes[attributeKeys[i]] = ovr + delta;
    attributes[attributeKeys[i + 1]] = ovr - delta;
  }
  const mentality = Object.fromEntries(mentalityKeys.map(key => [key, integer(15, 90)])) as AcademyProfile['mentality'];
  const code = position.code.toUpperCase();
  const style = code === 'GK' ? 'SHOT_STOPPER'
    : /CB|SW/.test(code) ? 'BALL_PLAYING_DEFENDER'
    : /LB|RB|WB/.test(code) ? 'ATTACKING_FULLBACK'
    : /DM/.test(code) ? 'ANCHOR_MAN'
    : /ST|CF/.test(code) ? 'POACHER'
    : /LW|RW|LM|RM/.test(code) ? 'TRADITIONAL_WINGER' : 'ADVANCED_PLAYMAKER';
  const tactics = {
    primary_style: style,
    ...Object.fromEntries(habitKeys.map(key => [key, random() < 0.15 ? 1 : 0])),
  } as AcademyProfile['tactics'];
  // Avoid mutually exclusive movement habits.
  if (tactics.cuts_inside) tactics.hugs_touchline = 0;
  if (tactics.beats_offside) tactics.comes_deep = 0;
  const height = integer(code === 'GK' ? 175 : 160, code === 'GK' ? 193 : 187);
  const profile: AcademyProfile = {
    version: 1,
    birth_season: seasonNumber - age,
    birth_season_day: 1,
    preferred_foot: random() < 0.1 ? 'BOTH' : random() < 0.3 ? 'LEFT' : 'RIGHT',
    height,
    weight: Math.round((height - 100) * 0.82),
    photo_url: AvatarGenerator.generatePlayerAvatar(Number(nationalityId), seed),
    market_value: ovr * ovr * 20,
    weekly_wage: Math.max(100, ovr * 10),
    attributes,
    mentality,
    tactics,
  };
  return {
    nationality_id: nationalityId,
    primary_position_id: position.id,
    first_name: name.firstName,
    last_name: name.lastName,
    age, ovr, potential,
    profile_data: profile as unknown as Prisma.InputJsonObject,
  };
}
