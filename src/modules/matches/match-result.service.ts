import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { clamp, EngineInput, EngineResult } from './match-engine';
import { MatchRanking } from './match-ranking';
import { consolidatePlayerStatistics } from '../players/player-statistics';
import { accumulatedYellowCards, banAppliesToMatch, crossesYellowCardThreshold, disciplineMatchFilter, DisciplineMatch, suspensionCompetition } from '../players/discipline-scope';

interface ResultContext extends DisciplineMatch {
  id: bigint; season_id: bigint | null; competition_season_id: bigint | null;
  stage_id: bigint | null; group_id: bigint | null; tie_id: bigint | null;
  match_date: Date; season_day: number; match_type: string;
  competition_stages?: { stage_type: string } | null;
  competition_seasons?: { name: string } | null;
}
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

@Injectable()
export class MatchResultService {
  async persist(
    tx: Prisma.TransactionClient, match: ResultContext, input: EngineInput, result: EngineResult,
    lineups: { home: { lineupId: bigint; rosterPlayerIds: bigint[] }; away: { lineupId: bigint; rosterPlayerIds: bigint[] } },
    ranking: MatchRanking | null = null,
  ) {
    const injuries = [...result.home.players, ...result.away.players].filter(p => p.stats.injured);
    const injuryType = injuries.length ? await tx.injury_types.findFirst({ orderBy: { id: 'asc' } }) : null;
    if (injuries.length && !injuryType) throw new Error('Missing injury catalogue; match was not committed');
    const bansToRefresh = new Set<bigint>();
    const yellowBefore = new Map<bigint, number>();
    if (match.season_id && match.competition_season_id && match.match_type !== 'FRIENDLY') {
      const totals = await tx.match_players.findMany({ where: {
        player_id: { in: [...input.home.players, ...input.away.players].map(p => BigInt(p.id)) },
        match_id: { not: match.id },
        matches: { ...disciplineMatchFilter(match),
          status: { in: ['FINISHED', 'COMPLETED'] }, match_type: { not: 'FRIENDLY' } },
      }, select: { player_id: true, yellow_cards: true, red_cards: true } });
      // The total follows the player across clubs, including the shared league/Super Cup group.
      for (const row of totals) yellowBefore.set(row.player_id, (yellowBefore.get(row.player_id) || 0) + accumulatedYellowCards(row.yellow_cards, row.red_cards));
    }
    if (match.match_type !== 'FRIENDLY') {
      const bans = await tx.player_suspensions.findMany({ where: {
        player_id: { in: [...lineups.home.rosterPlayerIds, ...lineups.away.rosterPlayerIds] },
        status: 'ACTIVE',
      }, include: { competition_seasons: suspensionCompetition } });
      for (const ban of bans.filter(b => banAppliesToMatch(b, match) && b.match_id !== match.id)) {
        const served = ban.matches_served + 1;
        await tx.player_suspensions.update({ where: { id: ban.id }, data: {
          matches_served: served, ...(served >= ban.matches_banned ? { status: 'SERVED', end_date: match.match_date } : {}),
        } });
        bansToRefresh.add(ban.player_id);
      }
    }
    for (const side of ['home', 'away'] as const) {
      const team = result[side], teamInput = input[side], lineupId = lineups[side].lineupId;
      const lineup = await tx.match_lineups.findUnique({ where: { id: lineupId } });
      const previous = lineup.tactics_snapshot && typeof lineup.tactics_snapshot === 'object' && !Array.isArray(lineup.tactics_snapshot)
        ? lineup.tactics_snapshot as Record<string, unknown> : {};
      await tx.match_lineups.update({ where: { id: lineupId }, data: { tactics_snapshot: json({
        ...previous,
        engine: { version: result.version, seed: result.seed, duration: result.duration, rules: input.rules, ranking,
          config: input.config || {}, input: teamInput, coaching: team.coaching,
          statistics: team.statistics, playerStatistics: team.players.map(p => ({ playerId: p.player.id, ...p.stats })),
          winnerClubId: result.winnerClubId, motmPlayerId: result.motmPlayerId,
          aggregateHome: result.aggregateHome, aggregateAway: result.aggregateAway },
      }) } });

      for (const row of team.players) {
        const playerId = BigInt(row.player.id), s = row.stats;
        await tx.match_players.updateMany({ where: { lineup_id: lineupId, player_id: playerId }, data: {
          formation_position_id: row.formationPositionId ? BigInt(row.formationPositionId) : null,
          role: row.player.role, duty: row.player.duty, position_code: row.finalPosition,
          started: row.player.started, minutes: s.minutes, goals: s.goals, assists: s.assists, rating: s.rating,
          yellow_cards: s.yellowCards, red_cards: s.redCards, is_captain: row.player.isCaptain,
          subbed_in_minute: row.player.started ? null : s.enteredMinute, subbed_out_minute: s.leftMinute,
        } });
        if (!s.minutes) continue;
        const won = result.winnerClubId === team.id;
        const lost = result.winnerClubId != null && !won;
        await tx.player_status.update({ where: { player_id: playerId }, data: {
          fitness: Math.round(s.fitnessEnd), fatigue: Math.round(s.fatigueEnd),
          morale: Math.round(clamp(row.player.status.morale + (won ? 4 : lost ? -3 : 0) + (s.rating - 6) * 1.5, 0, 100)),
          form: Math.round(clamp(row.player.status.form * .8 + s.rating * 10 * .2, 0, 100)),
          match_sharpness: Math.round(clamp(row.player.status.sharpness + s.minutes / 15, 0, 100)),
          ...(s.injured ? { is_injured: true } : {}), updated_at: new Date(),
        } });
        if (s.injured) {
          const returnDate = new Date(match.match_date);
          returnDate.setUTCDate(returnDate.getUTCDate() + s.injuryDays);
          await tx.injuries.create({ data: {
            player_id: playerId, injury_type_id: injuryType.id, severity: 'MILD',
            start_season_id: match.season_id, start_season_day: match.season_day,
            days_remaining: s.injuryDays, expected_return_season_day: match.season_day + s.injuryDays,
            start_date: match.match_date, expected_return_date: returnDate, status: 'ACTIVE',
          } });
          await tx.club_news.create({ data: {
            club_id: BigInt(team.id), season_id: match.season_id, news_type: 'INJURY',
            title: `Chấn thương: ${row.player.name}`,
            content: `${row.player.name} chấn thương trong trận ${input.home.name} ${result.homeScore}-${result.awayScore} ${input.away.name}, dự kiến nghỉ ${s.injuryDays} ngày.`,
            published_at: new Date(),
          } });
        }
        let yellowBan = false;
        if (match.season_id && match.competition_season_id && match.match_type !== 'FRIENDLY') {
          const where = { player_id: playerId, club_id: BigInt(team.id), season_id: match.season_id };
          const old = await consolidatePlayerStatistics(tx, where);
          const appearances = (old?.appearances || 0) + 1;
          const yellow = (old?.yellow_cards || 0) + s.yellowCards;
          yellowBan = crossesYellowCardThreshold(yellowBefore.get(playerId) || 0, accumulatedYellowCards(s.yellowCards, s.redCards));
          const totals = {
            appearances, starts: (old?.starts || 0) + (row.player.started ? 1 : 0),
            substitute_appearances: (old?.substitute_appearances || 0) + (row.player.started ? 0 : 1),
            minutes: (old?.minutes || 0) + s.minutes, goals: (old?.goals || 0) + s.goals,
            assists: (old?.assists || 0) + s.assists, clean_sheets: (old?.clean_sheets || 0) + (s.cleanSheet ? 1 : 0),
            yellow_cards: yellow, red_cards: (old?.red_cards || 0) + s.redCards,
            average_rating: ((old ? Number(old.average_rating) * old.appearances : 0) + s.rating) / appearances,
            motm: (old?.motm || 0) + (row.player.id === result.motmPlayerId ? 1 : 0),
          };
          if (old) await tx.player_statistics.update({ where: { id: old.id }, data: totals });
          else await tx.player_statistics.create({ data: { ...where, ...totals } });
        }
        if (match.match_type !== 'FRIENDLY' && (s.redCards || yellowBan)) {
          const bannedMatches = s.redCards && s.yellowCards !== 2 ? 2 : 1;
          const reason = s.redCards ? s.yellowCards === 2 ? 'hai thẻ vàng' : 'thẻ đỏ trực tiếp' : 'tích lũy thẻ vàng';
          await tx.player_suspensions.create({ data: {
            player_id: playerId, competition_season_id: match.competition_season_id, match_id: match.id,
            reason: s.redCards ? s.yellowCards === 2 ? 'SECOND_YELLOW' : 'RED_CARD' : 'YELLOW_ACCUMULATION',
            matches_banned: bannedMatches,
            start_date: match.match_date, status: 'ACTIVE',
          } });
          await tx.club_news.create({ data: {
            club_id: BigInt(team.id), season_id: match.season_id, news_type: 'SUSPENSION',
            title: `Treo giò: ${row.player.name}`,
            content: `${row.player.name} bị treo giò ${bannedMatches} trận do ${reason} sau trận ${input.home.name} ${result.homeScore}-${result.awayScore} ${input.away.name}${match.competition_seasons?.name ? ` tại ${match.competition_seasons.name}` : ''}. Án phạt áp dụng trong phạm vi giải đấu theo quy định kỷ luật.`,
            published_at: new Date(),
          } });
          bansToRefresh.add(playerId);
        }
      }
    }
    for (const playerId of bansToRefresh) {
      const remaining = await tx.player_suspensions.findMany({ where: { player_id: playerId, status: 'ACTIVE' } });
      await tx.player_status.update({ where: { player_id: playerId }, data: { is_suspended: remaining.some(b => b.matches_served < b.matches_banned) } });
    }
    await this.saveStandings(tx, match, input.home.id, input.away.id, result);
    if (match.tie_id) {
      const tie = await tx.knockout_ties.findUnique({ where: { id: match.tie_id } });
      if (!tie || ![tie.home_club_id?.toString(), tie.away_club_id?.toString()].includes(input.home.id) ||
          ![tie.home_club_id?.toString(), tie.away_club_id?.toString()].includes(input.away.id)) throw new Error('Invalid knockout tie participants');
      const sameHome = tie.home_club_id?.toString() === input.home.id;
      await tx.knockout_ties.update({ where: { id: tie.id }, data: {
        home_score: sameHome ? result.aggregateHome : result.aggregateAway,
        away_score: sameHome ? result.aggregateAway : result.aggregateHome,
        winner_club_id: result.winnerClubId ? BigInt(result.winnerClubId) : null,
        status: input.rules.decidingLeg ? 'FINISHED' : 'IN_PROGRESS',
      } });
    }
    const score = `${input.home.name} ${result.homeScore}-${result.awayScore} ${input.away.name}`;
    const details = [
      `${match.competition_seasons?.name || 'Trận đấu'}, ngày ${match.season_day}.`,
      `Kết quả: ${score}.`,
    ];
    if (result.resultType === 'EXTRA_TIME' || result.resultType === 'PENALTIES') {
      details.push(`Sau 90 phút: ${result.homeRegularScore}-${result.awayRegularScore}.`);
    }
    if (result.homePenaltyScore != null && result.awayPenaltyScore != null) {
      details.push(`Luân lưu: ${result.homePenaltyScore}-${result.awayPenaltyScore} (không cộng vào tỷ số trận đấu).`);
    }
    if (input.rules.priorHomeAwayGoals != null) {
      details.push(`Tổng tỷ số hai lượt: ${result.aggregateHome}-${result.aggregateAway}.`);
    }
    for (const side of ['home', 'away'] as const) {
      await tx.club_news.create({ data: {
        club_id: BigInt(input[side].id), season_id: match.season_id, news_type: 'MATCH_RESULT',
        title: `Kết quả trận đấu: ${score}`.slice(0, 255),
        content: details.join(' '), published_at: new Date(),
      } });
    }
  }

