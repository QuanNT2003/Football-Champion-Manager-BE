import type { EnginePlayer, EngineTactic } from './match-engine';
import { playerRole } from './tactic-normalizer';

export interface PossessionDecision { route: 'CENTRE' | 'WIDE' | 'SPACE'; risky: boolean; dribbleChance: number; shootFactor: number; completion: number; }
export function keeperPolicy(player: EnginePlayer, cross = false, route = 'CENTRE') {
  const role = playerRole(player);
  return { distribution: 1 + (role.pass - 1) * .15,
    stopping: cross ? 1 + (role.aerial - 1) * .15 : route === 'SPACE' ? 1 + (role.run - 1) * .15 : role.keeper };
}
export function defensivePolicy(instructions: string[], route = 'CENTRE') {
  const has = (code: string) => instructions.includes(code);
  return {
    marking: has('TIGHT_MAN_MARKING') ? 1.04 : 1,
    duelAdjustment: has('STAY_ON_FEET_DEF') ? -.025 : 0,
    aggression: has('GET_STUCK_IN') ? .05 : has('STAY_ON_FEET_DEF') ? -.04 : 0,
    offsideBonus: has('OFFSIDE_TRAP') ? .025 : 0,
    routePenalty: route === 'WIDE' && has('FORCE_INSIDE') || route !== 'WIDE' && has('FORCE_OUTSIDE') ? .035 : 0,
  };
}
/** Chooses an available route. Decision quality affects choices; execution still uses the engine's skill contests. */
export function decidePossession(player: EnginePlayer, teammates: EnginePlayer[], tactic: EngineTactic,
  directives: string[], pressure: number, decisionSkill: number, rng: () => number): PossessionDecision {
  const has = (c: string) => player.instructions.includes(c) || directives.includes(c);
  const role = playerRole(player);
  const wideOutlet = teammates.some(p => p.id !== player.id && ((p.coordinates?.x ?? 50) < 25 || (p.coordinates?.x ?? 50) > 75));
  const runner = teammates.some(p => p.id !== player.id && (p.coordinates?.y ?? 50) > 65 && p.duty !== 'DEFEND');
  const judgement = Math.min(.96, Math.max(.08, .45 + (decisionSkill - pressure * .4 - tactic.tempo * .15) / 160));
  const readsGame = rng() < judgement;
  const widePreference = role.wide + (has('WING_PLAY') || has('EXTREMELY_WIDE') ? .65 : 0) +
    (has('OVERLAP_WINGS') ? .4 : 0) + (player.traits.hugs_touchline || player.traits.switches_play ? .35 : 0) - (has('UNDERLAP_WINGS') ? .5 : 0);
  let route: PossessionDecision['route'] = wideOutlet && rng() < .3 * widePreference ? 'WIDE' : 'CENTRE';
  const seekingSpace = !!player.traits.killer_balls || has('PASS_INTO_SPACE') || has('VERTICAL_TIKI_TAKA') || ['DIRECT', 'LONG'].includes(tactic.passingStyle);
  if (runner && seekingSpace && (!readsGame || pressure < decisionSkill + 15)) route = 'SPACE';
  const risky = route === 'SPACE' || !readsGame && !!player.traits.killer_balls;
  const retain = has('WORK_BALL_INTO_BOX') || has('TIKI_TAKA_CONTROL');
  return { route, risky,
    dribbleChance: Math.min(.38, Math.max(.04, .15 * role.run + (player.traits.cuts_inside ? .04 : 0) - (retain ? .04 : 0))),
    shootFactor: (has('SHOOT_ON_SIGHT') ? 1.22 : retain ? .88 : 1) * (readsGame ? 1.025 : .94),
    completion: (readsGame ? .012 : -.022) + (has('PLAY_OUT_OF_DEFENCE') ? .018 : 0) +
      (has('SLOW_PACE_DOWN') ? .015 : 0) - (has('DISTRIBUTE_QUICKLY') ? .015 : 0) +
      (has('HOLD_SHAPE') ? .008 : 0) - (has('QUICK_COUNTER') || has('DIRECT_COUNTER') ? .012 : 0),
  };
}
