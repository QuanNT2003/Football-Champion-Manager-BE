import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { GAME_TIME_ZONE } from '@/common/match-schedule';

export const CLUB_RANKING_CRON = '0 10 0 * * *';

/** Latest daily publication due at 00:10 in Vietnam, independent of the host timezone. */
export function clubRankingDate(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: GAME_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const field = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const midnight = Date.UTC(field('year'), field('month') - 1, field('day'));
  return new Date(midnight - (field('hour') === 0 && field('minute') < 10 ? 86400000 : 0));
}

@Injectable()
export class ClubRankingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClubRankingsService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() { await this.runDailyRankings(); }

  @Cron(CLUB_RANKING_CRON, { name: 'daily-club-rankings', timeZone: GAME_TIME_ZONE })
  async runDailyRankings(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const date = clubRankingDate(now);
      const worlds = await this.prisma.game_worlds.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
      for (const world of worlds) {
        try {
          const result = await this.publishWorldRanks(world.id, date);
          if (result.published) this.logger.log(`Published ${result.clubs} club ranks for world ${world.id}, ${date.toISOString().slice(0, 10)}`);
        } catch (error) { this.logger.error(`Failed to publish club ranks for world ${world.id}`, error); }
      }
    } catch (error) { this.logger.error('Failed to run daily club rankings', error); }
    finally { this.running = false; }
  }

  async publishWorldRanks(worldId: bigint, date: Date) {
    return this.prisma.$transaction(async tx => {
      // Only ranking publishers lock the world; match transactions lock their own two clubs.
      await tx.$queryRaw`SELECT id FROM game_worlds WHERE id = ${worldId} FOR UPDATE`;
      const existing = await tx.club_rankings.findFirst({ where: {
        world_id: worldId, ranking_type: 'WORLD_CLUB', ranking_date: date,
      }, select: { id: true } });
      if (existing) return { published: false, clubs: 0 };

      // Match preparation locks clubs in ID order too; use that order before writing rank/history.
      await tx.$queryRaw`SELECT id FROM clubs WHERE world_id = ${worldId} ORDER BY id ASC FOR UPDATE`;
      // One consistent statement snapshot of points. Later matches change points, not this publication.
      const ordered = await tx.clubs.findMany({ where: { world_id: worldId },
        select: { id: true, ranking_points: true, world_rank: true, previous_world_rank: true },
        orderBy: [{ ranking_points: 'desc' }, { id: 'asc' }] });
      if (!ordered.length) return { published: false, clubs: 0 };
      const changed = ordered.flatMap((club, index) =>
        club.world_rank === index + 1 && club.previous_world_rank === club.world_rank
          ? [] : [{ id: club.id, rank: index + 1 }]);
      for (let offset = 0; offset < changed.length; offset += 500) {
        const batch = changed.slice(offset, offset + 500);
        await tx.$executeRaw(Prisma.sql`
          UPDATE clubs
          SET previous_world_rank = world_rank,
              world_rank = CASE id ${Prisma.join(batch.map(club => Prisma.sql`WHEN ${club.id} THEN ${club.rank}`), ' ')} ELSE world_rank END
          WHERE world_id = ${worldId} AND id IN (${Prisma.join(batch.map(club => club.id))})
        `);
      }
      // History also marks the completed day. The world lock plus this atomic write prevents duplicates.
      for (let offset = 0; offset < ordered.length; offset += 500) {
        await tx.club_rankings.createMany({ data: ordered.slice(offset, offset + 500).map((club, index) => ({
          world_id: worldId, club_id: club.id, ranking_type: 'WORLD_CLUB', ranking_date: date,
          rank: offset + index + 1, points: club.ranking_points, previous_rank: club.world_rank,
        })) });
      }
      return { published: true, clubs: ordered.length };
    }, { timeout: 120_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
