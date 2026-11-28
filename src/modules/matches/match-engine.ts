import { simulateMatchEngine as simulateLegacy } from './match-engine.legacy';
import { effectiveTactic, normalizeInstructions, normalizeTeam, playerRole } from './tactic-normalizer';
import { matchupEffects, structuralFactor, TacticalState, transitionSpace } from './tactical-matchups';
import { decidePossession, defensivePolicy, keeperPolicy } from './player-decision-policy';
import { TACTICAL_RULEBOOK } from './tactical-rulebook';
import { TACTICAL_RULEBOOK_V2 } from './tactical-rulebook-v2';
import { tacticalLeverage } from './tactical-dominance';
import { playerAdjustment, tacticalAdvice } from './coaching-adaptation';
/** Pure, seeded match simulation. Coefficients are game balance defaults, not real-world forecasts. */
export const MATCH_ENGINE_VERSION = '2.3.0';
export const USER_CLUB_ATTRIBUTE_BONUS = 14;
// Strictly below 24 points, including extra time and integer persistence.
export const MAX_MATCH_FITNESS_LOSS = 23;
export const ATTRIBUTE_KEYS = [
  'pac', 'acc', 'sta', 'str', 'agi', 'bal', 'jum', 'fin', 'lsh', 'hea', 'dri', 'fir', 'pas', 'cro',
  'tec', 'tac', 'mar', 'vis', 'dec', 'cmp', 'pos', 'otb', 'wor', 'gk_ref', 'gk_han', 'gk_aer', 'gk_ooo', 'gk_kic',
] as const;
export type AttributeKey = typeof ATTRIBUTE_KEYS[number];
export interface EnginePlayer {
  id: string; name: string; position: string; formationPositionId: string | null;
  role: string; duty: string; started: boolean; shirtNumber: number | null;
  ovr: number; positionAbility: number; isCaptain: boolean;
  attributes: Partial<Record<AttributeKey, number>>;
  mentality: Record<string, number>;
  traits: Record<string, number | string | null>;
  status: { condition: number; fitness: number; fatigue: number; morale: number; form: number; sharpness: number };
  instructions: string[];
  coordinates?: { x: number; y: number };
}
export interface EngineCoach {
  id: string; name: string; role: string; squadType: string; attributes: Record<string, number>;
}
export interface EngineTactic {
  mentality: string; tempo: number; passingStyle: string; pressing: number; defensiveLine: number;
}
export interface EngineTeam {
  id: string; name: string; hasUser: boolean; squadType: string;
  tactic: EngineTactic; players: EnginePlayer[]; coaches: EngineCoach[];
  formationCode?: string; tacticalStyle?: string; instructions?: string[];
}
export interface EngineRules {
  knockout: boolean; decidingLeg: boolean; extraTime: boolean; penalties: boolean;
  aggregateHome: number; aggregateAway: number;
  awayGoals?: boolean; priorHomeAwayGoals?: number; priorAwayAwayGoals?: number;
}
export interface EngineInput {
  seed: number; home: EngineTeam; away: EngineTeam; rules: EngineRules;
  config?: { userAttributeBonus?: number; injuryRate?: number; homeAdvantage?: number;
    tacticalModel?: 'legacy' | 'contextual_v1' | 'contextual_v2'; rulesetVersion?: string; rulesetHash?: string };
}
export type MatchPhase = 'FIRST_HALF' | 'SECOND_HALF' | 'EXTRA_FIRST' | 'EXTRA_SECOND' | 'SHOOTOUT';
export interface EngineEvent {
  sequence: number; minute: number; addedTime: number; elapsed: number; phase: MatchPhase;
  eventType: string; clubId: string | null; playerId: string | null; relatedPlayerId: string | null;
  data: Record<string, string | number | boolean | null>;
}
export interface TeamStatistics {
  possession: number; possessionActions: number; shots: number; shotsOnTarget: number; shotsBlocked: number;
  xG: number; passes: number; passesCompleted: number; passAccuracy: number; tackles: number;
  tacklesWon: number; fouls: number; corners: number; offsides: number; saves: number;
  yellowCards: number; redCards: number; substitutions: number; injuries: number;
}
export interface PlayerStatistics {
  minutes: number; goals: number; assists: number; shots: number; shotsOnTarget: number; xG: number;
  passes: number; passesCompleted: number; keyPasses: number; dribbles: number; dribblesWon: number;
  tackles: number; tacklesWon: number; interceptions: number; saves: number; goalsConceded: number;
  fouls: number; yellowCards: number; redCards: number; rating: number; cleanSheet: boolean;
  fitnessStart: number; fitnessEnd: number; fatigueEnd: number;
  enteredMinute: number | null; leftMinute: number | null; injured: boolean; injuryDays: number;
}
export interface EnginePlayerResult { player: EnginePlayer; stats: PlayerStatistics; finalPosition: string; formationPositionId: string | null; }
export interface CoachingEffects {
  attack: number; defense: number; control: number; goalkeeping: number; motivation: number;
  fitness: number; discipline: number; decisions: number; injuryPrevention: number;
  rehabilitation: number;
  headCoachId: string | null; assistantIds: string[];
}
export interface EngineTeamResult {
  id: string; statistics: TeamStatistics; players: EnginePlayerResult[]; coaching: CoachingEffects;
}
export interface EngineResult {
  version: string; seed: number; duration: number;
  homeScore: number; awayScore: number; homeRegularScore: number; awayRegularScore: number;
  homeExtraScore: number | null; awayExtraScore: number | null;
  homePenaltyScore: number | null; awayPenaltyScore: number | null;
  resultType: 'REGULAR' | 'EXTRA_TIME' | 'PENALTIES'; winnerClubId: string | null;
  aggregateHome: number; aggregateAway: number; motmPlayerId: string;
  events: EngineEvent[]; home: EngineTeamResult; away: EngineTeamResult;
}

export const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
const value = (record: Record<string, unknown> | undefined, key: string, fallback = 50) => clamp(Number(record?.[key] ?? fallback), 0, 100);
const average = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0) / Math.max(1, numbers.length);
const round = (n: number) => Math.round(n * 100) / 100;
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

