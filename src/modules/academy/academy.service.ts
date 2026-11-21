import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
  Logger, NotFoundException, OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademyProfile, academyRules, generateCandidate } from './academy.rules';

type Tx = Prisma.TransactionClient;
const facilitySelection = {
  where: { facility_types: { code: 'YOUTH_ACADEMY' } },
  select: { facility_levels: { select: { level: true } } },
} satisfies Prisma.clubs$facilitiesArgs;
const candidateInclude = {
  countries: { select: { id: true, name: true, code: true, flag_url: true } },
  positions: { select: { code: true, name: true } },
} satisfies Prisma.youth_intake_candidatesInclude;

@Injectable()
export class AcademyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AcademyService.name);
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      const seasons = await this.prisma.seasons.findMany({ where: { status: 'ACTIVE' } });
      for (const season of seasons) await this.initializeSeason(season.id);
    } catch (error) {
      this.logger.warn(`Không thể khởi tạo học viện. Kiểm tra migration youth-intake-candidates.sql: ${error.message}`);
    }
  }

  /** Snapshot every club, including unclaimed clubs. Profiles are generated once on first recruitment. */
  async initializeSeason(seasonId: bigint) {
    const season = await this.prisma.seasons.findUnique({ where: { id: seasonId } });
    if (!season || season.status !== 'ACTIVE') return;
    const clubs = await this.prisma.clubs.findMany({
      where: { world_id: season.world_id, youth_intakes: { none: { season_id: season.id } } },
      select: { id: true, facilities: facilitySelection },
    });
    for (let offset = 0; offset < clubs.length; offset += 500) {
      await this.prisma.youth_intakes.createMany({
        data: clubs.slice(offset, offset + 500).map(club => {
          const rules = academyRules(club.facilities[0]?.facility_levels.level ?? 1);
          return {
            club_id: club.id, season_id: season.id, intake_date: season.start_date,
            academy_level_snapshot: rules.level, player_count: rules.candidateCount, status: 'PENDING',
          };
        }),
        skipDuplicates: true,
      });
    }
    // Reconcile stale pools as well when restoring a world or restarting the server.
    await this.prisma.youth_intake_candidates.updateMany({
      where: {
        status: 'AVAILABLE',
        youth_intakes: { seasons: { world_id: season.world_id, season_number: { lt: season.season_number } } },
      },
      data: { status: 'EXPIRED' },
    });
  }

  async expireSeason(seasonId: bigint) {
    await this.prisma.youth_intake_candidates.updateMany({
      where: { status: 'AVAILABLE', youth_intakes: { season_id: seasonId } },
      data: { status: 'EXPIRED' },
    });
    await this.prisma.youth_intakes.updateMany({ where: { season_id: seasonId }, data: { status: 'EXPIRED' } });
  }

  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 20000,
        });
      } catch (error) {
        // Retry a deadlock or the club/season unique race without rerolling committed pools.
        if (attempt < 2 && ['P2034', 'P2002'].includes(error.code)) continue;
        throw error;
      }
    }
  }

  private async context(tx: Tx, userId: bigint, clubId: bigint, requireWindow: boolean) {
    await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${clubId} FOR UPDATE`;
    const club = await tx.clubs.findUnique({ where: { id: clubId }, include: { facilities: facilitySelection } });
    if (!club) throw new NotFoundException('Không tìm thấy CLB');
    if (club.owner_user_id !== userId) throw new ForbiddenException('Bạn không quản lý CLB này');
    const initial = await tx.server_timeline.findUnique({ where: { world_id: club.world_id } });
    if (!initial) throw new BadRequestException('Thế giới chưa có mùa giải đang hoạt động');
    // Same season -> timeline order as the day cycle. Recheck after acquiring both locks.
    await tx.$queryRaw`SELECT id FROM seasons WHERE id = ${initial.season_id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM server_timeline WHERE world_id = ${club.world_id} FOR UPDATE`;
    const timeline = await tx.server_timeline.findUnique({ where: { world_id: club.world_id }, include: { seasons: true } });
    if (timeline.season_id !== initial.season_id) throw new ConflictException('Mùa giải vừa thay đổi. Vui lòng tải lại học viện.');
    const season = timeline.seasons;
    if (season.status !== 'ACTIVE' || season.world_id !== club.world_id) {
      throw new BadRequestException('Mùa giải hiện tại đã kết thúc');
    }
    const transferOpen = timeline.is_transfer_window_open && season.is_transfer_window_open;
    if (requireWindow && !transferOpen) throw new BadRequestException('Chỉ được chiêu mộ trong kỳ chuyển nhượng');
    return { club, timeline, season, transferOpen };
  }

  private async ensureIntake(tx: Tx, context: Awaited<ReturnType<AcademyService['context']>>) {
    const { club, season } = context;
    const existing = await tx.youth_intakes.findUnique({ where: { club_id_season_id: { club_id: club.id, season_id: season.id } } });
    if (existing) return existing;
    // Fallback for newly created clubs or a partially completed season initialization.
    const rules = academyRules(club.facilities[0]?.facility_levels.level ?? 1);
    return tx.youth_intakes.create({
      data: {
        club_id: club.id, season_id: season.id, intake_date: season.start_date,
        academy_level_snapshot: rules.level, player_count: rules.candidateCount, status: 'PENDING',
      },
    });
  }

  private async materializePool(tx: Tx, intake: Awaited<ReturnType<AcademyService['ensureIntake']>>, countryId: bigint, seasonNumber: number) {
    if (intake.academy_level_snapshot === null) {
      throw new BadRequestException('Lứa tuyển sinh cũ chưa có dữ liệu ứng viên. Cần chuyển đổi dữ liệu trước khi chiêu mộ.');
    }
    if (intake.status !== 'PENDING') return;
    const count = await tx.youth_intake_candidates.count({ where: { youth_intake_id: intake.id } });
    if (count === 0) {
      const positions = await tx.positions.findMany({ orderBy: { id: 'asc' }, select: { id: true, code: true } });
      if (!positions.length) throw new BadRequestException('Chưa có danh mục vị trí cầu thủ');
      const candidates = Array.from({ length: intake.player_count }, () => {
        const position = positions[Math.floor(Math.random() * positions.length)];
        return {
          ...generateCandidate(intake.academy_level_snapshot, countryId, seasonNumber, position),
          youth_intake_id: intake.id,
        };
      });
      await tx.youth_intake_candidates.createMany({ data: candidates });
    }
    await tx.youth_intakes.update({ where: { id: intake.id }, data: { status: 'ACTIVE' } });
  }

  async getOverview(userId: bigint, clubId: bigint) {
    return this.transaction(async tx => {
      const context = await this.context(tx, userId, clubId, false);
      const intake = await this.ensureIntake(tx, context);
      const available = intake.status === 'PENDING' ? intake.player_count
        : await tx.youth_intake_candidates.count({ where: { youth_intake_id: intake.id, status: 'AVAILABLE' } });
      const roster = await tx.players.findMany({
        where: { current_club_id: clubId, squad_type: { in: ['YOUTH_U19', 'YOUTH_U21'] } },
        include: {
          countries_players_nationality_idTocountries: { select: { id: true, name: true, code: true, flag_url: true } },
          player_positions: { include: { positions: true }, orderBy: { is_preferred: 'desc' } },
        },
        orderBy: [{ ovr: 'desc' }, { id: 'asc' }],
      });
      return {
        season: { id: context.season.id, name: context.season.name, number: context.season.season_number },
        academyLevel: academyRules(context.club.facilities[0]?.facility_levels.level ?? 1).level,
        intakeLevel: intake.academy_level_snapshot,
        rules: intake.academy_level_snapshot === null ? null : academyRules(intake.academy_level_snapshot),
        totalCandidates: intake.player_count,
        remainingCandidates: available,
        transferOpen: context.transferOpen,
        canRecruit: context.transferOpen && intake.academy_level_snapshot !== null && available > 0,
        roster: roster.map(player => ({
          id: player.id, first_name: player.first_name, last_name: player.last_name,
          name: `${player.first_name} ${player.last_name}`,
          age: player.age, ovr: player.ovr, overall_rating: player.ovr,
          potential: player.potential, potential_rating: player.potential,
          nationality: player.countries_players_nationality_idTocountries,
          photo_url: player.photo_url, squad_type: player.squad_type, squad_number: player.squad_number,
          position: player.player_positions[0]?.positions ?? null,
        })),
      };
    });
  }

  private async recruitment(tx: Tx, intakeId: bigint) {
    const candidates = await tx.youth_intake_candidates.findMany({
      where: { youth_intake_id: intakeId, status: 'AVAILABLE' }, include: candidateInclude, orderBy: { id: 'asc' },
    });
    return candidates.map(candidate => {
      const profile = candidate.profile_data as unknown as AcademyProfile;
      return {
        id: candidate.id, first_name: candidate.first_name, last_name: candidate.last_name,
        age: candidate.age, ovr: candidate.ovr, potential: candidate.potential,
        nationality: candidate.countries, position: candidate.positions,
        photo_url: profile.photo_url, weeklyWage: profile.weekly_wage,
        contractSeasons: 3,
      };
    });
  }

  async getRecruitment(userId: bigint, clubId: bigint) {
    return this.transaction(async tx => {
      const context = await this.context(tx, userId, clubId, true);
      const intake = await this.ensureIntake(tx, context);
      await this.materializePool(tx, intake, context.club.country_id, context.season.season_number);
      return { seasonId: context.season.id, candidates: await this.recruitment(tx, intake.id) };
    });
  }

  async signCandidate(userId: bigint, clubId: bigint, candidateId: bigint) {
    return this.transaction(async tx => {
      const context = await this.context(tx, userId, clubId, true);
      const candidate = await tx.youth_intake_candidates.findFirst({
        where: { id: candidateId, youth_intakes: { club_id: clubId, season_id: context.season.id } },
      });
      if (!candidate) throw new NotFoundException('Ứng viên không thuộc lứa hiện tại của CLB');
      if (candidate.status !== 'AVAILABLE') throw new ConflictException('Ứng viên đã ký hợp đồng hoặc đã hết hạn');
      const claim = await tx.youth_intake_candidates.updateMany({
        where: { id: candidate.id, status: 'AVAILABLE', signed_player_id: null }, data: { status: 'SIGNED' },
      });
      if (claim.count !== 1) throw new ConflictException('Ứng viên vừa được ký hợp đồng');
      const profile = candidate.profile_data as unknown as AcademyProfile;
      if (profile?.version !== 1 || !profile.attributes || !profile.mentality || !profile.tactics) {
        throw new BadRequestException('Hồ sơ ứng viên không hợp lệ');
      }
      const currency = await tx.currencies.findFirst({ where: { type: 'SOFT', is_active: true }, orderBy: { id: 'asc' } });
      if (!currency) throw new BadRequestException('Chưa cấu hình tiền tệ CASH');
      const numbers = await tx.players.findMany({
        where: { current_club_id: clubId, squad_type: { in: ['YOUTH_U19', 'YOUTH_U21'] } }, select: { squad_number: true },
      });
      const used = new Set(numbers.map(player => player.squad_number));
      let squadNumber = 1;
      while (used.has(squadNumber)) squadNumber++;
      const startDate = context.timeline.real_date;
      const endDate = new Date(context.season.start_date);
      endDate.setUTCDate(endDate.getUTCDate() + context.season.total_days * 3 - 1);
      const player = await tx.players.create({
        data: {
          world_id: context.club.world_id, nationality_id: candidate.nationality_id,
          first_name: candidate.first_name, last_name: candidate.last_name, age: candidate.age,
          ovr: candidate.ovr, potential: candidate.potential,
          current_club_id: clubId, trained_club_id: clubId, squad_type: 'YOUTH_U21', squad_number: squadNumber,
          youth_intake_id: candidate.youth_intake_id,
          birth_season: profile.birth_season, birth_season_day: profile.birth_season_day,
          preferred_foot: profile.preferred_foot, height: profile.height, weight: profile.weight,
          photo_url: profile.photo_url, market_value: profile.market_value,
          player_attributes: { create: profile.attributes },
          player_mentality: { create: profile.mentality },
          player_tactics: { create: profile.tactics },
          player_positions: { create: { position_id: candidate.primary_position_id, ability: 100, is_preferred: true } },
          player_status: { create: { fitness: 100, condition: 100, morale: 70, happiness: 70, match_sharpness: 50, form: 50 } },
          player_contracts: { create: {
            club_id: clubId, start_date: startDate, end_date: endDate,
            // Legacy column names are *_season_id, but academy contracts persist season numbers.
            start_season_id: BigInt(context.season.season_number), start_season_day: context.timeline.season_day,
            end_season_id: BigInt(context.season.season_number + 2), end_season_day: context.season.total_days,
            salary: profile.weekly_wage, salary_currency_id: currency.id, squad_role: 'ACADEMY', status: 'ACTIVE',
          } },
          player_statistics: { create: { club_id: clubId, season_id: context.season.id } },
        },
      });
      await tx.youth_intake_candidates.update({
        where: { id: candidate.id }, data: { signed_player_id: player.id, signed_at: new Date() },
      });
      await tx.club_news.create({ data: {
        club_id: clubId, season_id: context.season.id, news_type: 'YOUTH_INTAKE',
        title: `Học viện ký hợp đồng với ${candidate.first_name} ${candidate.last_name}`,
        content: `Cầu thủ ${candidate.age} tuổi gia nhập đội trẻ U21 từ lứa tuyển sinh mùa ${context.season.season_number}.`,
        thumbnail_url: profile.photo_url, published_at: new Date(),
      } });
      return {
        playerId: player.id,
        remainingCandidates: await tx.youth_intake_candidates.count({ where: { youth_intake_id: candidate.youth_intake_id, status: 'AVAILABLE' } }),
      };
    });
  }
}
