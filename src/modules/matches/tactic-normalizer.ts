import type { EnginePlayer, EngineTactic, EngineTeam } from './match-engine';
import { TACTICAL_RULEBOOK } from './tactical-rulebook';

const limit = (n: number) => Math.min(100, Math.max(0, n));
export const INSTRUCTION_CONFLICTS = [
  ['HIGH_PRESS_LINE', 'MID_BLOCK', 'LOW_BLOCK_BUS'], ['FORCE_INSIDE', 'FORCE_OUTSIDE'],
  ['COUNTER_PRESS', 'REGROUP_DEFENCE'], ['QUICK_COUNTER', 'DIRECT_COUNTER', 'HOLD_SHAPE'],
  ['DISTRIBUTE_QUICKLY', 'SLOW_PACE_DOWN'], ['GET_STUCK_IN', 'STAY_ON_FEET_DEF'],
  ['HIGH_TEMPO_PLAY', 'LOW_TEMPO_CONTROL'], ['OVERLAP_WINGS', 'UNDERLAP_WINGS'],
  ['SHOOT_ON_SIGHT', 'WORK_BALL_INTO_BOX'], ['TIKI_TAKA_CONTROL', 'VERTICAL_TIKI_TAKA'],
] as const;
// These describe the team block/transition, even when stored on position rows. Count once.
export const TEAM_INSTRUCTIONS = new Set([
  'COUNTER_PRESS', 'REGROUP_DEFENCE', 'QUICK_COUNTER', 'DIRECT_COUNTER', 'HOLD_SHAPE',
  'HIGH_PRESS_LINE', 'MID_BLOCK', 'LOW_BLOCK_BUS', 'DROP_OFF_DEFENCE', 'OFFSIDE_TRAP',
  'HIGH_TEMPO_PLAY', 'LOW_TEMPO_CONTROL', 'TIKI_TAKA_CONTROL', 'VERTICAL_TIKI_TAKA',
  'EXTREMELY_WIDE', 'WING_PLAY', 'FORCE_INSIDE', 'FORCE_OUTSIDE',
]);
export function normalizeInstructions(codes: string[]): string[] {
  const result = [...new Set(codes.map(c => c.toUpperCase()).filter(c => TACTICAL_RULEBOOK.instructions.includes(c)))].sort();
  for (const group of INSTRUCTION_CONFLICTS) {
    // Ambiguous persisted conflicts resolve by catalog order, independent of player/DB row order.
    const chosen = group.find(c => result.includes(c));
    for (const code of group) if (code !== chosen && result.includes(code)) result.splice(result.indexOf(code), 1);
  }
  return result;
}
export function stylePreset(style = 'BALANCED'): EngineTactic {
  const aliases = { CATENACCIO: 'PARK_THE_BUS', DEFENSIVE: 'PARK_THE_BUS', ATTACKING: 'WING_PLAY', DIRECT: 'DIRECT_ATTACK' };
  const code = aliases[style.toUpperCase()] || style.toUpperCase();
  const p = (TACTICAL_RULEBOOK.styles.find(s => s.code === code) || TACTICAL_RULEBOOK.styles[0]).preset;
  return { mentality: p.mentality, tempo: p.tempo, passingStyle: p.passingStyle, pressing: p.pressing, defensiveLine: p.line };
}
export function resolveFormation(team: EngineTeam): string | undefined {
  if (team.formationCode) return TACTICAL_RULEBOOK.formations.find(f => f.code === team.formationCode)?.code;
  const signature = (positions: string[]) => [...positions].sort().join(',');
  const actual = signature(team.players.filter(p => p.started).map(p => p.position));
  const matches = TACTICAL_RULEBOOK.formations.filter(f => signature(f.positions.map(p => p.position)) === actual);
  return matches.length === 1 ? matches[0].code : undefined;
}
/** Saved numerical settings win over coach presets. This runs once, without mutating the caller. */
export function normalizeTeam(team: EngineTeam): EngineTeam {
  const formationCode = resolveFormation(team);
  const slots = [...(TACTICAL_RULEBOOK.formations.find(f => f.code === formationCode)?.positions || [])];
  const instructions = normalizeInstructions([...(team.instructions || []), ...team.players.filter(p => p.started).flatMap(p => p.instructions.filter(c => TEAM_INSTRUCTIONS.has(c)))]);
  return { ...team, formationCode: team.formationCode || formationCode, instructions, tactic: { ...stylePreset(team.tacticalStyle), ...team.tactic },
    players: team.players.map(p => {
      const index = p.started ? slots.findIndex(s => s.position === p.position) : -1;
      const slot = index >= 0 ? slots.splice(index, 1)[0] : undefined;
      const coords = p.coordinates;
      const validCoords = coords && Number.isFinite(coords.x) && Number.isFinite(coords.y);
      return { ...p, coordinates: validCoords ? { x: limit(coords.x), y: limit(coords.y) } : (slot ? { x: slot.x, y: slot.y } : undefined),
        instructions: normalizeInstructions(p.instructions).filter(c => !TEAM_INSTRUCTIONS.has(c)),
        attributes: { ...p.attributes }, mentality: { ...p.mentality }, traits: { ...p.traits }, status: { ...p.status } };
    }) };
}
export function effectiveTactic(saved: EngineTactic, directives: string[]): EngineTactic {
  const t = { ...saved }, has = (c: string) => directives.includes(c);
  if (has('HIGH_PRESS_LINE')) { t.pressing += 12; t.defensiveLine += 10; }
  if (has('MID_BLOCK')) { t.pressing += (50 - t.pressing) * .35; t.defensiveLine += (45 - t.defensiveLine) * .35; }
  if (has('LOW_BLOCK_BUS')) { t.defensiveLine -= 15; t.pressing -= 10; }
  if (has('DROP_OFF_DEFENCE')) t.defensiveLine -= 8;
  if (has('COUNTER_PRESS')) t.pressing += 10;
  if (has('REGROUP_DEFENCE')) t.pressing -= 10;
  if (has('HIGH_TEMPO_PLAY')) t.tempo += 12;
  if (has('LOW_TEMPO_CONTROL')) t.tempo -= 12;
  if (has('TIKI_TAKA_CONTROL')) { t.passingStyle = 'SHORT'; t.tempo -= 5; }
  if (has('VERTICAL_TIKI_TAKA')) { t.passingStyle = 'SHORT'; t.tempo += 10; }
  if (has('DIRECT_COUNTER')) t.passingStyle = 'DIRECT';
  if (has('QUICK_COUNTER')) t.tempo += 8;
  if (has('HOLD_SHAPE')) t.tempo -= 6;
  for (const k of ['tempo', 'pressing', 'defensiveLine'] as const) t[k] = limit(t[k]);
  return t;
}

