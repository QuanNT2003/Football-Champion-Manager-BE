import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class GameWorldService {
  private readonly logger = new Logger(GameWorldService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      season: activeSeason ? {
        id: activeSeason.id.toString(),
        name: activeSeason.name,
        season_number: activeSeason.season_number,
        current_day: activeSeason.current_day,
        total_days: activeSeason.total_days,
        is_transfer_window_open: Boolean(activeSeason.is_transfer_window_open),
        status: activeSeason.status,
      } : null,
      timeline,
    };
  }

  async advanceDay(worldId: bigint = 1n) {
    const season = await this.prisma.seasons.findFirst({
      where: { world_id: worldId, status: 'ACTIVE' },
    });

    if (!season) {
      return { message: 'Không có mùa giải đang hoạt động' };
    }

    const nextDay = season.current_day + 1;
    let seasonCompleted = false;

    if (nextDay > season.total_days) {
      seasonCompleted = true;
      await this.prisma.seasons.update({
        where: { id: season.id },
        data: { status: 'COMPLETED' },
      });
    } else {
      await this.prisma.seasons.update({
        where: { id: season.id },
        data: { current_day: nextDay },
      });
    }

    // 1. Process Injuries Recovery (countdown days_remaining)
    await this.prisma.$executeRaw`
      UPDATE injuries 
      SET days_remaining = GREATEST(0, days_remaining - 1)
      WHERE days_remaining > 0
    `;

    // 2. Sync player_status: set is_injured = 0 if days_remaining reaches 0
    await this.prisma.$executeRaw`
      UPDATE player_status ps
      JOIN injuries inj ON ps.player_id = inj.player_id
      SET ps.is_injured = 0
      WHERE inj.days_remaining = 0 AND ps.is_injured = 1
    `;

    this.logger.log(`Server timeline advanced to Season ${season.season_number}, Day ${nextDay}`);

    return {
      message: seasonCompleted
        ? `Mùa giải ${season.season_number} đã kết thúc 40 ngày thi đấu!`
        : `Đã chuyển sang Ngày ${nextDay} / ${season.total_days} của Mùa ${season.season_number}`,
      current_day: seasonCompleted ? season.total_days : nextDay,
      season_number: season.season_number,
      season_completed: seasonCompleted,
    };
  }
}
