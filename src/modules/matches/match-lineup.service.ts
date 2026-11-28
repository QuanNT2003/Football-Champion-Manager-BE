import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { coachTacticDefaults, PreparedPosition, SavedPosition, selectMatchLineup } from './match-lineup.rules';
import { banAppliesToMatch, DisciplineMatch, suspensionCompetition } from '../players/discipline-scope';
import { squadAgeLimit, squadPlayerWhere } from '../players/squad-eligibility';

interface LineupMatch extends DisciplineMatch {
  id: bigint;
  home_club_id: bigint | null;
  away_club_id: bigint | null;
  competition_season_id?: bigint | null;
  match_type?: string;
  competition_seasons: { name?: string; season_id?: bigint; country_id?: bigint | null;
    competitions: { is_youth: boolean; age_limit: number | null; participant_type: string; competition_type?: string; country_id?: bigint | null } } | null;
}

const formationInclude = {
  formation_positions: { include: { positions: true }, orderBy: [{ order_no: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.formationsInclude;
const tacticPositionsInclude = { tactic_position_instructions: { include: { tactical_instructions: true } } } satisfies Prisma.club_tactic_positionsInclude;

@Injectable()
export class MatchLineupService {
  /** Caller holds the match lock; both teams and the result share its transaction. */
  async prepareMatchLineups(tx: Prisma.TransactionClient, match: LineupMatch) {
    const competition = match.competition_seasons?.competitions;
    if (!match.home_club_id || !match.away_club_id || competition?.participant_type === 'NATIONAL_TEAM') {
      throw new BadRequestException('Chuẩn bị đội hình hiện chỉ hỗ trợ trận giữa hai CLB');
    }
    const ageLimit = competition?.is_youth ? competition.age_limit : null;
    if (competition?.is_youth && ageLimit !== 19 && ageLimit !== 21) {
      throw new BadRequestException('Giải trẻ chưa có giới hạn tuổi U19/U21 hợp lệ');
    }
    const squadType = ageLimit === 19 ? 'YOUTH_U19' : ageLimit === 21 ? 'YOUTH_U21' : 'FIRST_TEAM';
    // Stable lock order also covers concurrent fixtures with reversed home/away.
    const clubIds = [match.home_club_id, match.away_club_id].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const clubId of clubIds) await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${clubId} FOR UPDATE`;
    const home = await this.prepareClubLineup(tx, match, match.home_club_id, squadType);
    const away = await this.prepareClubLineup(tx, match, match.away_club_id, squadType);
    return { home, away };
  }

  private async prepareClubLineup(
    tx: Prisma.TransactionClient, match: LineupMatch, clubId: bigint,
    squadType: 'FIRST_TEAM' | 'YOUTH_U19' | 'YOUTH_U21',
  ) {
    const matchId = match.id;
    const ageLimit = squadAgeLimit(squadType);
    const existing = await tx.match_lineups.findFirst({
      where: { match_id: matchId, club_id: clubId }, orderBy: { id: 'asc' },
      include: { formations: { include: formationInclude }, match_players: { orderBy: { id: 'asc' } } },
    });
    let tactic = await tx.club_tactics.findFirst({
      where: { club_id: clubId, squad_type: squadType }, orderBy: { id: 'asc' },
      include: { formations: { include: formationInclude }, club_tactic_positions: { include: tacticPositionsInclude, orderBy: [{ order_no: 'asc' }, { id: 'asc' }] } },
    });
    let formation = existing?.formations || tactic?.formations;
    let defaults = coachTacticDefaults();
    if (!formation) {
      const contracts = await tx.staff_contracts.findMany({
        where: { club_id: clubId, status: 'ACTIVE', role: { in: ['HEAD_COACH', 'HEAD_COACH_YOUTH'] } },
        include: { staff: true }, orderBy: { id: 'asc' },
      });
      const coach = (squadType !== 'FIRST_TEAM'
        ? contracts.find(c => c.role === 'HEAD_COACH_YOUTH' && c.squad_type === squadType) ||
          contracts.find(c => c.role === 'HEAD_COACH_YOUTH')
        : null) || contracts.find(c => c.role === 'HEAD_COACH' && c.squad_type === 'FIRST_TEAM');
      defaults = coachTacticDefaults(coach?.staff.tactical_style);
      for (const formationId of [coach?.staff.preferred_formation_id, coach?.staff.secondary_formation_id]) {
        if (!formationId) continue;
        const preferred = await tx.formations.findUnique({ where: { id: formationId }, include: formationInclude });
        if (preferred?.formation_positions.length === 11) { formation = preferred; break; }
      }
      formation ||= await tx.formations.findFirst({ include: formationInclude, orderBy: { id: 'asc' } });
    }
    if (!formation) throw new BadRequestException('Chưa có sơ đồ chiến thuật để tạo đội hình');

    const players = await tx.players.findMany({
      where: {
        current_club_id: clubId,
        ...squadPlayerWhere(squadType),
        ...(ageLimit ? { age: { lte: ageLimit } } : {}),
      },
      include: {
        player_status: true, player_positions: { include: { positions: true } },
        player_attributes: true, player_mentality: true, player_tactics: true,
        player_suspensions: { where: { status: 'ACTIVE' }, include: { competition_seasons: suspensionCompetition } },
        injuries: { where: { status: { in: ['ACTIVE', 'RECOVERING'] }, days_remaining: { gt: 0 } } },
      },
    });
    const saved: SavedPosition[] = existing
      ? existing.match_players.map((p, index) => ({
          ...p, lineup_role: p.started ? 'STARTING' : 'SUBSTITUTE',
          order_no: p.started ? index + 1 : existing.match_players.filter(m => !m.started).indexOf(p) + 1,
        }))
      : tactic?.club_tactic_positions || [];
    const eligiblePlayers = players.map(p => {
      const tracked = p.player_suspensions || [];
      const suspended = tracked.length ? tracked.some(b => banAppliesToMatch(b, match)) : match.match_type !== 'FRIENDLY' && p.player_status?.is_suspended;
      return { ...p, player_status: p.player_status ? { ...p.player_status, is_suspended: suspended } : null };
    });
    const positions = selectMatchLineup(formation.formation_positions, eligiblePlayers, saved);

    if (!existing) {
      if (!tactic) {
        const created = await tx.club_tactics.create({
          data: { club_id: clubId, squad_type: squadType, name: squadType === 'FIRST_TEAM' ? 'Đội hình chính' : `Đội hình ${squadType}`, formation_id: formation.id, ...defaults },
          include: { formations: { include: formationInclude }, club_tactic_positions: { include: tacticPositionsInclude } },
        });
        tactic = created;
      }
      await this.saveClubPositions(tx, tactic.id, tactic.club_tactic_positions, positions);
    }

    const snapshot: Prisma.InputJsonObject = {
      ...(existing?.tactics_snapshot && typeof existing.tactics_snapshot === 'object' && !Array.isArray(existing.tactics_snapshot)
        ? existing.tactics_snapshot as Prisma.InputJsonObject
        : tactic ? {
            mentality: tactic.mentality, tempo: tactic.tempo, passing_style: tactic.passing_style,
            pressing_intensity: tactic.pressing_intensity, defensive_line: tactic.defensive_line,
          } : defaults),
      squad_type: squadType,
      formation_id: formation.id.toString(),
      formation_code: formation.code,
      ...(!existing ? { position_instructions: Object.fromEntries((tactic?.club_tactic_positions || []).filter(p => p.formation_position_id).map(p => [
        p.formation_position_id.toString(), (p.tactic_position_instructions || []).filter(i => i.value !== 0).map(i => i.tactical_instructions.code),
      ])) } : {}),
    };
    const lineup = existing
      ? await tx.match_lineups.update({ where: { id: existing.id }, data: { tactics_snapshot: snapshot } })
      : await tx.match_lineups.create({ data: {
          match_id: matchId, club_id: clubId, club_tactic_id: tactic.id,
          formation_id: formation.id, tactics_snapshot: snapshot,
        } });
    await tx.match_players.deleteMany({ where: { lineup_id: lineup.id } });
    await tx.match_players.createMany({ data: positions.filter(p => p.player).map(p => ({
      match_id: matchId, lineup_id: lineup.id, player_id: p.player.id,
      formation_position_id: p.slot?.id || null, started: p.lineup_role === 'STARTING',
      role: p.role, duty: p.duty, position_code: p.slot?.positions.code || null,
      shirt_number: p.player.squad_number,
      is_captain: existing?.match_players.some(previous => previous.player_id === p.player.id && previous.is_captain) || false,
    })) });
    return {
      lineupId: lineup.id,
      positions,
      tactic: snapshot,
      squadType,
      rosterPlayerIds: players.map(p => p.id),
      captainPlayerIds: (existing?.match_players || []).filter(p => p.is_captain).map(p => p.player_id),
      starters: positions.filter(p => p.lineup_role === 'STARTING').map(p => p.player),
      outfieldPlayers: positions.filter(p => p.lineup_role === 'STARTING' && p.slot.positions.code !== 'GK').map(p => p.player),
      substitutes: positions.filter(p => p.lineup_role === 'SUBSTITUTE' && p.player).map(p => p.player),
    };
  }

  private async saveClubPositions(
    tx: Prisma.TransactionClient, tacticId: bigint,
    saved: (SavedPosition & { id: bigint })[], positions: PreparedPosition[],
  ) {
    const kept = new Set<bigint>();
    const additions: Prisma.club_tactic_positionsCreateManyInput[] = [];
    for (const position of positions) {
      const previous = saved.find(p => !kept.has(p.id) && p.lineup_role === position.lineup_role &&
        (position.slot ? p.formation_position_id === position.slot.id : p.order_no === position.order_no));
      const data = {
        tactic_id: tacticId, formation_position_id: position.slot?.id || null,
        player_id: position.player?.id || null, role: position.role, duty: position.duty,
        lineup_role: position.lineup_role, order_no: position.order_no,
      };
      if (previous) {
        kept.add(previous.id);
        if (previous.player_id !== data.player_id || previous.role !== data.role || previous.duty !== data.duty ||
            previous.order_no !== data.order_no || previous.formation_position_id !== data.formation_position_id) {
          await tx.club_tactic_positions.update({ where: { id: previous.id }, data });
        }
      } else {
        additions.push(data);
      }
    }
    if (additions.length) await tx.club_tactic_positions.createMany({ data: additions });
    const removed = saved.filter(p => p.lineup_role !== 'RESERVE' && !kept.has(p.id)).map(p => p.id);
    if (removed.length) await tx.club_tactic_positions.deleteMany({ where: { id: { in: removed } } });
  }
}