  private async saveStandings(tx: Prisma.TransactionClient, match: ResultContext, homeId: string, awayId: string, result: EngineResult) {
    if (!match.stage_id || !['GROUP', 'LEAGUE'].includes(match.competition_stages?.stage_type) || match.match_type === 'FRIENDLY') return;
    await tx.$queryRaw`SELECT id FROM competition_stages WHERE id = ${match.stage_id} FOR UPDATE`;
    for (const [clubId, gf, ga] of [[homeId, result.homeScore, result.awayScore], [awayId, result.awayScore, result.homeScore]] as const) {
      const where = { stage_id: match.stage_id, group_id: match.group_id, club_id: BigInt(clubId) };
      const previous = await tx.stage_standings.findFirst({ where, orderBy: { id: 'asc' } });
      const data = {
        played: (previous?.played || 0) + 1, wins: (previous?.wins || 0) + (gf > ga ? 1 : 0),
        draws: (previous?.draws || 0) + (gf === ga ? 1 : 0), losses: (previous?.losses || 0) + (gf < ga ? 1 : 0),
        goals_for: (previous?.goals_for || 0) + gf, goals_against: (previous?.goals_against || 0) + ga,
        goal_difference: (previous?.goal_difference || 0) + gf - ga,
        points: (previous?.points || 0) + (gf > ga ? 3 : gf === ga ? 1 : 0),
      };
      if (previous) await tx.stage_standings.update({ where: { id: previous.id }, data });
      else await tx.stage_standings.create({ data: { ...where, ...data } });
    }
    const standings = await tx.stage_standings.findMany({
      where: { stage_id: match.stage_id, group_id: match.group_id },
      orderBy: [{ points: 'desc' }, { goal_difference: 'desc' }, { goals_for: 'desc' }, { club_id: 'asc' }],
    });
    for (const [i, row] of standings.entries()) await tx.stage_standings.update({ where: { id: row.id }, data: { position: i + 1 } });
  }
}
