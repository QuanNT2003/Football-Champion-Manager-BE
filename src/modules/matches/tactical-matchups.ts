import type { EnginePlayer, EngineTactic, EngineTeam } from './match-engine';
import { playerRole } from './tactic-normalizer';
import { TACTICAL_RULEBOOK } from './tactical-rulebook';
import type { TacticalAxis, TacticalPair, TacticalRulebook } from './tactical-types';
import type { TacticalPressure } from './tactical-dominance';

const bounded = (n: number) => Math.max(0, Math.min(1, n));
export interface TacticalState {
  formationCode?: string; tacticalStyle?: string; tactic: EngineTactic; instructions?: string[]; players: EnginePlayer[];
}
export interface MatchupEffects {
  buildup: number; progression: number; creation: number; defense: number;
  total: number; mitigation: number; mitigationIds: string[]; axes: TacticalAxis[];
  byAxis: Record<TacticalAxis, number>;
  pressure?: TacticalPressure;
}
export function findPair(pairs: TacticalPair[], a: string, b: string): TacticalPair | undefined {
  return a && b && a !== b ? pairs.find(p => p.a === a && p.b === b || p.a === b && p.b === a) : undefined;
}
/** Structural responses, not a second player-quality/OVR bonus. Values are continuous in slider settings. */
export function mitigationSignals(team: TacticalState): Record<string, number> {
  const t = team.tactic, ps = team.players.filter(p => p.position !== 'GK');
  const has = (c: string) => team.instructions?.includes(c) || ps.some(p => p.instructions.includes(c));
  const count = (positions: string[]) => ps.filter(p => positions.includes(p.position));
  const central = count(['CM', 'DM', 'AM']);
  const dropping = ps.some(p => playerRole(p).pass >= 1.3 && ['ST', 'SS', 'AM'].includes(p.position) || !!p.traits.comes_deep);
  const protectedWide = count(['LB', 'RB', 'LWB', 'RWB', 'LM', 'RM']).filter(p => p.duty !== 'ATTACK');
  const shield = count(['DM', 'CB', 'SW']).filter(p => p.duty !== 'ATTACK');
  const conservative = (100 - t.defensiveLine) / 100;
  const direct = ['DIRECT', 'LONG'].includes(t.passingStyle);
  return {
    M01: bounded(central.length / 7 + (dropping ? .35 : 0) + (100 - t.tempo) / 250),
    M02: bounded(shield.length / 6 + conservative * .35 + (has('DROP_OFF_DEFENCE') ? .15 : 0)),
    M03: bounded(protectedWide.length / 5 + conservative * .25 + (has('FORCE_OUTSIDE') ? .15 : 0)),
    M04: bounded((dropping ? .55 : 0) + count(['AM', 'SS', 'LAM', 'RAM']).length / 5 + (has('WORK_BALL_INTO_BOX') ? .25 : 0)),
    M05: bounded((direct ? .55 : 0) + (has('DISTRIBUTE_QUICKLY') ? .2 : 0) + (100 - t.tempo) / 250 + (has('PLAY_OUT_OF_DEFENCE') && central.length >= 3 ? .2 : 0)),
    M06: bounded(shield.length / 8 + protectedWide.length / 8 + conservative * .45 + (has('REGROUP_DEFENCE') ? .15 : 0)),
    M07: bounded((has('EXTREMELY_WIDE') || has('WING_PLAY') ? .4 : 0) + (ps.some(p => p.traits.switches_play) ? .3 : 0) + count(['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB']).length / 7),
    M08: bounded((has('WORK_BALL_INTO_BOX') ? .55 : 0) + (has('UNDERLAP_WINGS') ? .25 : 0) + (t.passingStyle === 'SHORT' ? .2 : 0)),
    M09: bounded(1 - Math.abs(t.pressing - t.defensiveLine) / 65 + (has('MID_BLOCK') ? .1 : 0)),
    M10: bounded(count(['ST', 'SS', 'LW', 'RW']).filter(p => p.duty !== 'DEFEND').length / 4 + (direct ? .3 : 0) + (has('QUICK_COUNTER') ? .25 : 0)),
  };
}
const phaseForAxis = { CENTRE: 'progression', WIDE: 'creation', BETWEEN_LINES: 'creation', BOX: 'creation', OUTLET: 'buildup', SHIELD: 'defense' } as const;
const referenceCache = new WeakMap<TacticalRulebook, Map<string, number>>();
function referenceResidual(team: TacticalState, rule: TacticalPair, book: TacticalRulebook): number {
  let cache = referenceCache.get(book);
  if (!cache) { cache = new Map(); referenceCache.set(book, cache); }
  const formation = book.formations.find(f => f.code === team.formationCode);
  const key = `${formation?.code}:${rule.mitigationIds.join(',')}`;
  if (formation && cache.has(key)) return cache.get(key);
  // Reference uses the same catalog shape with neutral settings/roles, independent of player quality.
  // This keeps passive shape counts from making one counter negligible and another overwhelming.
  const players = formation ? formation.positions.map(slot => ({ ...(team.players[0] || {}),
    position: slot.position, role: 'STANDARD', duty: 'SUPPORT', traits: {}, instructions: [],
  } as EnginePlayer)) : team.players.map(p => ({ ...p, role: 'STANDARD', duty: 'SUPPORT', traits: {}, instructions: [] }));
  const signals = mitigationSignals({ ...team, instructions: [], players,
    tactic: { mentality: 'BALANCED', tempo: 50, pressing: 50, defensiveLine: 50, passingStyle: 'MIXED' } });
  const quality = rule.mitigationIds.reduce((sum, id) => sum + (signals[id] || 0), 0) / Math.max(1, rule.mitigationIds.length);
  const residual = Math.max(book.dominance.referenceResidualFloor, 1 - quality);
  if (formation) cache.set(key, residual);
  return residual;
}
export function matchupEffects(team: TacticalState, opponent: TacticalState, book: TacticalRulebook = TACTICAL_RULEBOOK): MatchupEffects {
  const effects: MatchupEffects = { buildup: 0, progression: 0, creation: 0, defense: 0, total: 0, mitigation: 0, mitigationIds: [], axes: [],
    byAxis: { CENTRE: 0, WIDE: 0, BETWEEN_LINES: 0, BOX: 0, OUTLET: 0, SHIELD: 0 } };
  const signals = mitigationSignals(team);
  if (book.dominance) effects.pressure = { total: 0, byAxis: { CENTRE: 0, WIDE: 0, BETWEEN_LINES: 0, BOX: 0, OUTLET: 0, SHIELD: 0 } };
  const formation = findPair(book.formationPairs, team.formationCode, opponent.formationCode);
  const style = findPair(book.stylePairs, team.tacticalStyle, opponent.tacticalStyle);
  for (const [rule, ownCode] of [[formation, team.formationCode], [style, team.tacticalStyle]] as const) {
    if (!rule?.basePenalty || rule.disadvantaged !== ownCode) continue;
    const quality = rule.mitigationIds.length ? rule.mitigationIds.reduce((sum, id) => sum + (signals[id] || 0), 0) / rule.mitigationIds.length : 0;
    const mitigation = Math.min(book.limits.maxMitigation, quality * book.limits.maxMitigation);
    const incoherence = Math.max(0, Math.abs(team.tactic.pressing - team.tactic.defensiveLine) - 30) / 70;
    const penalty = rule.basePenalty * (1 - mitigation) + book.limits.maxAdditionalMistakePenalty * incoherence;
    const axes: TacticalAxis[] = rule.affectedAxes?.length ? rule.affectedAxes :
      rule.mitigationIds.some(id => ['M02', 'M03', 'M06', 'M09'].includes(id)) ? ['SHIELD'] :
        rule.mitigationIds.includes('M05') ? ['OUTLET'] : ['BETWEEN_LINES'];
    if (book.dominance) {
      const config = book.dominance;
      const residual = Math.pow(Math.max(0, 1 - quality) / referenceResidual(team, rule, book), config.mitigationExponent);
      const pressure = (config.strength * Math.pow(rule.basePenalty / .04, config.tierExponent) * residual +
        config.incoherenceWeight * incoherence) * (rule === style ? config.styleWeight : 1);
      // Same-axis formation/style pressure uses the larger cause, not two copies of it.
      for (const axis of axes) effects.pressure.byAxis[axis] = Math.max(effects.pressure.byAxis[axis], pressure / axes.length);
    }
    // Allocate a rule's budget across its causes, never multiply it into every power/phase.
    for (const axis of axes) { effects[phaseForAxis[axis]] += penalty / axes.length; effects.byAxis[axis] += penalty / axes.length; }
    effects.mitigation = Math.max(effects.mitigation, mitigation);
    effects.mitigationIds.push(...rule.mitigationIds);
    effects.axes.push(...axes);
  }
  const sum = effects.buildup + effects.progression + effects.creation + effects.defense;
  const scale = sum > book.limits.maxCombinedPenaltyPerPossession ? book.limits.maxCombinedPenaltyPerPossession / sum : 1;
  for (const key of ['buildup', 'progression', 'creation', 'defense'] as const) effects[key] *= scale;
  for (const axis of Object.keys(effects.byAxis) as TacticalAxis[]) effects.byAxis[axis] *= scale;
  effects.total = sum * scale;
  effects.mitigationIds = [...new Set(effects.mitigationIds)]; effects.axes = [...new Set(effects.axes)];
  if (effects.pressure) {
    const total = Object.values(effects.pressure.byAxis).reduce((a, b) => a + b, 0);
    const scale = Math.min(1, book.dominance.maxPressure / Math.max(total, .001));
    for (const axis of Object.keys(effects.pressure.byAxis) as TacticalAxis[]) effects.pressure.byAxis[axis] *= scale;
    effects.pressure.total = total * scale;
  }
  return effects;
}

