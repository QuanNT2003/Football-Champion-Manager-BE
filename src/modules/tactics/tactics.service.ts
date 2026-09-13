import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TacticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFormations() {
    return this.prisma.formations.findMany({
      include: {
        formation_positions: {
          include: { positions: true },
          orderBy: { order_no: 'asc' },
        },
      },
    });
  }

  async getTacticalInstructions() {
    return this.prisma.tactical_instructions.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async getClubTactic(clubId: bigint) {
    let tactic = await this.prisma.club_tactics.findFirst({
      where: { club_id: clubId },
      include: {
        formations: {
          include: {
            formation_positions: {
              include: { positions: true },
            },
          },
        },
        club_tactic_positions: {
          include: {
            players: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                squad_number: true,
                photo_url: true,
                attributes_summary: true,
              },
            },
            formation_positions: true,
          },
        },
      },
    });

    if (!tactic) {
      const defaultFormation = await this.prisma.formations.findFirst();
      if (defaultFormation) {
        tactic = await this.prisma.club_tactics.create({
          data: {
            club_id: clubId,
            name: 'Default Tactic',
            formation_id: defaultFormation.id,
            mentality: 'BALANCED',
            tempo: 50,
            passing_style: 'MIXED',
            pressing_intensity: 50,
            defensive_line: 50,
          },
          include: {
            formations: {
              include: {
                formation_positions: {
                  include: { positions: true },
                },
              },
            },
            club_tactic_positions: {
              include: {
                players: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    squad_number: true,
                    photo_url: true,
                    attributes_summary: true,
                  },
                },
                formation_positions: true,
              },
            },
          },
        });
      }
    }

    return tactic;
  }

  async updateClubTactic(
    clubId: bigint,
    dto: {
      formationId?: string;
      name?: string;
      mentality?: string;
      tempo?: number;
      passingStyle?: string;
      pressingIntensity?: number;
      defensiveLine?: number;
      positions?: Array<{
        formationPositionId: string;
        playerId: string;
        role?: string;
        duty?: string;
      }>;
    },
  ) {
    let tactic = await this.prisma.club_tactics.findFirst({
      where: { club_id: clubId },
    });

    if (!tactic) {
      tactic = await this.prisma.club_tactics.create({
        data: {
          club_id: clubId,
          name: dto.name || 'Custom Tactic',
          formation_id: BigInt(dto.formationId || '1'),
          mentality: dto.mentality || 'BALANCED',
          tempo: dto.tempo ?? 50,
          passing_style: dto.passingStyle || 'MIXED',
          pressing_intensity: dto.pressingIntensity ?? 50,
          defensive_line: dto.defensiveLine ?? 50,
        },
      });
    } else {
      await this.prisma.club_tactics.update({
        where: { id: tactic.id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.formationId ? { formation_id: BigInt(dto.formationId) } : {}),
          ...(dto.mentality ? { mentality: dto.mentality } : {}),
          ...(dto.tempo !== undefined ? { tempo: Number(dto.tempo) } : {}),
          ...(dto.passingStyle ? { passing_style: dto.passingStyle } : {}),
          ...(dto.pressingIntensity !== undefined ? { pressing_intensity: Number(dto.pressingIntensity) } : {}),
          ...(dto.defensiveLine !== undefined ? { defensive_line: Number(dto.defensiveLine) } : {}),
        },
      });
    }

    if (dto.positions && dto.positions.length > 0) {
      await this.prisma.club_tactic_positions.deleteMany({
        where: { tactic_id: tactic.id },
      });

      for (const pos of dto.positions) {
        await this.prisma.club_tactic_positions.create({
          data: {
            tactic_id: tactic.id,
            formation_position_id: BigInt(pos.formationPositionId),
            player_id: BigInt(pos.playerId),
            role: pos.role || 'STANDARD',
            duty: pos.duty || 'SUPPORT',
          },
        });
      }
    }

    return {
      message: 'Cập nhật chiến thuật và đội hình xuất phát thành công!',
      tactic: await this.getClubTactic(clubId),
    };
  }
}