export interface RoleBehaviour { pass: number; shoot: number; wide: number; run: number; shield: number; press: number; aerial: number; keeper: number; }
const behaviour = (pass = 1, shoot = 1, wide = 1, run = 1, shield = 1, press = 1, aerial = 1, keeper = 1): RoleBehaviour => ({ pass, shoot, wide, run, shield, press, aerial, keeper });
// Selection/occupation only. Technical execution still uses attr/skill and the existing roleFactor.
export const ROLE_BEHAVIOURS: Record<string, RoleBehaviour> = {
  ADVANCED_FORWARD: behaviour(.9, 1.3, 1, 1.4), ADVANCED_PLAYMAKER: behaviour(1.4, .9),
  ANCHOR_MAN: behaviour(1, .6, .8, .7, 1.5), ATTACKING_FULLBACK: behaviour(1.1, .8, 1.4, 1.3, .8),
  BALL_PLAYING_DEFENDER: behaviour(1.3, .7, 1, .8, 1.1), BALL_WINNING_MIDFIELDER: behaviour(.9, .8, 1, 1, 1.2, 1.5),
  BOX_TO_BOX: behaviour(1.1, 1.1, 1, 1.3, 1.1, 1.2), COMMANDING_KEEPER: behaviour(1, .1, 1, 1, 1.2, 1, 1.3, 1.04),
  COMPLETE_WINGBACK: behaviour(1.1, 1, 1.5, 1.4, .8), DEEP_LYING_PLAYMAKER: behaviour(1.5, .7, 1, .8, 1.2),
  FALSE_NINE: behaviour(1.4, .8, 1, .8), INVERTED_WINGER: behaviour(1, 1.3, .8, 1.2),
  MEZZALA: behaviour(1.2, 1.1, 1.3, 1.1), NO_NONSENSE_CB: behaviour(.7, .5, 1, .7, 1.4, 1, 1.2),
  POACHER: behaviour(.7, 1.5, .8, 1.3), PRESSING_FORWARD: behaviour(.9, 1.1, 1, 1.2, 1, 1.6),
  SHADOW_STRIKER: behaviour(.9, 1.3, .9, 1.4), SHOT_STOPPER: behaviour(.8, .1, 1, 1, 1, 1, 1, 1.06),
  SWEEPER_KEEPER: behaviour(1.3, .1, 1, 1.3, 1, 1.2, 1, 1.02), SWEEPER_LIBERO: behaviour(1.2, .7, 1, 1.2, 1.2),
  TARGET_MAN: behaviour(1.1, 1.1, .8, .7, 1, 1, 1.4), TRADITIONAL_WINGER: behaviour(1.1, .9, 1.5, 1.2),
  WIDE_PLAYMAKER: behaviour(1.4, .8, 1.3),
};
export function playerRole(p: EnginePlayer): RoleBehaviour {
  const signature = `${p.role}:${p.traits.primary_style}:${p.traits.secondary_style}`;
  const previous = roleCache.get(p);
  if (previous?.signature === signature) return previous.value;
  const primary = ROLE_BEHAVIOURS[p.role] || ROLE_BEHAVIOURS[String(p.traits.primary_style)] || behaviour();
  const secondary = ROLE_BEHAVIOURS[String(p.traits.secondary_style)];
  const value = Object.fromEntries(Object.entries(primary).map(([key, n]) => [key, n * .8 + (secondary?.[key] ?? n) * .2])) as unknown as RoleBehaviour;
  roleCache.set(p, { signature, value }); return value;
}
const roleCache = new WeakMap<EnginePlayer, { signature: string; value: RoleBehaviour }>();