/** One head coach and at most two relevant assistants; hiring duplicates cannot stack bonuses. */
export function coachingEffects(team: EngineTeam): CoachingEffects {
  const youth = team.squadType.startsWith('YOUTH');
  const relevant = team.coaches.filter(c => {
    const youthRole = c.role.endsWith('_YOUTH');
    return youth ? c.squadType === team.squadType || (youthRole && c.squadType === 'FIRST_TEAM')
      : !youthRole && c.squadType === 'FIRST_TEAM';
  });
  if (youth && !relevant.some(c => ['HEAD_COACH_YOUTH', 'HEAD_COACH'].includes(c.role))) {
    const senior = team.coaches.find(c => c.role === 'HEAD_COACH' && c.squadType === 'FIRST_TEAM');
    if (senior) relevant.push(senior);
  }
  const ranked = (roles: string[]) => relevant.filter(c => roles.includes(c.role)).sort((a, b) =>
    value(b.attributes, 'tactical') + value(b.attributes, 'judge_ability') - value(a.attributes, 'tactical') - value(a.attributes, 'judge_ability') || a.id.localeCompare(b.id));
  const head = ranked(youth ? ['HEAD_COACH_YOUTH', 'HEAD_COACH'] : ['HEAD_COACH'])[0];
  const assistants = ranked(youth ? ['ASSISTANT_COACH_YOUTH', 'ASSISTANT_COACH'] : ['ASSISTANT_COACH']).slice(0, 2);
  const skill = (keys: string[], specialist?: string) => {
    const score = (coach: EngineCoach) => average(keys.map(k => value(coach?.attributes, k, 35)));
    const h = head ? score(head) : 35;
    const a = assistants.length ? average(assistants.map(score)) : 35;
    const specialists = relevant.filter(c => c.role === specialist);
    const s = specialists.length ? Math.max(...specialists.map(score)) : (h * .65 + a * .35);
    return h * .55 + a * .30 + s * .15;
  };
  return {
    attack: skill(['attacking', 'technical']), defense: skill(['defending', 'tactical']),
    control: skill(['tactical', 'tac_knowledge', 'technical']), goalkeeping: skill(['gk_stopping', 'technical'], 'GOALKEEPING_COACH'),
    motivation: skill(['motivating', 'man_management', 'determination']),
    fitness: skill(['fitness', 'sports_science'], 'FITNESS_COACH'), discipline: skill(['discipline', 'man_management']),
    decisions: skill(['judge_ability', 'tac_knowledge', 'adaptability']),
    injuryPrevention: skill(['injury_prevent', 'physiotherapy', 'sports_science'], 'PHYSIO'),
    rehabilitation: skill(['rehabilitation', 'physiotherapy'], 'PHYSIO'),
    headCoachId: head?.id || null, assistantIds: assistants.map(c => c.id),
  };
}

interface RuntimePlayer extends EnginePlayerResult { active: boolean; enteredElapsed: number | null; used: boolean; }
interface RuntimeTeam {
  input: EngineTeam; tactic: EngineTactic; players: RuntimePlayer[]; coaching: CoachingEffects;
  statistics: TeamStatistics; score: number; subWindows: number; lastSubMinute: number; changes: number;
}
function initialStatistics(): TeamStatistics {
  return { possession: 0, possessionActions: 0, shots: 0, shotsOnTarget: 0, shotsBlocked: 0, xG: 0,
    passes: 0, passesCompleted: 0, passAccuracy: 0, tackles: 0, tacklesWon: 0, fouls: 0,
    corners: 0, offsides: 0, saves: 0, yellowCards: 0, redCards: 0, substitutions: 0, injuries: 0 };
}
function runtimeTeam(input: EngineTeam): RuntimeTeam {
  if (input.players.filter(p => p.started).length !== 11 || input.players.filter(p => p.started && p.position === 'GK').length !== 1 ||
      new Set(input.players.map(p => p.id)).size !== input.players.length) throw new Error('Invalid match XI');
  const captainScore = (p: EnginePlayer) => value(p.mentality, 'leadership') * .45 + value(p.mentality, 'determination') * .25 +
    value(p.mentality, 'loyalty') * .20 + value(p.mentality, 'pressure_handling') * .10;
  const captain = input.players.filter(p => p.started).sort((a, b) => captainScore(b) - captainScore(a))[0];
  const hasCaptain = input.players.some(p => p.started && p.isCaptain);
  return {
    input, tactic: effectiveTactic({ ...input.tactic, tempo: clamp(input.tactic.tempo, 0, 100), pressing: clamp(input.tactic.pressing, 0, 100), defensiveLine: clamp(input.tactic.defensiveLine, 0, 100) }, input.instructions || []), coaching: coachingEffects(input), statistics: initialStatistics(), score: 0,
    subWindows: 0, lastSubMinute: -1, changes: 0,
    players: input.players.map(p => ({
      player: { ...p, isCaptain: p.started && (hasCaptain ? p.isCaptain : p.id === captain.id) },
      finalPosition: p.position, formationPositionId: p.formationPositionId, active: p.started, used: p.started, enteredElapsed: p.started ? 0 : null,
      stats: {
        minutes: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, xG: 0, passes: 0, passesCompleted: 0, keyPasses: 0,
        dribbles: 0, dribblesWon: 0, tackles: 0, tacklesWon: 0, interceptions: 0, saves: 0, goalsConceded: 0,
        fouls: 0, yellowCards: 0, redCards: 0, rating: 0, cleanSheet: false,
        fitnessStart: clamp(p.status.fitness, 0, 100), fitnessEnd: clamp(p.status.fitness, 0, 100),
        fatigueEnd: clamp(p.status.fatigue, 0, 100), enteredMinute: p.started ? 0 : null,
        leftMinute: null, injured: false, injuryDays: 0,
      },
    })),
  };
}
const active = (t: RuntimeTeam) => t.players.filter(p => p.active);
const outfield = (t: RuntimeTeam) => active(t).filter(p => p.finalPosition !== 'GK');
const has = (p: RuntimePlayer, flag: string) => !!p.player.traits[flag] || p.player.instructions.includes(flag);
const isDefender = (p: RuntimePlayer) => ['CB', 'SW', 'LB', 'RB', 'LWB', 'RWB'].includes(p.finalPosition);
const isForward = (p: RuntimePlayer) => ['ST', 'SS', 'LW', 'RW', 'LAM', 'RAM', 'AM'].includes(p.finalPosition);

