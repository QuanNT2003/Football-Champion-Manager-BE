import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateDynamicOvr } from '../players/players.service';
import { ScheduleTrainingDto } from './dto';
import {
  agePenalty, categoryCoachAttribute, coachTrainingSquad, drillAttributes, DRILL_GAIN_WEIGHTS, FITNESS_PER_DRILL, groupCoaches,
  recommendation, recommendedStyle, rollDrill, TRAINING_COST, TRAINING_SLOTS,
  trainingChance, trainingMentality, TrainingSquad,
} from './training.rules';

type Db = Prisma.TransactionClient;
const playerInclude = {
  player_attributes: true, player_status: true,
} as const;
const trainingPlayerInclude = {
  ...playerInclude,
  player_mentality: { select: { professionalism: true, determination: true, ambition: true, complacency: true } },
  player_positions: {
    orderBy: { position_id: 'asc' as const },
    include: { positions: { include: {
      position_attributes: { include: { attributes: { select: { code: true } } } },
    } } },
  },
} as const;

const jsonObject = (value: Prisma.JsonValue): Prisma.JsonObject | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const jsonObjects = (value: Prisma.JsonValue | undefined): Prisma.JsonObject[] =>
  Array.isArray(value) ? value.map(jsonObject).filter((item): item is Prisma.JsonObject => !!item) : [];

