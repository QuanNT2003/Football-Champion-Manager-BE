import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MatchLineupService } from './match-lineup.service';
import { MatchResultService } from './match-result.service';
import { ATTRIBUTE_KEYS, coachingEffects, EngineInput, EnginePlayer, EngineTeam, simulateMatchEngine } from './match-engine';
import { normalizeTeam } from './tactic-normalizer';
import { TACTICAL_RULEBOOK_V2 as TACTICAL_RULEBOOK } from './tactical-rulebook-v2';
import { isFinishedMatch, resolveEngineRules } from './match-result.rules';
import { publicEngineLineup } from './match-report';
import { updateMatchRankingPoints } from './match-ranking';

const MATCH_TRANSACTION_TIMEOUT_MS = 30_000;

@Injectable()
export class MatchSimulatorService {
  private readonly logger = new Logger(MatchSimulatorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineups: MatchLineupService,
    private readonly results: MatchResultService,
  ) {}

  async simulateMatch(matchId: bigint) {
    const startedAt = Date.now();
    try {
      return await this.prisma.$transaction(tx => this.simulatePreparedMatch(tx, matchId), {
        timeout: MATCH_TRANSACTION_TIMEOUT_MS, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
        this.logger.error(`Match ${matchId}: transaction closed after ${Date.now() - startedAt}ms (timeout ${MATCH_TRANSACTION_TIMEOUT_MS}ms)`);
      }
      throw error;
    }
  }

  private async simulatePreparedMatch(tx: Prisma.TransactionClient, matchId: bigint) {
    await tx.$queryRaw`SELECT id FROM matches WHERE id = ${matchId} FOR UPDATE`;
    const match = await tx.matches.findUnique({ where: { id: matchId }, include: {
      competition_seasons: { include: { competitions: true } }, competition_stages: true,
      stage_rounds: { include: { knockout_round_rules: true } }, stadiums: true,
      clubs_matches_home_club_idToclubs: { include: { stadiums: true, financial_accounts: true } },
      clubs_matches_away_club_idToclubs: true,
    } });
    if (!match) throw new NotFoundException('Trận đấu không tồn tại');
    if (isFinishedMatch(match)) return { message: 'Trận đấu này đã kết thúc', matchId: matchId.toString(), alreadyFinished: true };
    const homeClub = match.clubs_matches_home_club_idToclubs, awayClub = match.clubs_matches_away_club_idToclubs;
    if (!homeClub || !awayClub) throw new Error('Trận đấu phải có cả CLB chủ nhà và đội khách');
    const ranked = match.match_type !== 'FRIENDLY' && !match.competition_seasons?.competitions?.is_youth;
    if (homeClub.world_id !== awayClub.world_id) throw new Error('Hai CLB phải thuộc cùng thế giới');
    const rules = await resolveEngineRules(tx, match);
    const prepared = await this.lineups.prepareMatchLineups(tx, match);
    const teams: EngineTeam[] = [];
    for (const [club, ready] of [[homeClub, prepared.home], [awayClub, prepared.away]] as const) {
      const staff = await tx.staff_contracts.findMany({ where: {
        club_id: club.id, status: 'ACTIVE',
        role: { in: ['HEAD_COACH', 'ASSISTANT_COACH', 'HEAD_COACH_YOUTH', 'ASSISTANT_COACH_YOUTH', 'FITNESS_COACH', 'GOALKEEPING_COACH', 'PHYSIO'] },
      }, include: { staff: { include: { staff_attributes: true } } }, orderBy: { id: 'asc' } });
      const snapshot = ready.tactic;
      const instructions = snapshot.position_instructions as Record<string, string[]> | undefined;
      const players: EnginePlayer[] = ready.positions.filter(p => p.player).map(row => {
        const p = row.player;
        const natural = [...p.player_positions].sort((a, b) => Number(b.is_preferred) - Number(a.is_preferred) || b.ability - a.ability)[0];
        const position = row.slot?.positions.code || natural?.positions.code || 'CM';
        const ability = p.player_positions.find(pos => pos.positions.code === position)?.ability ??
          (p.player_positions.some(pos => pos.positions.category === row.slot?.positions.category) ? 65 : 35);
        const status = p.player_status;
        return {
          id: p.id.toString(), name: `${p.first_name} ${p.last_name}`.trim(), position,
          formationPositionId: row.slot?.id.toString() || null, role: row.role, duty: row.duty,
          coordinates: row.slot ? { x: Number(row.slot.x), y: Number(row.slot.y) } : undefined,
          started: row.lineup_role === 'STARTING', shirtNumber: p.squad_number,
          ovr: p.ovr, positionAbility: ability, isCaptain: ready.captainPlayerIds.includes(p.id),
          attributes: Object.fromEntries(ATTRIBUTE_KEYS.map(k => [k, Number(p.player_attributes?.[k] ?? p.ovr)])),
          mentality: p.player_mentality ? Object.fromEntries(Object.entries(p.player_mentality).filter(([key]) => key !== 'player_id').map(([key, v]) => [key, Number(v)])) : {},
          traits: p.player_tactics ? Object.fromEntries(Object.entries(p.player_tactics).filter(([key]) => key !== 'player_id').map(([key, v]) => [key, typeof v === 'bigint' ? v.toString() : v])) : {},
          status: { condition: status.condition, fitness: status.fitness, fatigue: status.fatigue ?? 0,
            morale: status.morale ?? 50, form: status.form ?? 50, sharpness: status.match_sharpness ?? 50 },
          instructions: instructions?.[row.slot?.id.toString()] || [],
        };
      });
      teams.push({
        id: club.id.toString(), name: club.name, hasUser: club.owner_user_id != null,
        squadType: ready.squadType, players,
        formationCode: snapshot.formation_code ? String(snapshot.formation_code) : undefined,
        instructions: Array.isArray(snapshot.team_instructions) ? snapshot.team_instructions.map(String) : [],
        tactic: { mentality: String(snapshot.mentality || 'BALANCED'), tempo: Number(snapshot.tempo ?? 50),
          passingStyle: String(snapshot.passing_style || 'MIXED'), pressing: Number(snapshot.pressing_intensity ?? 50), defensiveLine: Number(snapshot.defensive_line ?? 50) },
        coaches: staff.map(c => ({ id: c.staff_id.toString(), name: c.staff.name, role: c.role, squadType: c.squad_type,
          attributes: Object.fromEntries(Object.entries(c.staff.staff_attributes || {}).filter(([key]) => key !== 'staff_id').map(([key, v]) => [key, Number(v)])) })),
      });
      const team = teams[teams.length - 1];
      const headId = coachingEffects(team).headCoachId;
      team.tacticalStyle = String(snapshot.tactical_style || staff.find(c => c.staff_id.toString() === headId)?.staff.tactical_style || 'BALANCED');
    }
    const input: EngineInput = { seed: randomInt(0, 0x100000000), home: normalizeTeam(teams[0]), away: normalizeTeam(teams[1]), rules,
      config: { tacticalModel: 'contextual_v2', rulesetVersion: TACTICAL_RULEBOOK.version, rulesetHash: TACTICAL_RULEBOOK.hash } };
    const result = simulateMatchEngine(input);
    const ranking = ranked ? await updateMatchRankingPoints(tx, homeClub.world_id, input.home.id, input.away.id, result) : null;
    await this.results.persist(tx, match, input, result, prepared, ranking);
    const stadium = match.stadiums || homeClub.stadiums?.[0];
    const capacity = stadium?.capacity || 25000;
    const avgReputation = (homeClub.reputation + awayClub.reputation) / 20000;
    const attendance = Math.floor(capacity * Math.min(.98, Math.max(.4, .5 + avgReputation * .4)));
    const ticketRevenue = attendance * 25;
    await tx.matches.update({ where: { id: matchId }, data: {
      home_score: result.homeScore, away_score: result.awayScore,
      home_regular_score: result.homeRegularScore, away_regular_score: result.awayRegularScore,
      home_extra_score: result.homeExtraScore, away_extra_score: result.awayExtraScore,
      home_penalty_score: result.homePenaltyScore, away_penalty_score: result.awayPenaltyScore,
      result_type: result.resultType, status: 'FINISHED', attendance, ticket_revenue: ticketRevenue,
    } });
    await tx.match_events.createMany({ data: result.events.map(e => ({
      match_id: matchId, minute: e.minute, event_type: e.eventType,
      club_id: e.clubId ? BigInt(e.clubId) : null, player_id: e.playerId ? BigInt(e.playerId) : null,
      related_player_id: e.relatedPlayerId ? BigInt(e.relatedPlayerId) : null,
      metadata: { ...e.data, sequence: e.sequence, phase: e.phase, addedTime: e.addedTime, elapsed: e.elapsed },
    })) });
    const account = homeClub.financial_accounts?.[0];
    if (account) {
      await tx.financial_accounts.update({ where: { id: account.id }, data: { balance_cash: { increment: ticketRevenue } } });
      await tx.financial_transactions.create({ data: {
        club_id: homeClub.id, financial_account_id: account.id, type: 'MATCHDAY_TICKET_INCOME', category: 'MATCHDAY',
        amount: ticketRevenue, currency_type: 'CASH', reference_type: 'MATCH', reference_id: matchId,
        description: `Doanh thu bán vé trận đấu (${attendance.toLocaleString()} khán giả)`,
        transaction_date: match.match_date, idempotency_key: `MATCH_TICKET_${matchId}`,
      } });
      await tx.club_news.create({ data: {
        club_id: homeClub.id, season_id: match.season_id, news_type: 'FINANCE',
        title: `Doanh thu vé: ${homeClub.name} - ${awayClub.name}`.slice(0, 255),
        content: `Trận ${homeClub.name} - ${awayClub.name}: ${attendance.toLocaleString('vi-VN')} khán giả, doanh thu bán vé ${ticketRevenue.toLocaleString('vi-VN')} CASH đã được cộng vào ngân sách CLB.`,
        published_at: new Date(),
      } });
    }
    this.logger.log(`Match ${matchId}: ${homeClub.name} ${result.homeScore}-${result.awayScore} ${awayClub.name} (${result.resultType})`);
    const byId = new Map([...input.home.players, ...input.away.players].map(p => [p.id, p]));
    return {
      matchId: matchId.toString(), homeClub: homeClub.name, awayClub: awayClub.name,
      homeScore: result.homeScore, awayScore: result.awayScore, homeRegularScore: result.homeRegularScore, awayRegularScore: result.awayRegularScore,
      homeExtraScore: result.homeExtraScore, awayExtraScore: result.awayExtraScore,
      homePenaltyScore: result.homePenaltyScore, awayPenaltyScore: result.awayPenaltyScore,
      resultType: result.resultType, winnerClubId: result.winnerClubId, aggregateHome: result.aggregateHome, aggregateAway: result.aggregateAway,
      duration: result.duration, motmPlayerId: result.motmPlayerId, attendance, ticketRevenue,
      ranking,
      statistics: { home: result.home.statistics, away: result.away.statistics },
      lineups: [publicEngineLineup(input.home, result.home), publicEngineLineup(input.away, result.away)],
      events: result.events.map(e => ({
        id: String(e.sequence), minute: e.minute, eventType: e.eventType, clubId: e.clubId,
        playerId: e.playerId, playerName: byId.get(e.playerId)?.name,
        player: e.playerId ? { id: e.playerId, name: byId.get(e.playerId)?.name } : null,
        relatedPlayer: e.relatedPlayerId ? { id: e.relatedPlayerId, name: byId.get(e.relatedPlayerId)?.name } : null,
        metadata: { ...e.data, sequence: e.sequence, phase: e.phase, addedTime: e.addedTime, elapsed: e.elapsed },
      })),
    };
  }
}
