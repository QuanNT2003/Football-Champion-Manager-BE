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
      orderBy: { id: 'asc' },
    });
  }

  async getTacticalInstructions() {
    return this.prisma.tactical_instructions.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async getClubTactic(clubId: bigint) {
    // 1. Tìm thông tin HLV trưởng của CLB
    const headCoachContract = await this.prisma.staff_contracts.findFirst({
      where: {
        club_id: clubId,
        staff: { staff_type: 'HEAD_COACH' },
      },
      include: {
        staff: {
          include: {
            preferred_formation: {
              include: {
                formation_positions: {
                  include: { positions: true },
                  orderBy: { order_no: 'asc' },
                },
              },
            },
            secondary_formation: {
              include: {
                formation_positions: {
                  include: { positions: true },
                  orderBy: { order_no: 'asc' },
                },
              },
            },
            countries: true,
          },
        },
      },
    });

    // 2. Tìm tactic đã lưu của CLB
    let tactic = await this.prisma.club_tactics.findFirst({
      where: { club_id: clubId },
      include: {
        formations: {
          include: {
            formation_positions: {
              include: { positions: true },
              orderBy: { order_no: 'asc' },
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
                age: true,
                preferred_foot: true,
                player_positions: {
                  include: { positions: true },
                },
              },
            },
            formation_positions: {
              include: { positions: true },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    // 3. Nếu CLB chưa có tactic, khởi tạo theo sơ đồ ưa thích của HLV CLB
    if (!tactic) {
      const defaultFormationId =
        headCoachContract?.staff?.preferred_formation_id ||
        (await this.prisma.formations.findFirst())?.id;

      if (defaultFormationId) {
        tactic = await this.prisma.club_tactics.create({
          data: {
            club_id: clubId,
            name: 'Đội hình chính',
            formation_id: defaultFormationId,
            mentality: headCoachContract?.staff?.tactical_style === 'TIKI_TAKA' ? 'ATTACKING' : 'BALANCED',
            tempo: 55,
            passing_style: 'MIXED',
            pressing_intensity: 55,
            defensive_line: 50,
          },
          include: {
            formations: {
              include: {
                formation_positions: {
                  include: { positions: true },
                  orderBy: { order_no: 'asc' },
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
                  },
                },
                formation_positions: {
                  include: { positions: true },
                },
              },
              orderBy: { id: 'asc' },
            },
          },
        });

        // Tự động gán 11 cầu thủ đầu tiên của CLB vào 11 vị trí sơ đồ
        const clubPlayers = await this.prisma.players.findMany({
          where: { current_club_id: clubId },
          take: 11,
          orderBy: { squad_number: 'asc' },
        });

        const formationPositions = tactic.formations?.formation_positions || [];
        for (let i = 0; i < formationPositions.length; i++) {
          const formPos = formationPositions[i];
          const player = clubPlayers[i];
          if (player) {
            await this.prisma.club_tactic_positions.create({
              data: {
                tactic_id: tactic.id,
                formation_position_id: formPos.id,
                player_id: player.id,
                role: 'STANDARD',
                duty: 'SUPPORT',
              },
            });
          }
        }

        // Tải lại tactic kèm positions vừa gán
        tactic = await this.prisma.club_tactics.findUnique({
          where: { id: tactic.id },
          include: {
            formations: {
              include: {
                formation_positions: {
                  include: { positions: true },
                  orderBy: { order_no: 'asc' },
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
                  },
                },
                formation_positions: {
                  include: { positions: true },
                },
              },
              orderBy: { id: 'asc' },
            },
          },
        });
      }
    }

    const formattedPositions = tactic?.club_tactic_positions?.map((pos) => {
      const p = pos.players as any;
      const naturalPos = p?.player_positions?.find((pp: any) => pp.is_natural)?.positions?.code;
      return {
        ...pos,
        players: p
          ? {
              id: p.id.toString(),
              name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Cầu thủ',
              first_name: p.first_name,
              last_name: p.last_name,
              squad_number: p.squad_number,
              photo_url: p.photo_url || '/assets/players/default.png',
              age: p.age,
              preferred_foot: p.preferred_foot,
              position: naturalPos || pos.formation_positions?.slot_code || 'MID',
            }
          : null,
      };
    }) || [];

    return {
      ...tactic,
      club_tactic_positions: formattedPositions,
      headCoach: headCoachContract?.staff
        ? {
            id: headCoachContract.staff.id.toString(),
            name: headCoachContract.staff.name,
            photoUrl: headCoachContract.staff.photo_url,
            reputation: headCoachContract.staff.reputation,
            coachingLicense: headCoachContract.staff.coaching_license,
            tacticalStyle: headCoachContract.staff.tactical_style,
            nationality: headCoachContract.staff.countries?.name || 'Vietnam',
            countryCode: headCoachContract.staff.countries?.code || 'VIE',
            preferredFormation: headCoachContract.staff.preferred_formation
              ? {
                  id: headCoachContract.staff.preferred_formation.id.toString(),
                  code: headCoachContract.staff.preferred_formation.code,
                  name: headCoachContract.staff.preferred_formation.name,
                }
              : null,
            secondaryFormation: headCoachContract.staff.secondary_formation
              ? {
                  id: headCoachContract.staff.secondary_formation.id.toString(),
                  code: headCoachContract.staff.secondary_formation.code,
                  name: headCoachContract.staff.secondary_formation.name,
                }
              : null,
          }
        : null,
    };
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
          name: dto.name || 'Đội hình thi đấu',
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
          updated_at: new Date(),
        },
      });
    }

    if (dto.positions && dto.positions.length > 0) {
      await this.prisma.club_tactic_positions.deleteMany({
        where: { tactic_id: tactic.id },
      });

      for (const pos of dto.positions) {
        if (pos.formationPositionId && pos.playerId) {
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
    }

    return {
      message: 'Cập nhật chiến thuật và đội hình xuất phát thành công!',
      tactic: await this.getClubTactic(clubId),
    };
  }
}
