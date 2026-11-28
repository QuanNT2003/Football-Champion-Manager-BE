import type { TacticalAxis, TacticalRulebook } from './tactical-types';
import type { MatchupEffects } from './tactical-matchups';

export interface TacticalPressure { total: number; byAxis: Record<TacticalAxis, number>; }
export function tacticalLeverage(own: MatchupEffects, opponent: MatchupEffects, book: TacticalRulebook, route?: string) {
  const config = book.dominance;
  if (!config) return { control: 1, opportunity: 1, completion: 0 };
  const ownPressure = own.pressure, opposing = opponent.pressure;
  const routeWeight = (axis: TacticalAxis) => !route ? 1 :
    axis === 'WIDE' ? route === 'WIDE' ? 1 : config.routeFloor :
      ['CENTRE', 'BETWEEN_LINES'].includes(axis) ? route !== 'WIDE' ? 1 : config.routeFloor : 1;
  const routed = (pressure?: TacticalPressure) => pressure ? (Object.keys(pressure.byAxis) as TacticalAxis[])
    .reduce((sum, axis) => sum + pressure.byAxis[axis] * routeWeight(axis), 0) : 0;
  const balance = (opposing?.total || 0) - (ownPressure?.total || 0);
  return {
    // Territory changes who gets possessions; opportunity changes progression after gaining the ball.
    control: Math.exp(balance * config.controlWeight),
    opportunity: Math.exp((routed(opposing) - routed(ownPressure)) * config.opportunityWeight),
    completion: ownPressure?.byAxis.OUTLET ? -ownPressure.byAxis.OUTLET * config.outletCompletionWeight : 0,
  };
}
