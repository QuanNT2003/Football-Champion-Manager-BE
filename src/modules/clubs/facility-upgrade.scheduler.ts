import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { FACILITY_UPGRADE_ACTIVE, progressFacilityUpgrades } from '@/common/facility-upgrades';

@Injectable()
export class FacilityUpgradeScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(FacilityUpgradeScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() { await this.process(); }

  @Cron(CronExpression.EVERY_MINUTE)
  async process(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      // All worlds, including jobs that expired while the backend was offline.
      const jobs = await this.prisma.facility_upgrades.findMany({
        where: { status: FACILITY_UPGRADE_ACTIVE, started_at: { lte: new Date(now.getTime() - 86400000) } },
        select: { id: true, facilities: { select: { club_id: true } }, stadiums: { select: { club_id: true } } },
      });
      for (const job of jobs) {
        const clubId = job.facilities?.club_id ?? job.stadiums?.club_id;
        if (clubId == null) continue;
        try {
          await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${clubId} FOR UPDATE`;
            await progressFacilityUpgrades(tx, undefined, now, job.id);
          });
        } catch (error) {
          this.logger.error(`Không thể chốt nâng cấp ${job.id}; sẽ thử lại ở lượt sau`, error);
        }
      }
    } catch (error) {
      this.logger.error('Không thể kiểm tra tiến độ nâng cấp', error);
    } finally { this.running = false; }
  }
}
