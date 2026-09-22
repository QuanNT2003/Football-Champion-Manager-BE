import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { CompetitionsService } from '../competitions/competitions.service';

@Injectable()
export class GameWorldService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GameWorldService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly competitionsService: CompetitionsService,
  ) {}

  /**
   * Tự động kiểm tra khi server khởi động:
   * Nếu đang ở Day 1 của Mùa giải mà chưa có lịch thi đấu, tự động sinh lịch ngay lập tức!
   */
  async onApplicationBootstrap() {
    this.logger.log('GameWorldService: Kiểm tra trạng thái tự động hóa Day 1...');
    await this.checkAndTriggerDay1AutoGeneration(1n);
  }

  /**
   * Cron Job tự động chạy mỗi nửa đêm: Tiến 1 ngày trong game
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAutomaticMidnightCycle() {
    this.logger.log('Online Game Server: Tự động chạy chu kỳ chuyển ngày nửa đêm (Midnight Cycle)...');
    await this.advanceDay(1n);
  }

  /**
   * Hàm kiểm tra và tự động sinh giải đấu + lịch thi đấu khi phát hiện Day 1
   */
  async checkAndTriggerDay1AutoGeneration(worldId: bigint = 1n) {
    try {
      const activeSeason = await this.prisma.seasons.findFirst({
        where: { world_id: worldId, status: 'ACTIVE' },
        orderBy: { season_number: 'desc' },
      });

      if (!activeSeason) return;

      // Nếu đang ở Day 1
      if (activeSeason.current_day === 1) {
        const compSeasonCount = await this.prisma.competition_seasons.count({
          where: { season_id: activeSeason.id },
        });

        const matchCount = await this.prisma.matches.count({
          where: { season_id: activeSeason.id },
        });

        if (compSeasonCount === 0) {
          this.logger.log(
            `🚀 [AUTO DAY 1] Phát hiện Mùa ${activeSeason.season_number} đang ở Day 1 nhưng chưa khởi tạo giải đấu. Bắt đầu tự động tạo toàn bộ giải đấu và sinh Fixtures...`,
          );

          const result = await this.competitionsService.initializeNewSeason({
            worldId: activeSeason.world_id.toString(),
            seasonNumber: activeSeason.season_number,
            autoGenerateFixtures: true,
          });

          this.logger.log(`🎉 [AUTO DAY 1 THÀNH CÔNG] ${result.message}`);
        } else if (matchCount === 0) {
          this.logger.log(
            `🚀 [AUTO DAY 1] Phát hiện Mùa ${activeSeason.season_number} đã có giải đấu nhưng chưa có lịch thi đấu. Bắt đầu sinh Fixtures...`,
          );

          const result = await this.competitionsService.generateSeasonFixtures({
            seasonId: activeSeason.id.toString(),
          });

          this.logger.log(`🎉 [AUTO DAY 1 THÀNH CÔNG] ${result.message}`);
        } else {
          this.logger.log(
            `ℹ️ [DAY 1 INFO] Mùa ${activeSeason.season_number} Day 1 đã sẵn sàng: ${compSeasonCount} giải đấu và ${matchCount} trận đấu được lên lịch.`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Lỗi khi tự động kích hoạt sinh lịch đấu Day 1:', err);
    }
  }

  async getWorlds() {
    return this.prisma.game_worlds.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getCurrentTimeline(worldId: bigint = 1n) {
    const world = await this.prisma.game_worlds.findUnique({
      where: { id: worldId },
    });

    const activeSeason = await this.prisma.seasons.findFirst({
      where: { world_id: worldId, status: 'ACTIVE' },
      orderBy: { season_number: 'desc' },
    });

    const timeline = await this.prisma.server_timeline.findFirst({
      where: { world_id: worldId },
      orderBy: { id: 'desc' },
    });

    return {
      world,
      season: activeSeason
        ? {
            id: activeSeason.id.toString(),
            name: activeSeason.name,
            season_number: activeSeason.season_number,
            current_day: activeSeason.current_day,
            total_days: activeSeason.total_days,
            is_transfer_window_open: Boolean(activeSeason.is_transfer_window_open),
            status: activeSeason.status,
          }
        : null,
      timeline,
    };
  }

  /**
   * Tiến ngày trong mùa giải (Day 1 -> Day 40)
   * Khi hết Day 40 -> Tự động sang Season mới, Day 1 và tự động tạo giải đấu + lịch đấu!
   */
  async advanceDay(worldId: bigint = 1n) {
    const season = await this.prisma.seasons.findFirst({
      where: { world_id: worldId, status: 'ACTIVE' },
    });

    if (!season) {
      return { message: 'Không có mùa giải đang hoạt động' };
    }

    const nextDay = season.current_day + 1;
    let seasonCompleted = false;
    let newSeasonData: any = null;

    if (nextDay > season.total_days) {
      seasonCompleted = true;
      const nextSeasonNumber = season.season_number + 1;
      this.logger.log(
        `🏁 Mùa ${season.season_number} đã kết thúc ${season.total_days} ngày! Bắt đầu chuyển giao sang Mùa ${nextSeasonNumber} Day 1...`,
      );

      // 1. Chuyển giao mùa giải toàn diện:
      // - Quét BXH thăng / xuống hạng Tier 1 -> 5
      // - Phân bổ suất Cúp C1 / C2 Châu Lục
      // - Tăng tuổi cầu thủ (+1 tuổi) & reset án phạt
      // - Khởi tạo Mùa giải mới & sinh lịch thi đấu Day 1
      const transitionResult = await this.competitionsService.processSeasonTransition({
        worldId: worldId.toString(),
        completedSeasonId: season.id.toString(),
        newSeasonNumber: nextSeasonNumber,
        agePlayers: true,
        initializeNewSeason: true,
      });

      newSeasonData = transitionResult.nextSeason;
      this.logger.log(`🎉 [CHUYỂN GIAO MÙA THÀNH CÔNG] ${transitionResult.summary}`);
    } else {
      // Tiếp tục ngày tiếp theo trong mùa hiện tại
      await this.prisma.seasons.update({
        where: { id: season.id },
        data: { current_day: nextDay },
      });

      await this.prisma.$executeRaw`
        UPDATE server_timeline 
        SET season_day = ${nextDay},
            world_day = world_day + 1,
            real_date = DATE_ADD(real_date, INTERVAL 1 DAY),
            updated_at = NOW()
        WHERE world_id = ${worldId}
      `;

      // Tự động kiểm tra và tiến vòng Knockout Cúp Quốc Gia & Cúp Châu Lục cho ngày mới
      try {
        const progressRes = await this.competitionsService.progressKnockoutStages(season.id, nextDay);
        if (progressRes.progressedCount > 0) {
          this.logger.log(`🏆 [KNOCKOUT PROGRESS] Ngày ${nextDay}: Đã tự động sinh thêm ${progressRes.progressedCount} trận đấu Knockout cho các Cúp.`);
        }
      } catch (err) {
        this.logger.error(`Lỗi khi tiến vòng Knockout Ngày ${nextDay}:`, err);
      }
    }

    // Các tác vụ hồi phục & tài chính hàng ngày:
    await this.prisma.$executeRaw`
      UPDATE injuries 
      SET days_remaining = GREATEST(0, days_remaining - 1)
      WHERE days_remaining > 0
    `;

    await this.prisma.$executeRaw`
      UPDATE player_status ps
      JOIN injuries inj ON ps.player_id = inj.player_id
      SET ps.is_injured = 0
      WHERE inj.days_remaining = 0 AND ps.is_injured = 1
    `;

    await this.prisma.$executeRaw`
      UPDATE player_status 
      SET condition = LEAST(100, condition + 10),
          fitness = LEAST(100, fitness + 5)
      WHERE is_injured = 0
    `;

    await this.prisma.$executeRaw`
      UPDATE financial_accounts
      SET cash_balance = cash_balance + 25000
    `;

    return {
      message: seasonCompleted
        ? `Mùa giải ${season.season_number} đã hoàn tất! Đã tự động tạo Mùa ${newSeasonData?.seasonNumber} và sinh toàn bộ giải đấu, lịch thi đấu Day 1!`
        : `Đã chuyển sang Ngày ${nextDay} / ${season.total_days} của Mùa ${season.season_number}`,
      current_day: seasonCompleted ? 1 : nextDay,
      season_number: seasonCompleted ? newSeasonData?.seasonNumber : season.season_number,
      season_completed: seasonCompleted,
      auto_generated_fixtures: seasonCompleted,
      daily_grant: 25000,
      stamina_recovered: true,
    };
  }
}