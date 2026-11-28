import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { stylePreset } from './tactic-normalizer';

export const MATCH_BENCH_SIZE = 9;

export type LineupPlayer = Prisma.playersGetPayload<{
  include: {
    player_status: true;
    player_positions: { include: { positions: true } };
    injuries: true;
    player_attributes: true;
    player_mentality: true;
    player_tactics: true;
    player_suspensions: true;
  };
}>;
export type FormationSlot = Prisma.formation_positionsGetPayload<{
  include: { positions: true };
}>;
export interface SavedPosition {
  player_id: bigint | null;
  formation_position_id: bigint | null;
  role: string;
  duty: string;
  lineup_role: string;
  order_no: number;
}
export interface PreparedPosition {
  slot: FormationSlot | null;
  player: LineupPlayer | null;
  role: string;
  duty: string;
  lineup_role: 'STARTING' | 'SUBSTITUTE';
  order_no: number;
}

function isGoalkeeper(player: LineupPlayer) {
  return player.player_positions.some(p => p.positions.code === 'GK' && p.ability > 0);
}

export function isMatchReady(player: LineupPlayer) {
  const status = player.player_status;
  // Fitness affects performance and coach decisions, never eligibility (even at 0%).
  return !!status && !status.is_injured && !status.is_suspended &&
    !status.is_on_national_duty &&
    !player.injuries.some(i => (i.status === 'ACTIVE' || i.status === 'RECOVERING') && i.days_remaining > 0);
}

function canPlay(player: LineupPlayer, slot: FormationSlot) {
  if (slot.positions.code === 'GK') return isGoalkeeper(player);
  return !isGoalkeeper(player) || player.player_positions.some(
    p => p.positions.code !== 'GK' && p.ability > 0,
  );
}

function positionFit(player: LineupPlayer, slot: FormationSlot) {
  const exact = player.player_positions.find(p => p.position_id === slot.position_id && p.ability > 0);
  if (exact) return 200 + exact.ability;
  return player.player_positions.some(p => p.positions.category === slot.positions.category && p.ability > 0) ? 100 : 0;
}

function byQuality(a: LineupPlayer, b: LineupPlayer) {
  return b.ovr - a.ovr || b.player_status.fitness - a.player_status.fitness ||
    b.reputation - a.reputation || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Preserve available starters first; fill gaps by position, then quality. */
export function selectMatchLineup(
  slots: FormationSlot[], candidates: LineupPlayer[], saved: SavedPosition[],
): PreparedPosition[] {
  if (slots.length !== 11 || slots.filter(s => s.positions.code === 'GK').length !== 1) {
    throw new BadRequestException('Sơ đồ phải có 11 vị trí và đúng một thủ môn');
  }
  const available = candidates.filter(isMatchReady).sort(byQuality);
  const byId = new Map(available.map(p => [p.id, p]));
  const used = new Set<bigint>();
  const result: PreparedPosition[] = slots.map((slot, index) => {
    const previous = saved.find(p => p.lineup_role === 'STARTING' && p.formation_position_id === slot.id);
    const player = previous?.player_id ? byId.get(previous.player_id) : null;
    const keep = player && !used.has(player.id) && canPlay(player, slot);
    if (keep) used.add(player.id);
    return {
      slot, player: keep ? player : null, role: previous?.role || 'STANDARD',
      duty: previous?.duty || 'SUPPORT', lineup_role: 'STARTING', order_no: index + 1,
    };
  });

  // Resolve scarce specialist positions before filling less suitable alternatives.
  const missing = result.filter(p => !p.player).sort((a, b) => {
    if (a.slot.positions.code === 'GK') return -1;
    if (b.slot.positions.code === 'GK') return 1;
    const count = (slot: FormationSlot) => available.filter(p => !used.has(p.id) && positionFit(p, slot) >= 200).length;
    return count(a.slot) - count(b.slot) || a.order_no - b.order_no;
  });
  const assign = (position: PreparedPosition, exactOnly: boolean) => {
    const choices = available.filter(p => !used.has(p.id) && canPlay(p, position.slot) &&
      (!exactOnly || positionFit(p, position.slot) >= 200));
    choices.sort((a, b) => positionFit(b, position.slot) - positionFit(a, position.slot) || byQuality(a, b));
    if (choices[0]) {
      position.player = choices[0];
      used.add(choices[0].id);
    }
  };
  for (const position of missing) assign(position, true);
  for (const position of missing.filter(p => !p.player)) assign(position, false);
  if (result.some(p => !p.player)) {
    throw new BadRequestException('Không đủ 11 cầu thủ đủ điều kiện và thủ môn để thi đấu');
  }

  const bench: PreparedPosition[] = [];
  for (let seat = 1; seat <= MATCH_BENCH_SIZE; seat++) {
    const previous = saved.find(p => p.lineup_role === 'SUBSTITUTE' && p.order_no === seat);
    const player = previous?.player_id ? byId.get(previous.player_id) : null;
    const keep = player && !used.has(player.id);
    if (keep) used.add(player.id);
    bench.push({ slot: null, player: keep ? player : null, role: 'BENCH', duty: 'SUPPORT', lineup_role: 'SUBSTITUTE', order_no: seat });
  }
  for (const position of bench.filter(p => !p.player)) {
    const remaining = available.filter(p => !used.has(p.id));
    // Keep a reserve goalkeeper when one is available.
    position.player = (!bench.some(p => p.player && isGoalkeeper(p.player)) ? remaining.find(isGoalkeeper) : null) || remaining[0] || null;
    if (position.player) used.add(position.player.id);
  }
  return [...result, ...bench];
}

export function coachTacticDefaults(style = 'BALANCED') {
  if (['CONTROL_POSSESSION', 'DIRECT_ATTACK', 'FLUID_COUNTER', 'PARK_THE_BUS', 'VERTICAL_TIKI_TAKA'].includes(style.toUpperCase())) {
    const t = stylePreset(style);
    return { mentality: t.mentality, tempo: t.tempo, passing_style: t.passingStyle,
      pressing_intensity: t.pressing, defensive_line: t.defensiveLine };
  }
  const defaults = { mentality: 'BALANCED', tempo: 55, passing_style: 'MIXED', pressing_intensity: 55, defensive_line: 50 };
  switch (style.toUpperCase()) {
    case 'TIKI_TAKA':
      return { ...defaults, mentality: 'ATTACKING', passing_style: 'SHORT' };
    case 'GEGENPRESSING':
      return { ...defaults, mentality: 'ATTACKING', tempo: 75, pressing_intensity: 80, defensive_line: 70 };
    case 'COUNTER_ATTACK':
      return { ...defaults, mentality: 'CAUTIOUS', tempo: 70, passing_style: 'DIRECT', pressing_intensity: 40, defensive_line: 35 };
    case 'CATENACCIO':
    case 'DEFENSIVE':
      return { ...defaults, mentality: 'DEFENSIVE', tempo: 40, pressing_intensity: 35, defensive_line: 30 };
    case 'WING_PLAY':
    case 'ATTACKING':
      return { ...defaults, mentality: 'ATTACKING', tempo: 65 };
    case 'DIRECT':
      return { ...defaults, tempo: 70, passing_style: 'DIRECT' };
    default:
      return defaults;
  }
}
