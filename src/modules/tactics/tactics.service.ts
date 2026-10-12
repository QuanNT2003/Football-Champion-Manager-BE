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

  private formatPlayerData(p: any, defaultPos?: string) {
    if (!p) return null;
    const naturalPos = p.player_positions?.find((pp: any) => pp.is_natural)?.positions?.code;
    return {
      id: p.id.toString(),
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Cầu thủ',
      first_name: p.first_name,
      last_name: p.last_name,
      squad_number: p.squad_number,
      photo_url: p.photo_url || '/assets/players/default.png',
      age: p.age,
      preferred_foot: p.preferred_foot,
      position: naturalPos || defaultPos || 'MID',
    };
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
    let tactic: any = await this.prisma.club_tactics.findFirst({
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
          orderBy: { order_no: 'asc' },
        },
      },
    });

    // 3. Nếu CLB chưa có tactic, khởi tạo theo sơ đồ ưa thích của HLV CLB
    if (!tactic) {
      const defaultFormationId =
        headCoachContract?.staff?.preferred_formation_id ||
        (await this.prisma.formations.findFirst())?.id;

      if (defaultFormationId) {
        const createdTactic = await this.prisma.club_tactics.create({
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
        });

        // Tự động gán 11 cầu thủ đầu tiên vào đá chính và 9 cầu thủ tiếp theo vào dự bị
        const clubPlayers = await this.prisma.players.findMany({
          where: { current_club_id: clubId },
          take: 20,
          orderBy: { squad_number: 'asc' },
        });

        const targetFormation = await this.prisma.formations.findUnique({
          where: { id: defaultFormationId },
          include: {
            formation_positions: {
              include: { positions: true },
              orderBy: { order_no: 'asc' },
            },
          },
        });

        const formationPositions = targetFormation?.formation_positions || [];
        for (let i = 0; i < formationPositions.length; i++) {
          const formPos = formationPositions[i];
          const player = clubPlayers[i];
          if (player) {
            await this.prisma.club_tactic_positions.create({
              data: {
                tactic_id: createdTactic.id,
                formation_position_id: formPos.id,
                player_id: player.id,
                role: 'STANDARD',
                duty: 'SUPPORT',
                lineup_role: 'STARTING',
                order_no: i + 1,
              },
            });
          }
        }

        // 9 cầu thủ dự bị
        const benchPlayers = clubPlayers.slice(formationPositions.length, formationPositions.length + 9);
        for (let j = 0; j < benchPlayers.length; j++) {
          const benchPlayer = benchPlayers[j];
          await this.prisma.club_tactic_positions.create({
            data: {
              tactic_id: createdTactic.id,
              formation_position_id: null,
              player_id: benchPlayer.id,
              role: 'BENCH',
              duty: 'SUPPORT',
              lineup_role: 'SUBSTITUTE',
              order_no: j + 1,
            },
          });
        }

        // Tải lại tactic kèm positions
        tactic = await this.prisma.club_tactics.findUnique({
          where: { id: createdTactic.id },
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
              orderBy: { order_no: 'asc' },
            },
          },
        });
      }
    }

    const allPositions: any[] = tactic?.club_tactic_positions || [];
    
    // 4. Phân chia đá chính (STARTING) và dự bị (SUBSTITUTE)
    const startingPositionsRaw = allPositions.filter(
      (pos) => pos.lineup_role === 'STARTING' || pos.formation_position_id !== null,
    );
    const subPositionsRaw = allPositions.filter(
      (pos) => pos.lineup_role === 'SUBSTITUTE',
    );

    const formattedStartingPositions = startingPositionsRaw.map((pos) => ({
      ...pos,
      players: this.formatPlayerData(pos.players, pos.formation_positions?.slot_code),
    }));

    let formattedSubstitutes = subPositionsRaw.map((sub, idx) => ({
      id: sub.id.toString(),
      order_no: sub.order_no || idx + 1,
      lineup_role: 'SUBSTITUTE',
      players: this.formatPlayerData(sub.players),
    }));

    // 5. Nếu chưa có danh sách dự bị nào trong CSDL, tự động gợi ý 9 cầu thủ dự bị từ CLB
    if (formattedSubstitutes.length === 0) {
      const assignedPlayerIds = formattedStartingPositions
        .map((p) => p.players?.id)
        .filter(Boolean)
        .map((id) => BigInt(id));

      const availableClubPlayers = await this.prisma.players.findMany({
        where: {
          current_club_id: clubId,
          ...(assignedPlayerIds.length > 0 ? { id: { notIn: assignedPlayerIds } } : {}),
        },
        take: 9,
        orderBy: { squad_number: 'asc' },
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
      });

      formattedSubstitutes = availableClubPlayers.map((player, idx) => ({
        id: `temp_sub_${player.id}`,
        order_no: idx + 1,
        lineup_role: 'SUBSTITUTE',
        players: this.formatPlayerData(player),
      }));
    }

    return {
      ...tactic,
      club_tactic_positions: formattedStartingPositions,
      substitutes: formattedSubstitutes,
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
      substitutes?: Array<{
        playerId: string;
        orderNo?: number;
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

    // Xóa vị trí cũ và ghi lại cả 11 đá chính và danh sách ghế dự bị
    if ((dto.positions && dto.positions.length > 0) || (dto.substitutes && dto.substitutes.length > 0)) {
      await this.prisma.club_tactic_positions.deleteMany({
        where: { tactic_id: tactic.id },
      });

      // 1. Lưu 11 cầu thủ đá chính
      if (dto.positions && dto.positions.length > 0) {
        for (let i = 0; i < dto.positions.length; i++) {
          const pos = dto.positions[i];
          if (pos.formationPositionId && pos.playerId) {
            await this.prisma.club_tactic_positions.create({
              data: {
                tactic_id: tactic.id,
                formation_position_id: BigInt(pos.formationPositionId),
                player_id: BigInt(pos.playerId),
                role: pos.role || 'STANDARD',
                duty: pos.duty || 'SUPPORT',
                lineup_role: 'STARTING',
                order_no: i + 1,
              },
            });
          }
        }
      }

      // 2. Lưu danh sách cầu thủ dự bị (tối đa 9-12 cầu thủ trên ghế)
      if (dto.substitutes && dto.substitutes.length > 0) {
        for (let j = 0; j < dto.substitutes.length; j++) {
          const sub = dto.substitutes[j];
          if (sub.playerId) {
            await this.prisma.club_tactic_positions.create({
              data: {
                tactic_id: tactic.id,
                formation_position_id: null,
                player_id: BigInt(sub.playerId),
                role: 'BENCH',
                duty: 'SUPPORT',
                lineup_role: 'SUBSTITUTE',
                order_no: sub.orderNo ?? (j + 1),
              },
            });
          }
        }
      }
    }

    return {
      message: 'Cập nhật chiến thuật, đội hình xuất phát và danh sách dự bị thành công!',
      tactic: await this.getClubTactic(clubId),
    };
  }
}