export function simulateMatchEngine(input: EngineInput): EngineResult {
  // Old snapshots consume exactly the old random stream and keep their original version/output.
  if (!['contextual_v1', 'contextual_v2'].includes(input.config?.tacticalModel)) return simulateLegacy(input);
  const dominance = input.config.tacticalModel === 'contextual_v2';
  const rulebook = dominance ? TACTICAL_RULEBOOK_V2 : TACTICAL_RULEBOOK;
  if (input.config.rulesetHash && input.config.rulesetHash !== rulebook.hash ||
      input.config.rulesetVersion && input.config.rulesetVersion !== rulebook.version) {
    throw new Error('Unsupported tactical ruleset; replay requires the recorded ruleset');
  }
  input = { ...input, home: normalizeTeam(input.home), away: normalizeTeam(input.away) };
  if (input.home.id === input.away.id || input.home.players.some(p => input.away.players.some(a => a.id === p.id))) throw new Error('A player or club cannot play both sides');
  const rng = seededRandom(input.seed);
  const home = runtimeTeam(input.home), away = runtimeTeam(input.away);
  const teams = [home, away];
  const events: EngineEvent[] = [];
  const bonus = clamp(input.config?.userAttributeBonus ?? USER_CLUB_ATTRIBUTE_BONUS, 0, 30);
  let minute = 0, addedTime = 0, elapsed = 0;
  let phase: MatchPhase = 'FIRST_HALF';
  const emit = (eventType: string, team?: RuntimeTeam, player?: RuntimePlayer, related?: RuntimePlayer, data: EngineEvent['data'] = {}) => {
    events.push({ sequence: events.length + 1, minute, addedTime, elapsed, phase, eventType,
      clubId: team?.input.id || null, playerId: player?.player.id || null, relatedPlayerId: related?.player.id || null, data });
  };
  const attr = (p: RuntimePlayer, key: AttributeKey, team: RuntimeTeam) => {
    const raw = value(p.player.attributes, key, p.player.ovr);
    const physical = .65 + p.stats.fitnessEnd / 100 * .22 + value(p.player.status, 'condition') / 100 * .08 + (100 - p.stats.fatigueEnd) / 100 * .05;
    const mentality = (.92 + (value(p.player.status, 'morale') + value(p.player.status, 'form') + value(p.player.status, 'sharpness')) / 300 * .12) *
      (1 + (value(p.player.mentality, 'professionalism') - 50) / 4000);
    const fit = .72 + clamp(p.player.positionAbility, 0, 100) / 100 * .28;
    return (raw + (team.input.hasUser ? bonus : 0)) * physical * mentality * fit;
  };
  const skill = (p: RuntimePlayer, keys: AttributeKey[], team: RuntimeTeam) => average(keys.map(k => attr(p, k, team)));
  // A tick's three possessions share a shape. Rebuild after adaptation/substitution/red cards on the next tick.
  const stateCache = new Map<RuntimeTeam, { elapsed: number; state: TacticalState }>();
  const tacticalState = (team: RuntimeTeam): TacticalState => {
    const cached = stateCache.get(team);
    if (cached?.elapsed === elapsed) return cached.state;
    const state = { ...team.input, tactic: team.tactic, players: active(team).map(p => ({ ...p.player, position: p.finalPosition })) };
    stateCache.set(team, { elapsed, state }); return state;
  };
  const directives = (team: RuntimeTeam, p?: RuntimePlayer) => normalizeInstructions([...(team.input.instructions || []), ...(p?.player.instructions || [])]);
  const matchupCache = new WeakMap<TacticalState, { opponent: TacticalState; effects: ReturnType<typeof matchupEffects> }>();
  const currentMatchup = (team: RuntimeTeam, opponent: RuntimeTeam) => {
    const state = tacticalState(team), opposing = tacticalState(opponent), cached = matchupCache.get(state);
    if (cached?.opponent === opposing) return cached.effects;
    const effects = matchupEffects(state, opposing, rulebook); matchupCache.set(state, { opponent: opposing, effects }); return effects;
  };
  const coachFactor = (n: number) => .92 + n / 100 * .20;
  const roleFactor = (p: RuntimePlayer, mode: 'attack' | 'defense' | 'control') => {
    const role = `${p.player.role} ${p.player.traits.primary_style || ''} ${p.player.traits.secondary_style || ''}`.toUpperCase();
    const attack = /POACHER|ADVANCED_FORWARD|TARGET_MAN|INSIDE_FORWARD|WINGER|SHADOW_STRIKER/.test(role);
    const control = /PLAYMAKER|REGISTA|FALSE_NINE|FALSE_9|BOX_TO_BOX|MEZZALA/.test(role);
    const defense = /ANCHOR|BALL_WINNING|STOPPER|COVER|DEFENSIVE|SWEEPER/.test(role);
    return 1 + (mode === 'attack' && attack || mode === 'control' && control || mode === 'defense' && defense ? .07 : 0) +
      (mode === 'defense' && has(p, 'tight_marking') ? .04 : 0) +
      (p.player.duty === 'ATTACK' && mode === 'attack' || p.player.duty === 'DEFEND' && mode === 'defense' ? .05 : 0);
  };
  const power = (team: RuntimeTeam, mode: 'attack' | 'defense' | 'control') => {
    const players = outfield(team);
    const keys: AttributeKey[] = mode === 'attack' ? ['fin', 'otb', 'acc', 'tec', 'cmp']
      : mode === 'defense' ? ['tac', 'mar', 'pos', 'str', 'dec'] : ['pas', 'vis', 'fir', 'tec', 'wor', 'dec'];
    const weighted = players.map(p => {
      const weight = mode === 'attack' ? isForward(p) ? 1.6 : isDefender(p) ? .55 : 1
        : mode === 'defense' ? isDefender(p) ? 1.5 : isForward(p) ? .55 : 1 : isForward(p) || isDefender(p) ? .8 : 1.5;
      return [skill(p, keys, team) * roleFactor(p, mode), weight];
    });
    let result = weighted.reduce((n, [v, w]) => n + v * w, 0) / Math.max(1, weighted.reduce((n, [, w]) => n + w, 0));
    // Contextual mode owns structure here; legacy retains the former line-count multiplier.
    result *= structuralFactor(tacticalState(team), mode);
    const mentality = team.tactic.mentality.toUpperCase();
    const aggression = ['VERY_ATTACKING', 'ALL_OUT_ATTACK'].includes(mentality) ? 1 : mentality === 'ATTACKING' ? .65
      : ['VERY_DEFENSIVE', 'DEFENSIVE'].includes(mentality) ? -.75 : mentality === 'CAUTIOUS' ? -.4 : 0;
    if (mode === 'attack') result *= 1 + aggression * .16 + (team.tactic.tempo - 50) / 500;
    if (mode === 'defense') result *= 1 - aggression * .10 + (team.tactic.pressing - 50) / 600;
    if (mode === 'control') result *= 1 + (team.tactic.passingStyle === 'SHORT' ? .10 : ['DIRECT', 'LONG'].includes(team.tactic.passingStyle) ? -.06 : 0);
    result *= coachFactor(team.coaching[mode === 'attack' ? 'attack' : mode === 'defense' ? 'defense' : 'control']);
    result *= Math.pow(players.length / 10, .8);
    if (team === home) result *= input.config?.homeAdvantage ?? 1.05;
    const behind = team.score < (team === home ? away.score : home.score);
    if (behind) {
      const determination = average(players.map(p => value(p.player.mentality, 'determination') * .8 + value(p.player.mentality, 'ambition') * .2));
      result *= 1 + (determination + team.coaching.motivation - 100) / 1400;
    } else if (team.score > (team === home ? away.score : home.score)) {
      result *= 1 - average(players.map(p => value(p.player.mentality, 'complacency'))) / 2500;
    }
    const leader = active(team).find(p => p.player.isCaptain);
    if (leader) result *= 1 + (value(leader.player.mentality, 'leadership') - 50) / 2000;
    return Math.max(1, result);
  };
  const choose = (players: RuntimePlayer[], weight: (p: RuntimePlayer) => number) => {
    if (!players.length) throw new Error('No eligible player for match action');
    const weights = players.map(p => Math.max(.01, weight(p)));
    let roll = rng() * weights.reduce((a, b) => a + b, 0);
    return players.find((p, i) => (roll -= weights[i]) < 0) || players[players.length - 1];
  };
  const remove = (p: RuntimePlayer) => {
    p.active = false; p.stats.leftMinute = minute;
  };
  const substitute = (team: RuntimeTeam, outgoing: RuntimePlayer, forced = false) => {
    const extra = phase.startsWith('EXTRA');
    if (team.statistics.substitutions >= (extra ? 6 : 5) ||
        team.subWindows >= (extra ? 4 : 3) && team.lastSubMinute !== minute && minute !== 45) return false;
    let bench = team.players.filter(p => !p.used && !p.stats.injured &&
      (outgoing.finalPosition === 'GK' ? p.player.position === 'GK' : p.player.position !== 'GK'));
    if (!bench.length) return false;
    bench = bench.sort((a, b) => (b.player.position === outgoing.finalPosition ? 100 : 0) + b.player.ovr + b.stats.fitnessEnd / 10 -
      (a.player.position === outgoing.finalPosition ? 100 : 0) - a.player.ovr - a.stats.fitnessEnd / 10);
    const incoming = bench[0];
    remove(outgoing);
    incoming.active = true; incoming.used = true; incoming.enteredElapsed = elapsed;
    incoming.stats.enteredMinute = minute;
    incoming.finalPosition = outgoing.finalPosition; incoming.formationPositionId = outgoing.formationPositionId;
    incoming.player = { ...incoming.player, role: outgoing.player.role, duty: outgoing.player.duty,
      coordinates: outgoing.player.coordinates, instructions: [...outgoing.player.instructions],
      positionAbility: incoming.player.position === outgoing.finalPosition ? incoming.player.positionAbility : 55 };
    if (outgoing.player.isCaptain) {
      outgoing.player.isCaptain = false;
      const captain = [...active(team)].sort((a, b) => value(b.player.mentality, 'leadership') - value(a.player.mentality, 'leadership'))[0];
      if (captain) captain.player.isCaptain = true;
    }
    team.statistics.substitutions++;
    if (team.lastSubMinute !== minute && minute !== 45) team.subWindows++;
    team.lastSubMinute = minute;
    emit('SUBSTITUTION', team, incoming, outgoing, { forced, decisionSkill: round(team.coaching.decisions) });
    return true;
  };
  const adapt = (team: RuntimeTeam, opponent: RuntimeTeam) => {
    if (![45, 60, 75, 105].includes(minute) || addedTime || team.changes >= 3) return;
    if (team.coaching.decisions < 45) return;
    const previous = JSON.stringify(team.tactic);
    let adjusted: RuntimePlayer | undefined;
    let instructionChanged = false;
    if (team.score < opponent.score && minute >= 60) {
      team.tactic.mentality = 'ATTACKING'; team.tactic.tempo = clamp(team.tactic.tempo + 8, 20, 90);
    } else if (team.score > opponent.score && minute >= 75) {
      team.tactic.mentality = 'CAUTIOUS'; team.tactic.pressing = clamp(team.tactic.pressing - 10, 20, 90);
    }
    // Assistants identify an existing structural problem; weaker staff react later and may miss it.
    const problem = currentMatchup(team, opponent);
    const readQuality = team.coaching.decisions / 100;
    if (minute >= (readQuality >= .75 ? 45 : 60) && (dominance ? problem.pressure.total > .25 : problem.total > .025) && rng() < readQuality) {
      Object.assign(team.tactic, tacticalAdvice(team.tactic, problem,
        team.statistics.passesCompleted / Math.max(1, team.statistics.passes)));
      const adjustment = playerAdjustment(tacticalState(team).players, problem);
      if (adjustment) {
        adjusted = active(team).find(p => p.player.id === adjustment.id);
        if (adjusted) adjusted.player = { ...adjusted.player, role: adjustment.role, duty: adjustment.duty };
      }
      if (problem.mitigationIds.includes('M07') && !team.input.instructions.includes('WING_PLAY') &&
          outfield(team).some(p => ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB'].includes(p.finalPosition))) {
        team.input.instructions = normalizeInstructions([...team.input.instructions, 'WING_PLAY']); instructionChanged = true;
      }
    }
    if (previous !== JSON.stringify(team.tactic) || adjusted || instructionChanged) {
      team.changes++;
      stateCache.delete(team);
      emit('TACTICAL_CHANGE', team, adjusted, undefined, { mentality: team.tactic.mentality, tempo: team.tactic.tempo,
        pressing: team.tactic.pressing, passingStyle: team.tactic.passingStyle, defensiveLine: team.tactic.defensiveLine,
        ...(adjusted ? { role: adjusted.player.role, duty: adjusted.player.duty } : {}), ...(instructionChanged ? { instruction: 'WING_PLAY' } : {}) });
    }
  };
  const shot = (team: RuntimeTeam, opponent: RuntimeTeam, passer?: RuntimePlayer, setPiece = false, route = 'CENTRE') => {
    const attackers = outfield(team);
    const shooter = choose(attackers, p => skill(p, ['fin', 'otb', 'acc'], team) * (isForward(p) ? 2.6 : isDefender(p) ? .3 : 1) *
      (has(p, 'cuts_inside') || has(p, 'SHOOT_ON_SIGHT') ? 1.25 : 1) * roleFactor(p, 'attack') * playerRole(p.player).shoot *
      (route === 'WIDE' ? playerRole(p.player).aerial : playerRole(p.player).run));
    const keeper = active(opponent).find(p => p.finalPosition === 'GK');
    const defender = choose(outfield(opponent), p => skill(p, ['pos', 'mar', 'tac'], opponent) * (isDefender(p) ? 2 : .6));
    const long = has(shooter, 'shoots_distance') || has(shooter, 'SHOOT_ON_SIGHT');
    const cross = !long && (setPiece || passer && (route === 'WIDE' || has(passer, 'hugs_touchline') || has(passer, 'switches_play') || has(passer, 'HIT_EARLY_CROSSES')) && rng() < .5);
    const shootKeys: AttributeKey[] = cross ? ['hea', 'jum', 'str'] : long ? ['lsh', 'tec', 'bal'] : ['fin', 'cmp', 'tec'];
    const finishing = skill(shooter, shootKeys, team) * roleFactor(shooter, 'attack');
    const keeperBehaviour = keeper ? keeperPolicy(keeper.player, cross, route).stopping : 1;
    const goalkeeping = keeper ? skill(keeper, cross ? ['gk_aer', 'gk_han', 'jum'] : ['gk_ref', 'gk_ooo', 'agi'], opponent) * coachFactor(opponent.coaching.goalkeeping) * keeperBehaviour : 12;
    const defense = skill(defender, ['mar', 'pos', 'str'], opponent);
    const openSpace = (opponent.tactic.defensiveLine - 50) / 1000 + (has(shooter, 'beats_offside') ? .025 : 0);
    const patient = directives(team, passer).includes('WORK_BALL_INTO_BOX');
    const xG = clamp((long ? .055 : cross ? .105 : .14) + (finishing - defense) / 650 + openSpace +
      (has(shooter, 'first_time_shots') ? .01 : 0) + (patient ? .012 : 0), .02, .48);
    shooter.stats.shots++; shooter.stats.xG += xG;
    team.statistics.shots++; team.statistics.xG += xG;
    if (passer && passer !== shooter) passer.stats.keyPasses++;
    const metadata = { xG: round(xG), shotType: cross ? 'HEADER' : long ? 'LONG_RANGE' : has(shooter, 'places_shots') ? 'PLACED' : 'OPEN_PLAY' };
    if (rng() < clamp(.11 + (defense - finishing) / 700, .03, .25)) {
      team.statistics.shotsBlocked++; defender.stats.tackles++; defender.stats.tacklesWon++;
      opponent.statistics.tackles++; opponent.statistics.tacklesWon++;
      emit('SHOT_BLOCKED', team, shooter, defender, metadata);
      if (rng() < .45) { team.statistics.corners++; emit('CORNER', team, shooter); }
      return;
    }
    const onTarget = clamp(.48 + (finishing - 50) / 300 + (has(shooter, 'places_shots') ? .05 : 0), .25, .78);
    if (rng() >= onTarget) { emit('SHOT_OFF_TARGET', team, shooter, undefined, metadata); return; }
    shooter.stats.shotsOnTarget++; team.statistics.shotsOnTarget++;
    const pressure = .90 + value(shooter.player.mentality, 'pressure_handling') / 500;
    const conversion = clamp(xG / onTarget * Math.pow(Math.max(8, finishing) / Math.max(8, goalkeeping), .65) * pressure, .025, .87);
    if (rng() < conversion) {
      team.score++; shooter.stats.goals++;
      if (passer && passer !== shooter) passer.stats.assists++;
      for (const player of active(opponent)) player.stats.goalsConceded++;
      emit('GOAL', team, shooter, passer !== shooter ? passer : undefined, { ...metadata, homeScore: home.score, awayScore: away.score });
    } else {
      if (keeper) keeper.stats.saves++;
      opponent.statistics.saves++;
      emit('SHOT_SAVED', team, shooter, keeper, metadata);
      if (rng() < .25) { team.statistics.corners++; emit('CORNER', team, shooter); }
    }
  };
  const possession = () => {
    const homeMatchup = currentMatchup(home, away), awayMatchup = currentMatchup(away, home);
    const controlHome = power(home, 'control') * tacticalLeverage(homeMatchup, awayMatchup, rulebook).control;
    const controlAway = power(away, 'control') * tacticalLeverage(awayMatchup, homeMatchup, rulebook).control;
    const team = rng() < controlHome / (controlHome + controlAway) ? home : away;
    const opponent = team === home ? away : home;
    team.statistics.possessionActions++;
    const passer = choose(outfield(team), p => skill(p, ['pas', 'vis'], team) * (has(p, 'dictates_tempo') || has(p, 'comes_deep') ? 1.6 : 1) * roleFactor(p, 'control') * playerRole(p.player).pass);
    const defender = choose(outfield(opponent), p => skill(p, ['tac', 'wor', 'pos'], opponent) * (isDefender(p) ? 1.5 : 1) * playerRole(p.player).press * playerRole(p.player).shield);
    // Goalkeeper distribution contributes to building every possession.
    const keeper = active(team).find(p => p.finalPosition === 'GK');
    const keeperInstructions = directives(team, keeper);
    const distribution = keeper ? skill(keeper, ['gk_kic', 'pas', 'fir'], team) * keeperPolicy(keeper.player).distribution *
      (keeperInstructions.includes('SLOW_PACE_DOWN') ? 1.05 : keeperInstructions.includes('DISTRIBUTE_QUICKLY') ? .97 : 1) : 20;
    const passSkill = skill(passer, ['pas', 'vis', 'tec', 'dec', 'fir'], team) * .9 + distribution * .1;
    const defensiveInstructions = directives(opponent, defender);
    const marking = defensivePolicy(defensiveInstructions).marking;
    const pressing = skill(defender, ['tac', 'wor', 'acc'], opponent) * (0.8 + opponent.tactic.pressing / 250) * marking;
    const direct = ['LONG', 'DIRECT'].includes(team.tactic.passingStyle);
    const decision = decidePossession({ ...passer.player, instructions: directives(team, passer) }, outfield(team).map(p => p.player), team.tactic,
      team.input.instructions || [], pressing, skill(passer, ['dec', 'vis', 'cmp'], team), rng);
    const risky = decision.risky;
    const ownMatchup = currentMatchup(team, opponent);
    const oppMatchup = currentMatchup(opponent, team);
    const leverage = tacticalLeverage(ownMatchup, oppMatchup, rulebook, decision.route);
    const completion = clamp(.83 + (passSkill - pressing) / 350 + (team.tactic.passingStyle === 'SHORT' ? .035 : direct ? -.06 : 0) -
      (risky ? .045 : 0) - (team.tactic.tempo - 50) / 1400 + (value(passer.player.mentality, 'adaptability') - 50) / 4000 +
      decision.completion + (dominance ? leverage.completion : -ownMatchup.buildup * .3), .50, .97);
    const passes = 1 + Math.floor(rng() * (direct ? 2 : 4));
    passer.stats.passes += passes; team.statistics.passes += passes;
    const completed = rng() < completion;
    const accurate = completed ? passes : passes - 1;
    passer.stats.passesCompleted += accurate; team.statistics.passesCompleted += accurate;
    if (!completed) {
      defender.stats.interceptions++;
      emit('INTERCEPTION', opponent, defender, passer, { passes: accurate });
      return;
    }
    emit('PASS_COMPLETED', team, passer, undefined, { passes });
    if (rng() < decision.dribbleChance) {
      const dribbler = choose(outfield(team), p => skill(p, ['dri', 'agi', 'pac'], team) * (isForward(p) ? 2 : .7));
      dribbler.stats.dribbles++; defender.stats.tackles++; opponent.statistics.tackles++;
      if (rng() < clamp(.5 + (skill(dribbler, ['dri', 'agi', 'bal', 'acc'], team) - skill(defender, ['tac', 'str', 'agi'], opponent)) / 160 +
          defensivePolicy(defensiveInstructions).duelAdjustment, .18, .85)) {
        dribbler.stats.dribblesWon++; emit('DRIBBLE', team, dribbler, defender);
      } else {
        defender.stats.tacklesWon++; opponent.statistics.tacklesWon++;
        emit('TACKLE', opponent, defender, dribbler); return;
      }
    }
    // Same-cause high-line vulnerability and matrix defense penalty share one capped budget.
    const defensiveExposure = Math.min(.15, Math.max(dominance ? 0 : oppMatchup.defense, transitionSpace(team.tactic, opponent.tactic, team.input.instructions || [])));
    const routePenalty = defensivePolicy(defensiveInstructions, decision.route).routePenalty;
    const progressionPenalty = ownMatchup.progression * (decision.route === 'CENTRE' ? 1 : .4);
    const creationPenalty = ownMatchup.byAxis.BOX + ownMatchup.byAxis.WIDE * (decision.route === 'WIDE' ? 1 : .4) +
      ownMatchup.byAxis.BETWEEN_LINES * (decision.route !== 'WIDE' ? 1 : .4);
    const chance = clamp(.105 * Math.pow(power(team, 'attack') / power(opponent, 'defense'), 1.25) *
      (dominance ? leverage.opportunity : 1 - progressionPenalty - creationPenalty) / (1 - defensiveExposure) * (risky ? 1.18 : 1) *
      decision.shootFactor * (1 - routePenalty), .025, .30);
    if (rng() < chance) {
      if (rng() < clamp(.03 + opponent.tactic.defensiveLine / 1300 - (has(passer, 'beats_offside') ? .02 : 0) +
          defensivePolicy(defensiveInstructions).offsideBonus, .01, .12)) {
        team.statistics.offsides++; emit('OFFSIDE', team, passer); return;
      }
      // Crossing quality changes the chance to create a shot for wide attacks.
      if (decision.route === 'WIDE' || has(passer, 'hugs_touchline') || has(passer, 'switches_play') || has(passer, 'OVERLAP_WINGS')) {
        if (rng() > clamp(.65 + (skill(passer, ['cro', 'tec'], team) - power(opponent, 'defense')) / 200, .3, .9)) return;
      }
      shot(team, opponent, passer, false, decision.route);
    }
  };
  const foul = () => {
    if (rng() >= .19) return;
    const team = rng() < .5 ? home : away, opponent = team === home ? away : home;
    const player = choose(outfield(team), p => 1 + (100 - value(p.player.mentality, 'temperament')) / 100 + (has(p, 'dives_into_tackles') ? .7 : 0));
    const victim = choose(outfield(opponent), p => isForward(p) ? 2 : 1);
    player.stats.fouls++; team.statistics.fouls++; emit('FOUL', team, player, victim);
    const defensiveInstructions = directives(team, player);
    const aggression = (has(player, 'dives_into_tackles') ? .08 : 0) + (has(player, 'tight_marking') ? .015 : 0) +
      defensivePolicy(defensiveInstructions).aggression;
    const cardChance = clamp(.24 + aggression + (50 - value(player.player.mentality, 'temperament')) / 500 - (team.coaching.discipline - 50) / 700, .08, .5);
    if (rng() < cardChance) {
      if (rng() < .035 + aggression / 5) {
        player.stats.redCards = 1; team.statistics.redCards++; remove(player); emit('RED_CARD', team, player);
      } else {
        player.stats.yellowCards++; team.statistics.yellowCards++; emit('YELLOW_CARD', team, player);
        if (player.stats.yellowCards === 2) { player.stats.redCards = 1; team.statistics.redCards++; remove(player); emit('SECOND_YELLOW_RED', team, player); }
      }
    }
    if (rng() < .015) {
      const shooter = choose(outfield(opponent), p => skill(p, ['fin', 'cmp'], opponent) + value(p.player.mentality, 'pressure_handling'));
      const keeper = active(team).find(p => p.finalPosition === 'GK');
      emit('PENALTY_AWARDED', opponent, shooter, player);
      shooter.stats.shots++; shooter.stats.xG += .76; opponent.statistics.shots++; opponent.statistics.xG += .76;
      if (rng() < .9) {
        shooter.stats.shotsOnTarget++; opponent.statistics.shotsOnTarget++;
        const keeperSkill = keeper ? skill(keeper, ['gk_ref', 'gk_ooo'], team) * coachFactor(team.coaching.goalkeeping) : 15;
        const success = rng() < clamp(.82 + (skill(shooter, ['fin', 'cmp'], opponent) - keeperSkill) / 350 +
          (value(shooter.player.mentality, 'pressure_handling') - 50) / 600, .45, .95);
        if (success) {
          opponent.score++; shooter.stats.goals++;
          for (const p of active(team)) p.stats.goalsConceded++;
          emit('GOAL', opponent, shooter, undefined, { shotType: 'PENALTY', xG: .76, homeScore: home.score, awayScore: away.score });
        } else {
          if (keeper) keeper.stats.saves++;
          team.statistics.saves++; emit('SHOT_SAVED', opponent, shooter, keeper, { shotType: 'PENALTY', xG: .76 });
        }
      } else emit('SHOT_OFF_TARGET', opponent, shooter, undefined, { shotType: 'PENALTY', xG: .76 });
    } else if (rng() < .13) shot(opponent, team, victim, true);
  };
  const fatigueAndInjuries = () => {
    for (const team of teams) {
      for (const player of active(team)) {
        const sta = value(player.player.attributes, 'sta', player.player.ovr);
        const intensity = .75 + team.tactic.tempo / 200 + team.tactic.pressing / 160 + (player.player.duty === 'ATTACK' ? .08 : 0);
        const loss = (player.finalPosition === 'GK' ? .05 : .16) * intensity * (1.35 - sta / 180) * (1.08 - team.coaching.fitness / 600);
        const minimumFitness = Math.max(0, player.stats.fitnessStart - MAX_MATCH_FITNESS_LOSS);
        const nextFitness = clamp(player.stats.fitnessEnd - loss, minimumFitness, 100);
        const appliedLoss = player.stats.fitnessEnd - nextFitness;
        player.stats.fitnessEnd = nextFitness;
        player.stats.fatigueEnd = clamp(player.stats.fatigueEnd + appliedLoss * .6, 0, 100);
      }
      const candidate = choose(active(team), p => 1 + value(p.player.mentality, 'injury_proneness') / 100);
      const susceptibility = 1 + (value(candidate.player.mentality, 'injury_proneness') - 50) / 50 * .6;
      const risk = (input.config?.injuryRate ?? .0014) * susceptibility * (1 + (100 - candidate.stats.fitnessEnd) / 60) *
        (1.15 - team.coaching.injuryPrevention / 250) * (candidate.finalPosition === 'GK' ? .4 : 1);
      if (rng() < risk) {
        candidate.stats.injured = true;
        candidate.stats.injuryDays = Math.ceil((2 + rng() * 10) * (value(candidate.player.mentality, 'injury_proneness') >= 80 ? 1.25 : 1) *
          (1.15 - team.coaching.rehabilitation / 400));
        team.statistics.injuries++;
        emit('INJURY', team, candidate, undefined, { days: candidate.stats.injuryDays });
        if (!substitute(team, candidate, true)) {
          remove(candidate);
          if (candidate.finalPosition === 'GK' && active(team).length) {
            const emergency = [...active(team)].sort((a, b) => skill(b, ['gk_ref', 'gk_han'], team) - skill(a, ['gk_ref', 'gk_han'], team))[0];
            emergency.finalPosition = 'GK'; emergency.formationPositionId = candidate.formationPositionId;
            emergency.player = { ...emergency.player, positionAbility: 25, role: 'EMERGENCY_GOALKEEPER', duty: 'DEFEND' };
            emit('POSITION_CHANGE', team, emergency, undefined, { position: 'GK', emergency: true });
          }
        }
      }
      if ([55, 65, 75, 105].includes(minute) && !addedTime) {
        const threshold = 76 + team.coaching.decisions / 12;
        const tired = outfield(team).filter(p => p.stats.fitnessEnd < threshold).sort((a, b) => a.stats.fitnessEnd - b.stats.fitnessEnd);
        for (const player of tired.slice(0, minute === 75 ? 2 : 1)) substitute(team, player);
      }
    }
  };
  const tick = () => {
    elapsed++;
    for (const team of teams) if (active(team).length < 7) throw new Error('Match cannot continue with fewer than seven players');
    for (const team of teams) for (const player of active(team)) player.stats.minutes++;
    adapt(home, away); adapt(away, home);
    for (let i = 0; i < 3; i++) possession();
    foul(); fatigueAndInjuries();
    for (const team of teams) if (active(team).length < 7) throw new Error('Match cannot continue with fewer than seven players');
  };
  const half = (start: number, end: number, nextPhase: MatchPhase) => {
    phase = nextPhase; addedTime = 0; minute = start;
    emit(start === 1 ? 'KICK_OFF' : 'PERIOD_START');
    const startEvents = events.length;
    for (minute = start; minute <= end; minute++) { addedTime = 0; tick(); }
    const stoppages = events.slice(startEvents).filter(e => ['GOAL', 'SUBSTITUTION', 'INJURY', 'RED_CARD', 'SECOND_YELLOW_RED'].includes(e.eventType)).length;
    const extra = Math.min(nextPhase.startsWith('EXTRA') ? 2 : 6, 1 + Math.floor(stoppages / 2));
    minute = end;
    for (addedTime = 1; addedTime <= extra; addedTime++) tick();
    addedTime = extra;
    emit(nextPhase === 'FIRST_HALF' ? 'HALF_TIME' : 'PERIOD_END');
  };
  half(1, 45, 'FIRST_HALF');
  // Half-time coaching talk changes match state only; fixed mentality traits are never rewritten.
  for (const team of teams) {
    for (const player of active(team)) {
      player.player = { ...player.player, status: { ...player.player.status,
        morale: clamp(player.player.status.morale + (team.coaching.motivation - 35) / 7, 0, 100) } };
    }
    emit('TEAM_TALK', team, undefined, undefined, { coachId: team.coaching.headCoachId, assistantCount: team.coaching.assistantIds.length });
  }
  half(46, 90, 'SECOND_HALF');
  const regularHome = home.score, regularAway = away.score;
  const aggregate = () => [home.score + input.rules.aggregateHome, away.score + input.rules.aggregateAway];
  const tied = () => {
    const [h, a] = aggregate();
    if (h !== a) return false;
    if (input.rules.awayGoals) return (input.rules.priorHomeAwayGoals || 0) === (input.rules.priorAwayAwayGoals || 0) + away.score;
    return true;
  };
  let resultType: EngineResult['resultType'] = 'REGULAR';
  let extraHome: number | null = null, extraAway: number | null = null;
  let penaltyHome: number | null = null, penaltyAway: number | null = null;
  if (input.rules.knockout && input.rules.decidingLeg && tied()) {
    if (input.rules.extraTime) {
      half(91, 105, 'EXTRA_FIRST'); half(106, 120, 'EXTRA_SECOND');
      extraHome = home.score - regularHome; extraAway = away.score - regularAway; resultType = 'EXTRA_TIME';
    }
    if (tied()) {
      if (!input.rules.penalties) throw new Error('Knockout remains tied without an enabled tie-breaker');
      phase = 'SHOOTOUT'; minute = input.rules.extraTime ? 120 : 90; addedTime = 0;
      resultType = 'PENALTIES'; penaltyHome = 0; penaltyAway = 0;
      const count = Math.min(active(home).length, active(away).length);
      const shooters = teams.map(team => [...active(team)].sort((a, b) =>
        skill(b, ['fin', 'cmp', 'tec'], team) + value(b.player.mentality, 'pressure_handling') -
        skill(a, ['fin', 'cmp', 'tec'], team) - value(a.player.mentality, 'pressure_handling')).slice(0, count));
      let kicksHome = 0, kicksAway = 0;
      for (let pair = 0; pair < 55; pair++) {
        for (let side = 0; side < 2; side++) {
          const team = teams[side], opponent = teams[1 - side];
          const shooter = shooters[side][pair % count];
          const keeper = active(opponent).find(p => p.finalPosition === 'GK');
          const stopping = keeper ? skill(keeper, ['gk_ref', 'gk_ooo'], opponent) * coachFactor(opponent.coaching.goalkeeping) : 15;
          const success = rng() < clamp(.74 + (skill(shooter, ['fin', 'cmp', 'tec'], team) - stopping) / 350 +
            (value(shooter.player.mentality, 'pressure_handling') - 50) / 500, .40, .93);
          if (side === 0) { kicksHome++; if (success) penaltyHome++; }
          else { kicksAway++; if (success) penaltyAway++; }
          emit(success ? 'PENALTY_SCORED' : 'PENALTY_MISSED', team, shooter, keeper, { homePenaltyScore: penaltyHome, awayPenaltyScore: penaltyAway, kick: pair + 1 });
          if (pair < 5 && (penaltyHome > penaltyAway + Math.max(0, 5 - kicksAway) || penaltyAway > penaltyHome + Math.max(0, 5 - kicksHome))) break;
        }
        if (pair < 5 && (penaltyHome > penaltyAway + Math.max(0, 5 - kicksAway) || penaltyAway > penaltyHome + Math.max(0, 5 - kicksHome)) ||
            pair >= 4 && kicksHome === kicksAway && penaltyHome !== penaltyAway) break;
      }
      if (penaltyHome === penaltyAway) throw new Error('Shootout unresolved; result was not committed');
    }
  }
  const [aggregateHome, aggregateAway] = aggregate();
  let winnerClubId: string | null = null;
  if (!input.rules.knockout || input.rules.decidingLeg) {
    if (aggregateHome !== aggregateAway) winnerClubId = aggregateHome > aggregateAway ? home.input.id : away.input.id;
    else if (input.rules.awayGoals && !tied()) winnerClubId = (input.rules.priorHomeAwayGoals || 0) > (input.rules.priorAwayAwayGoals || 0) + away.score ? home.input.id : away.input.id;
    else if (penaltyHome !== null) winnerClubId = penaltyHome > penaltyAway ? home.input.id : away.input.id;
  }
  emit('FULL_TIME', undefined, undefined, undefined, { homeScore: home.score, awayScore: away.score, winnerClubId, resultType });
  const actions = home.statistics.possessionActions + away.statistics.possessionActions;
  const finish = (team: RuntimeTeam): EngineTeamResult => {
    team.statistics.possession = round(team.statistics.possessionActions / Math.max(1, actions) * 100);
    team.statistics.passAccuracy = round(team.statistics.passesCompleted / Math.max(1, team.statistics.passes) * 100);
    team.statistics.xG = round(team.statistics.xG);
    const opponent = team === home ? away : home;
    return { id: team.input.id, statistics: team.statistics, coaching: team.coaching,
      players: team.players.map(p => {
        const s = p.stats;
        s.fitnessEnd = round(s.fitnessEnd); s.fatigueEnd = round(s.fatigueEnd); s.xG = round(s.xG);
        s.cleanSheet = s.minutes >= 60 && s.goalsConceded === 0;
        s.rating = s.minutes ? round(clamp(6 + s.goals * .85 + s.assists * .5 + s.keyPasses * .035 + s.tacklesWon * .08 +
          s.saves * .12 + (s.passesCompleted - (s.passes - s.passesCompleted) * 2) * .006 + s.dribblesWon * .04 -
          s.yellowCards * .18 - s.redCards * 1.2 - (p.finalPosition === 'GK' ? s.goalsConceded * .25 : s.goalsConceded * .08) +
          (team.score > opponent.score ? .25 : 0) + (s.cleanSheet && (p.finalPosition === 'GK' || isDefender(p)) ? .3 : 0), 1, 10)) : 0;
        return { player: p.player, stats: s, finalPosition: p.finalPosition, formationPositionId: p.formationPositionId };
      }) };
  };
  const homeResult = finish(home), awayResult = finish(away);
  // Correct rounding residual so displayed possession is exactly 100%.
  awayResult.statistics.possession = round(100 - homeResult.statistics.possession);
  const motm = [...homeResult.players, ...awayResult.players].filter(p => p.stats.minutes > 0).sort((a, b) => b.stats.rating - a.stats.rating || b.stats.goals - a.stats.goals || a.player.id.localeCompare(b.player.id))[0];
  return { version: dominance ? MATCH_ENGINE_VERSION : '2.2.0', seed: input.seed, duration: elapsed,
    homeScore: home.score, awayScore: away.score, homeRegularScore: regularHome, awayRegularScore: regularAway,
    homeExtraScore: extraHome, awayExtraScore: extraAway, homePenaltyScore: penaltyHome, awayPenaltyScore: penaltyAway,
    resultType, winnerClubId, aggregateHome, aggregateAway, motmPlayerId: motm.player.id,
    events, home: homeResult, away: awayResult };
}
