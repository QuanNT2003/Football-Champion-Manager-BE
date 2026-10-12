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

        // Lấy 20 cầu thủ đầu tiên của CLB để xếp 11 đá chính và 9 ghế dự bị
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
          await this.prisma.club_tactic_positions.create({
            data: {
              tactic_id: createdTactic.id,
              formation_position_id: formPos.id,
              player_id: player ? player.id : null,
              role: 'STANDARD',
              duty: 'SUPPORT',
              lineup_role: 'STARTING',
              order_no: i + 1,
            },
          });
        }

        // Tạo sẵn 9 ghế dự bị (SUBSTITUTE): nếu có cầu thủ thì lưu player_id, nếu không thì null
        const benchPlayers = clubPlayers.slice(formationPositions.length, formationPositions.length + 9);
        for (let j = 0; j < 9; j++) {
          const benchPlayer = benchPlayers[j];
          await this.prisma.club_tactic_positions.create({
            data: {
              tactic_id: createdTactic.id,
              formation_position_id: null,
              player_id: benchPlayer ? benchPlayer.id : null,
              role: 'BENCH',
              duty: 'SUPPORT',
              lineup_role: 'SUBSTITUTE',
              order_no: j + 1,
            },
          });
        }

        // Tải lại tactic
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

    // Sắp xếp 9 ghế dự bị theo order_no (1..9), nếu ghế nào chưa có cầu thủ thì players = null
    const formattedSubstitutes = [];
    for (let seat = 1; seat <= 9; seat++) {
      const foundSub = subPositionsRaw.find((s) => s.order_no === seat) || subPositionsRaw[seat - 1];
      if (foundSub) {
        formattedSubstitutes.push({
          id: foundSub.id.toString(),
          order_no: seat,
          lineup_role: 'SUBSTITUTE',
          players: this.formatPlayerData(foundSub.players),
        });
      } else {
        formattedSubstitutes.push({
          id: `empty_sub_${seat}`,
          order_no: seat,
          lineup_role: 'SUBSTITUTE',
          players: null,
        });
      }
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
        playerId?: string | null;
        role?: string;
        duty?: string;
      }>;
      substitutes?: Array<{
        playerId?: string | null;
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

    // 1. CẬP NHẬT HOẶC TẠO MỚI 11 VỊ TRÍ ĐÁ CHÍNH (STARTING XI)
    if (dto.positions && dto.positions.length > 0) {
      const existingStarters = await this.prisma.club_tactic_positions.findMany({
        where: {
          tactic_id: tactic.id,
          lineup_role: 'STARTING',
        },
      });

      const activeFormationPosIds: bigint[] = [];

      for (let i = 0; i < dto.positions.length; i++) {
        const pos = dto.positions[i];
        if (pos.formationPositionId) {
          const formPosId = BigInt(pos.formationPositionId);
          activeFormationPosIds.push(formPosId);
          const pId = pos.playerId ? BigInt(pos.playerId) : null;

          const matched = existingStarters.find(
            (e) => e.formation_position_id !== null && e.formation_position_id === formPosId,
          );

          if (matched) {
            // Có rồi -> CẬP NHẬT
            await this.prisma.club_tactic_positions.update({
              where: { id: matched.id },
              data: {
                player_id: pId,
                role: pos.role || 'STANDARD',
                duty: pos.duty || 'SUPPORT',
                order_no: i + 1,
              },
            });
          } else {
            // Chưa có -> TẠO MỚI
            await this.prisma.club_tactic_positions.create({
              data: {
                tactic_id: tactic.id,
                formation_position_id: formPosId,
                player_id: pId,
                role: pos.role || 'STANDARD',
                duty: pos.duty || 'SUPPORT',
                lineup_role: 'STARTING',
                order_no: i + 1,
              },
            });
          }
        }
      }

      // Nếu HLV đổi sang sơ đồ mới, dọn dẹp các vị trí của sơ đồ cũ không còn trong sơ đồ mới
      if (activeFormationPosIds.length > 0) {
        await this.prisma.club_tactic_positions.deleteMany({
          where: {
            tactic_id: tactic.id,
            lineup_role: 'STARTING',
            formation_position_id: { notIn: activeFormationPosIds },
          },
        });
      }
    }

    // 2. CẬP NHẬT HOẶC TẠO MỚI 9 GHẾ DỰ BỊ (SUBSTITUTES)
    // Đảm bảo đủ 9 ghế (order_no = 1..9), nếu ghế chưa fill cầu thủ thì player_id = null
    const existingSubs = await this.prisma.club_tactic_positions.findMany({
      where: {
        tactic_id: tactic.id,
        lineup_role: 'SUBSTITUTE',
      },
      orderBy: { order_no: 'asc' },
    });

    const subInputs = dto.substitutes || [];

    for (let seatNo = 1; seatNo <= 9; seatNo++) {
      // Tìm ghế tương ứng từ DTO (theo orderNo hoặc theo index)
      const inputSub = subInputs.find((s) => (s.orderNo || 0) === seatNo) || subInputs[seatNo - 1];
      const pId = inputSub?.playerId ? BigInt(inputSub.playerId) : null;

      // Tìm bản ghi ghế dự bị hiện có trong CSDL
      const matchedSub = existingSubs.find((e) => e.order_no === seatNo) || existingSubs[seatNo - 1];

      if (matchedSub) {
        // Có rồi -> CẬP NHẬT (player_id có thể là null nếu ghế chưa fill)
        await this.prisma.club_tactic_positions.update({
          where: { id: matchedSub.id },
          data: {
            formation_position_id: null,
            player_id: pId,
            role: 'BENCH',
            duty: 'SUPPORT',
            order_no: seatNo,
          },
        });
      } else {
        // Chưa có -> TẠO MỚI ghế dự bị này
        await this.prisma.club_tactic_positions.create({
          data: {
            tactic_id: tactic.id,
            formation_position_id: null,
            player_id: pId,
            role: 'BENCH',
            duty: 'SUPPORT',
            lineup_role: 'SUBSTITUTE',
            order_no: seatNo,
          },
        });
      }
    }

    // Xóa các ghế thừa nếu trước đó có > 9 ghế
    if (existingSubs.length > 9) {
      const extraIds = existingSubs.slice(9).map((e) => e.id);
      await this.prisma.club_tactic_positions.deleteMany({
        where: { id: { in: extraIds } },
      });
    }

    return {
      message: 'Cập nhật chiến thuật, đội hình xuất phát và danh sách dự bị thành công!',
      tactic: await this.getClubTactic(clubId),
    };
  }
}