/** Ownership: lineCountFactor -> zone occupation here; legacy DIRECT/high-line bonus -> space here.
 * Role technical bonuses remain in roleFactor; role profiles here only select actions/occupy zones.
 */
export function structuralFactor(team: TacticalState, mode: 'attack' | 'defense' | 'control'): number {
  const ps = team.players.filter(p => p.position !== 'GK');
  const amount = ps.reduce((sum, p) => {
    const y = p.coordinates?.y ?? (['ST', 'SS', 'LW', 'RW'].includes(p.position) ? 82 : ['CB', 'SW', 'LB', 'RB'].includes(p.position) ? 25 : 52);
    const duty = p.duty === 'ATTACK' ? 6 : p.duty === 'DEFEND' ? -6 : 0;
    const depth = y + duty;
    return sum + (mode === 'attack' ? .55 + depth / 100 : mode === 'defense' ? 1.5 - depth / 100 : 1.3 - Math.abs(depth - 52) / 90);
  }, 0) / Math.max(1, ps.length);
  return Math.min(1.15, Math.max(.85, amount));
}
export function transitionSpace(tactic: EngineTactic, opponent: EngineTactic, directives: string[]): number {
  if (!['DIRECT', 'LONG'].includes(tactic.passingStyle) && !directives.includes('QUICK_COUNTER')) return 0;
  return Math.min(.15, Math.max(0, (opponent.defensiveLine - 35) / 400));
}