/** Keep formula inputs and probability snapshots in storage, outside the player API. */
function publicSession<T extends { plan: Prisma.JsonValue; results: Prisma.JsonValue }>(session: T) {
  const plan = jsonObject(session.plan);
  const results = jsonObject(session.results);
  return {
    ...session,
    plan: plan ? {
      squadType: plan.squadType, level: plan.level,
      drills: jsonObjects(plan.drills).map(drill => ({
        slot: drill.slot, id: drill.id, code: drill.code, name: drill.name,
        category: drill.category, attributes: drill.attributes,
      })),
    } : null,
    results: results ? {
      completedAt: results.completedAt,
      players: jsonObjects(results.players).map(player => ({
        id: player.id, name: player.name, fitnessBefore: player.fitnessBefore, fitnessAfter: player.fitnessAfter,
        drills: jsonObjects(player.drills).map(drill => ({
          slot: drill.slot, code: drill.code,
          gains: jsonObjects(drill.gains).map(gain => ({ attribute: gain.attribute, from: gain.from, to: gain.to })),
        })),
      })),
    } : null,
  };
}

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedClub(db: Db, userId: bigint, clubId: bigint) {
    const club = await db.clubs.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Không tìm thấy CLB');
    if (club.owner_user_id !== userId) throw new ForbiddenException('Bạn không quản lý CLB này');
    return club;
  }

  private async types(db: Db) {
    const types = await db.training_types.findMany({
      where: { code: { in: Object.keys(drillAttributes) } }, orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
    return types.filter(type => type.code in drillAttributes && type.category in categoryCoachAttribute)
      .map(type => ({ ...type, attributes: [...drillAttributes[type.code]] as string[], fitnessCost: FITNESS_PER_DRILL }));
  }

  getTrainingTypes() { return this.types(this.prisma); }

  private squadFilter(squadType: string): Prisma.playersWhereInput {
    if (squadType !== 'FIRST_TEAM' && squadType !== 'YOUTH') throw new BadRequestException('Đội tập luyện không hợp lệ');
    return { squad_type: { in: squadType === 'FIRST_TEAM' ? ['FIRST_TEAM'] : ['YOUTH_U19', 'YOUTH_U21'] } };
  }

  private async environment(db: Db, clubId: bigint, squadType: TrainingSquad) {
    const [facility, contracts, tactic] = await Promise.all([
      db.facilities.findFirst({
        where: { club_id: clubId, facility_types: { code: 'TRAINING_GROUND' } }, include: { facility_levels: true },
      }),
      db.staff_contracts.findMany({
        where: { club_id: clubId, status: 'ACTIVE', staff: { staff_type: 'COACH' } },
        include: { staff: { include: { staff_attributes: true } } }, orderBy: { id: 'asc' },
      }),
      db.club_tactics.findFirst({
        where: { club_id: clubId, squad_type: { in: squadType === 'FIRST_TEAM' ? ['FIRST_TEAM'] : ['YOUTH_U19', 'YOUTH_U21'] } },
        orderBy: [{ squad_type: 'desc' }, { id: 'desc' }],
      }),
    ]);
    const level = Math.max(1, facility?.facility_levels.level ?? 1);
    const teamContracts = contracts.filter(contract => coachTrainingSquad(contract) === squadType);
    const head = teamContracts.find(contract => contract.role === (squadType === 'YOUTH' ? 'HEAD_COACH_YOUTH' : 'HEAD_COACH'))
      ?? teamContracts.find(contract => contract.role === 'HEAD_COACH');
    return {
      level, levelBonus: (level - 1) * 5, coaches: groupCoaches(teamContracts, squadType),
      headCoach: head ? { id: head.staff_id.toString(), name: head.staff.name } : null,
      style: recommendedStyle(tactic, head?.staff.tactical_style),
    };
  }

  async getOverview(userId: bigint, clubId: bigint, squadType: string = 'FIRST_TEAM') {
    const squadFilter = this.squadFilter(squadType);
    await this.ownedClub(this.prisma, userId, clubId);
    const [environment, types, players] = await Promise.all([
      this.environment(this.prisma, clubId, squadType as TrainingSquad), this.types(this.prisma),
      this.prisma.players.findMany({ where: { current_club_id: clubId, ...squadFilter }, include: playerInclude, orderBy: { id: 'asc' } }),
    ]);
    return {
      squadType, slots: TRAINING_SLOTS, fitnessPerDrill: FITNESS_PER_DRILL, fitnessCost: TRAINING_COST,
      level: environment.level, headCoach: environment.headCoach, types,
      recommendation: { style: environment.style, headCoach: environment.headCoach, trainingTypeIds: recommendation(environment.style, types) },
      players: players.map(player => {
        const fitness = player.player_status?.fitness ?? 0;
        return {
          id: player.id.toString(), name: `${player.first_name} ${player.last_name}`.trim(),
          age: player.age, squadType: player.squad_type, fitness,
          eligible: !!player.player_attributes && !!player.player_status && fitness >= TRAINING_COST
            && !player.player_status.is_injured && !player.player_status.is_on_national_duty,
          isInjured: player.player_status?.is_injured ?? false,
          onNationalDuty: player.player_status?.is_on_national_duty ?? false,
        };
      }),
    };
  }

  async getClubSessions(userId: bigint, clubId: bigint) {
    await this.ownedClub(this.prisma, userId, clubId);
    const sessions = await this.prisma.training_sessions.findMany({
      where: { club_id: clubId }, include: { training_types: true }, orderBy: { id: 'desc' }, take: 20,
    });
    return sessions.map(publicSession);
  }

  async scheduleSession(userId: bigint, clubId: bigint, dto: ScheduleTrainingDto) {
    const squadFilter = this.squadFilter(dto.squadType);
    // Validate here too: direct service callers must obey the same six-slot contract.
    if (!Array.isArray(dto.trainingTypeIds) || dto.trainingTypeIds.length !== TRAINING_SLOTS
      || !Array.isArray(dto.playerIds) || !dto.playerIds.length || dto.playerIds.length > 200
      || new Set(dto.playerIds).size !== dto.playerIds.length
      || [...dto.trainingTypeIds, ...dto.playerIds].some(id => typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id))) {
      throw new BadRequestException('Chọn đúng 6 bài tập và ít nhất 1 cầu thủ, không lặp cầu thủ');
    }
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${clubId} FOR UPDATE`;
      const club = await this.ownedClub(tx, userId, clubId);
      const initial = await tx.server_timeline.findUnique({ where: { world_id: club.world_id } });
      if (!initial) throw new BadRequestException('Thế giới chưa có mùa giải đang hoạt động');
      await tx.$queryRaw`SELECT id FROM seasons WHERE id = ${initial.season_id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM server_timeline WHERE world_id = ${club.world_id} FOR UPDATE`;
      const timeline = await tx.server_timeline.findUnique({ where: { world_id: club.world_id }, include: { seasons: true } });
      if (timeline.season_id !== initial.season_id) throw new ConflictException('Mùa giải vừa thay đổi. Vui lòng tải lại.');
      if (timeline.seasons.status !== 'ACTIVE' || timeline.seasons.world_id !== club.world_id) {
        throw new BadRequestException('Mùa giải hiện tại đã kết thúc');
      }
      // Serialize fitness and attribute changes, including overlapping selections.
      await tx.$queryRaw`SELECT id FROM players WHERE current_club_id = ${clubId} ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT ps.player_id FROM player_status ps JOIN players p ON p.id = ps.player_id WHERE p.current_club_id = ${clubId} ORDER BY ps.player_id FOR UPDATE`;
      await tx.$queryRaw`SELECT pa.player_id FROM player_attributes pa JOIN players p ON p.id = pa.player_id WHERE p.current_club_id = ${clubId} ORDER BY pa.player_id FOR UPDATE`;
      const [environment, types, players] = await Promise.all([
        this.environment(tx, clubId, dto.squadType), this.types(tx),
        tx.players.findMany({
          where: { id: { in: dto.playerIds.map(id => BigInt(id)) }, current_club_id: clubId, ...squadFilter },
          include: trainingPlayerInclude, orderBy: { id: 'asc' },
        }),
      ]);
      if (players.length !== dto.playerIds.length) throw new BadRequestException('Cầu thủ phải thuộc CLB và đúng đội đang tập');
      const orderedTypes = dto.trainingTypeIds.map(id => types.find(type => type.id.toString() === id));
      if (orderedTypes.some(type => !type)) throw new BadRequestException('Bài tập không tồn tại hoặc chưa có cấu hình chỉ số');
      for (const player of players) {
        if (!player.player_attributes || !player.player_status) throw new BadRequestException('Cầu thủ thiếu dữ liệu chỉ số hoặc thể lực');
        if (player.player_status.fitness < TRAINING_COST) throw new BadRequestException('Cầu thủ cần ít nhất 12% thể lực để hoàn thành 6 bài');
        if (player.player_status.is_injured || player.player_status.is_on_national_duty) {
          throw new BadRequestException('Cầu thủ chấn thương hoặc đang lên tuyển không thể tham gia tập luyện');
        }
      }
      const attributeCatalog = await tx.attributes.findMany();
      const attributeIds = new Map(attributeCatalog.map(attribute => [attribute.code.toLowerCase(), attribute.id]));
      const plan = orderedTypes.map((type, index) => ({
        slot: index + 1, id: type.id.toString(), code: type.code, name: type.name, category: type.category,
        attributes: type.attributes, coach: environment.coaches[type.category],
      }));
      if (plan.some(drill => drill.attributes.some(key => !attributeIds.has(key)))) {
        throw new BadRequestException('Danh mục chỉ số chưa đầy đủ cho các bài tập đã chọn');
      }
      const session = await tx.training_sessions.create({
        data: {
          club_id: clubId, training_type_id: orderedTypes[0].id,
          season_id: timeline.season_id, season_day: timeline.season_day,
          session_date: new Date(), intensity: 0, status: 'COMPLETED',
          coach_staff_id: environment.headCoach ? BigInt(environment.headCoach.id) : null,
          plan: {
            squadType: dto.squadType, level: environment.level, levelBonus: environment.levelBonus, drills: plan,
            chanceScope: 'DRILL', gainCountWeights: [...DRILL_GAIN_WEIGHTS],
            chanceFormula: 'MENTALITY_V3',
          },
        },
      });
      const results = [];
      for (const player of players) {
        const attributes = { ...player.player_attributes };
        const position = player.player_positions.find(p => p.is_preferred) || player.player_positions[0];
        const weights = position?.positions.position_attributes ?? [];
        let ovr = Math.max(player.ovr, calculateDynamicOvr(attributes, weights));
        const penalty = agePenalty(player.age, player.squad_type);
        const mentality = trainingMentality(player.age, player.player_mentality);
        const drills = plan.map(drill => {
          const chance = trainingChance(environment.level, drill.coach.skill, penalty, mentality.totalBonus);
          const gains: ReturnType<typeof rollDrill> = [];
          if (ovr < player.potential) {
            // Roll on a copy, then accept individual gains only while below the potential ceiling.
            const proposed = rollDrill({ ...attributes }, drillAttributes[drill.code], chance);
            for (const gain of proposed) {
              if (ovr >= player.potential) break;
              const nextOvr = calculateDynamicOvr({ ...attributes, [gain.attribute]: gain.to }, weights);
              if (nextOvr > player.potential) continue;
              attributes[gain.attribute] = gain.to;
              ovr = nextOvr;
              gains.push(gain);
            }
          }
          return { slot: drill.slot, code: drill.code, chance, gains };
        });
        const gains = drills.flatMap(drill => drill.gains);
        const data = Object.fromEntries([...new Set(gains.map(gain => gain.attribute))].map(key => [key, attributes[key]]));
        if (gains.length) {
          await tx.player_attributes.update({ where: { player_id: player.id }, data });
          await tx.players.update({ where: { id: player.id }, data: { ovr } });
          await tx.player_attribute_history.createMany({ data: drills.flatMap(drill => drill.gains.map(gain => ({
            player_id: player.id, attribute_id: attributeIds.get(gain.attribute), old_value: gain.from, new_value: gain.to,
            reason: `TRAINING:${session.id}:SLOT:${drill.slot}:${drill.code}`,
          }))) });
        }
        const fitnessBefore = player.player_status.fitness;
        await tx.player_status.update({
          where: { player_id: player.id }, data: { fitness: { decrement: TRAINING_COST }, updated_at: new Date() },
        });
        await tx.player_training.create({ data: {
          training_session_id: session.id, player_id: player.id, participation: 100,
          performance: gains.length, fatigue_gained: TRAINING_COST, injury_risk: 0,
        } });
        results.push({
          id: player.id.toString(), name: `${player.first_name} ${player.last_name}`.trim(),
          age: player.age, agePenalty: penalty, mentality,
          potential: player.potential, ovrBefore: player.ovr, ovrAfter: gains.length ? ovr : player.ovr,
          fitnessBefore, fitnessAfter: fitnessBefore - TRAINING_COST, drills,
        });
      }
      const saved = await tx.training_sessions.update({
        where: { id: session.id }, data: { results: { completedAt: new Date().toISOString(), players: results } },
      });
      return { message: 'Đã hoàn thành 6 bài tập', session: publicSession(saved) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 });
  }
}
