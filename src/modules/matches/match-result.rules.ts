import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EngineRules } from './match-engine';

export interface MatchScore {
  status: string; home_club_id: bigint | null; away_club_id: bigint | null;
  home_score: number | null; away_score: number | null; home_penalty_score?: number | null; away_penalty_score?: number | null;
}
export const isFinishedMatch = (m: { status: string }) => ['FINISHED', 'COMPLETED'].includes(m.status);
export function singleMatchWinner(m: MatchScore): bigint | null {
  if (!isFinishedMatch(m) || m.home_score == null || m.away_score == null) return null;
  if (m.home_score !== m.away_score) return m.home_score > m.away_score ? m.home_club_id : m.away_club_id;
  if (m.home_penalty_score != null && m.away_penalty_score != null && m.home_penalty_score !== m.away_penalty_score) {
    return m.home_penalty_score > m.away_penalty_score ? m.home_club_id : m.away_club_id;
  }
  return null;
}
export function twoLegWinner(first: MatchScore, second: MatchScore, awayGoals = false): bigint | null {
  if (!isFinishedMatch(first) || !isFinishedMatch(second) || first.home_club_id !== second.away_club_id ||
      first.away_club_id !== second.home_club_id || [first.home_score, first.away_score, second.home_score, second.away_score].some(s => s == null)) return null;
  const a = first.home_score + second.away_score, b = first.away_score + second.home_score;
  if (a !== b) return a > b ? first.home_club_id : first.away_club_id;
  if (awayGoals && first.away_score !== second.away_score) return first.away_score > second.away_score ? first.away_club_id : first.home_club_id;
  if (second.home_penalty_score != null && second.away_penalty_score != null && second.home_penalty_score !== second.away_penalty_score) {
    return second.home_penalty_score > second.away_penalty_score ? second.home_club_id : second.away_club_id;
  }
  return null;
}

type RuleMatch = Prisma.matchesGetPayload<{
  include: {
    competition_seasons: { include: { competitions: true } };
    competition_stages: true;
    stage_rounds: { include: { knockout_round_rules: true } };
  };
}>;
/** Existing generators encode continental leg pairs as rounds 1/2, 3/4, 5/6 and final 7. */
export async function resolveEngineRules(tx: Prisma.TransactionClient, match: RuleMatch): Promise<EngineRules> {
  const comp = match.competition_seasons?.competitions;
  const knockout = match.competition_stages?.stage_type === 'KNOCKOUT' ||
    comp?.format_type === 'CUP' || comp?.competition_type === 'DOMESTIC_SUPER_CUP';
  const rules: EngineRules = { knockout, decidingLeg: knockout, extraTime: false, penalties: false, aggregateHome: 0, aggregateAway: 0 };
  if (!knockout || match.match_type === 'FRIENDLY') return { ...rules, knockout: false, decidingLeg: false };
  const configured = match.stage_rounds?.knockout_round_rules || [];
  if (configured.length > 1) throw new BadRequestException('Vòng đấu có nhiều cấu hình knockout mâu thuẫn');
  const config = configured[0];
  const continental = comp?.competition_type.startsWith('CONTINENTAL_CLUB');
  const round = match.stage_rounds?.round_no;
  const legs = config?.legs ?? (continental ? round >= 1 && round <= 6 ? 2 : round === 7 ? 1 : 0 : 1);
  if (![1, 2].includes(legs)) throw new BadRequestException('Chưa xác định được thể thức một/hai lượt của vòng đấu');
  rules.extraTime = config?.extra_time ?? true;
  rules.penalties = config?.penalties ?? true;
  rules.awayGoals = config?.away_goals_rule ?? false;
  if (legs === 1) return rules;

  let first: Prisma.matchesGetPayload<{}> | undefined;
  if (match.tie_id) {
    const tied = await tx.matches.findMany({ where: { tie_id: match.tie_id }, orderBy: [{ match_date: 'asc' }, { kickoff_time: 'asc' }] });
    if (tied.length !== 2 || tied[0].match_date.getTime() === tied[1].match_date.getTime() && tied[0].kickoff_time.getTime() === tied[1].kickoff_time.getTime()) {
      throw new BadRequestException('Cặp knockout phải có đúng hai lượt với thứ tự thời gian rõ ràng');
    }
    rules.decidingLeg = tied[1].id === match.id;
    first = tied[0];
  } else {
    if (!round || round < 1 || round > 6) throw new BadRequestException('Hai lượt chưa có định danh cặp/vòng hợp lệ');
    rules.decidingLeg = round % 2 === 0;
    if (rules.decidingLeg) {
      const previous = await tx.matches.findMany({ where: {
        competition_season_id: match.competition_season_id, stage_id: match.stage_id,
        stage_rounds: { round_no: round - 1 }, home_club_id: match.away_club_id, away_club_id: match.home_club_id,
      } });
      if (previous.length !== 1) throw new BadRequestException('Không tìm được duy nhất lượt đi đảo sân tương ứng');
      first = previous[0];
    }
  }
  if (!rules.decidingLeg) return rules;
  if (!first || !isFinishedMatch(first) || first.home_score == null || first.away_score == null ||
      first.home_club_id !== match.away_club_id || first.away_club_id !== match.home_club_id) {
    throw new BadRequestException('Lượt đi chưa hoàn tất hoặc không khớp cặp đấu');
  }
  rules.aggregateHome = first.away_score; rules.aggregateAway = first.home_score;
  rules.priorHomeAwayGoals = first.away_score; rules.priorAwayAwayGoals = 0;
  return rules;
}
