import type { EnginePlayer, EngineTactic } from './match-engine';
import type { MatchupEffects } from './tactical-matchups';

/** Advice uses only the current report, never hidden opponent attributes or future events. */
export function tacticalAdvice(tactic: EngineTactic, problem: MatchupEffects, passAccuracy: number): Partial<EngineTactic> {
  if (problem.pressure ? problem.pressure.total <= .25 : problem.total <= .025) return {};
  const ids = problem.mitigationIds;
  if (problem.defense > problem.buildup + problem.progression) {
    const defensiveLine = Math.max(15, tactic.defensiveLine - 8);
    return { defensiveLine, pressing: Math.max(15, tactic.pressing + (defensiveLine - tactic.pressing) * .35) };
  }
  if (ids.includes('M05') && passAccuracy < .85) return { passingStyle: 'DIRECT', tempo: Math.max(20, tactic.tempo - 5) };
  if (ids.some(id => ['M01', 'M04', 'M08'].includes(id))) return { passingStyle: 'SHORT', tempo: Math.max(20, tactic.tempo - 6) };
  if (ids.includes('M10')) return { passingStyle: 'DIRECT', mentality: 'BALANCED' };
  if (ids.includes('M07')) return { passingStyle: 'MIXED', tempo: Math.max(20, tactic.tempo - 4) };
  if (ids.includes('M09')) return { pressing: tactic.pressing + (tactic.defensiveLine - tactic.pressing) * .35 };
  return {};
}

export function playerAdjustment(players: EnginePlayer[], problem: MatchupEffects): { id: string; role: string; duty: string } | null {
  if (problem.pressure ? problem.pressure.total <= .25 : problem.total <= .025) return null;
  const ids = problem.mitigationIds;
  if (ids.some(id => ['M02', 'M03', 'M06'].includes(id))) {
    const defender = players.find(p => ['DM', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && p.duty === 'ATTACK');
    if (defender) return { id: defender.id, role: defender.role, duty: 'DEFEND' };
  }
  if (ids.some(id => ['M01', 'M04'].includes(id))) {
    const forward = players.find(p => p.position === 'ST' && p.role !== 'FALSE_NINE');
    if (forward) return { id: forward.id, role: 'FALSE_NINE', duty: 'SUPPORT' };
  }
  if (ids.includes('M10')) {
    const outlet = players.find(p => ['ST', 'SS', 'LW', 'RW'].includes(p.position) && p.duty === 'DEFEND');
    if (outlet) return { id: outlet.id, role: outlet.role, duty: 'SUPPORT' };
  }
  return null;
}
