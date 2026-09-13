import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrainingTypes() {
    return this.prisma.training_types.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async getClubSessions(clubId: bigint) {
    return this.prisma.training_sessions.findMany({
      where: { club_id: clubId },
      include: {
        training_types: true,
      },
      orderBy: { id: 'desc' },
      take: 20,
    });
  }

  async scheduleSession(
    clubId: bigint,
    dto: {
      trainingTypeId: string;
      intensity?: number;
    },
  ) {
    const activeSeason = await this.prisma.seasons.findFirst({
      where: { status: 'ACTIVE' },
    });

    const session = await this.prisma.training_sessions.create({
      data: {
        club_id: clubId,
        training_type_id: BigInt(dto.trainingTypeId),
        season_id: activeSeason?.id || 1n,
        season_day: activeSeason?.current_day || 1,
        session_date: new Date(),
        intensity: dto.intensity ?? 50,
        status: 'SCHEDULED',
      },
      include: {
        training_types: true,
      },
    });

    return {
      message: `Đã lên lịch buổi tập '${session.training_types?.name}' thành công!`,
      session,
    };
  }
}
