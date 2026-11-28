import { DisciplineMatch, nextClubMatch } from '../players/discipline-scope';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { playerAvailability, playerAvailabilityInclude } from '../players/player-availability';
import { coachTacticDefaults } from '../matches/match-lineup.rules';
import { normalizeInstructions } from '../matches/tactic-normalizer';
import { TACTICAL_RULEBOOK } from '../matches/tactical-rulebook';
import { loadYellowCards, yellowCardMatchScopes, YellowCardAccumulation } from '../players/player-yellow-cards';
import { playerBelongsToSquad, squadPlayerWhere } from '../players/squad-eligibility';

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

  private formatPlayerData(p: any, defaultPos?: string, nextMatch?: DisciplineMatch | null, yellowCards?: YellowCardAccumulation[], squadType = 'FIRST_TEAM') {
    if (!p || !playerBelongsToSquad(p, squadType)) return null;
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
      squad_type: p.squad_type || 'FIRST_TEAM',
      status: { ...playerAvailability(p, nextMatch, yellowCards), condition: p.player_status?.condition },
    };
  }

  async getClubTactic(clubId: bigint, squadType: string = 'FIRST_TEAM') {
    const nextMatch = await nextClubMatch(this.prisma, clubId, squadType);
    // 1. Tìm thông tin HLV trưởng của CLB (ưu tiên HLV đội trẻ nếu truy vấn tuyến trẻ)
    let headCoachContract = null;
    if (squadType === 'YOUTH_U21' || squadType === 'YOUTH_U19') {
      headCoachContract = await this.prisma.staff_contracts.findFirst({
        where: {
          club_id: clubId,
          status: 'ACTIVE',
          role: 'HEAD_COACH_YOUTH',
          squad_type: { in: [(squadType as any), 'FIRST_TEAM'] },
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
    }

    if (!headCoachContract) {
      headCoachContract = await this.prisma.staff_contracts.findFirst({
        where: {
          club_id: clubId,
          role: 'HEAD_COACH',
          status: 'ACTIVE',
          squad_type: 'FIRST_TEAM',
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
    }

    // 2. Tìm tactic đã lưu của CLB theo tuyến đội
    let tactic: any = await this.prisma.club_tactics.findFirst({
      where: {
        club_id: clubId,
        squad_type: (squadType as any) || 'FIRST_TEAM',
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
                ...playerAvailabilityInclude,
                id: true,
                first_name: true,
                last_name: true,
                squad_number: true,
                photo_url: true,
                age: true,
                preferred_foot: true,
                squad_type: true,
                player_positions: {
                  include: { positions: true },
                },
              },
            },
            formation_positions: {
              include: { positions: true },
            },
            tactic_position_instructions: { include: { tactical_instructions: true } },
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
            squad_type: (squadType as any) || 'FIRST_TEAM',
            name: squadType === 'FIRST_TEAM' ? 'Đội hình chính' : `Đội hình trẻ ${squadType === 'YOUTH_U19' ? 'U19' : 'U21'}`,
            formation_id: defaultFormationId,
            ...coachTacticDefaults(headCoachContract?.staff?.tactical_style || 'BALANCED'),
          },
        });

        // Select only the registered squad, including the youth age limit.
        const playerWhere = { current_club_id: clubId, ...squadPlayerWhere(squadType) };
        const clubPlayers = await this.prisma.players.findMany({
          where: playerWhere,
          take: 20,
          orderBy: [{ squad_type: 'asc' }, { squad_number: 'asc' }],
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
                    ...playerAvailabilityInclude,
                    id: true,
                    first_name: true,
                    last_name: true,
                    squad_number: true,
                    photo_url: true,
                    age: true,
                    preferred_foot: true,
                    squad_type: true,
                    player_positions: {
                      include: { positions: true },
                    },
                  },
                },
                formation_positions: {
                  include: { positions: true },
                },
                tactic_position_instructions: { include: { tactical_instructions: true } },
              },
              orderBy: { order_no: 'asc' },
            },
          },
        });
      }
    }

    const allPositions: any[] = tactic?.club_tactic_positions || [];
    const yellowCards = await loadYellowCards(this.prisma, allPositions.flatMap(pos => pos.players ? [pos.players.id] : []), yellowCardMatchScopes([nextMatch]));
    
    // 4. Phân chia đá chính (STARTING) và dự bị (SUBSTITUTE)
    const startingPositionsRaw = allPositions.filter(
      (pos) => pos.lineup_role === 'STARTING' || pos.formation_position_id !== null,
    );
    const subPositionsRaw = allPositions.filter(
      (pos) => pos.lineup_role === 'SUBSTITUTE',
    );

    const formattedStartingPositions = startingPositionsRaw.map((pos) => ({
      ...pos,
      instructions: (pos.tactic_position_instructions || []).filter(i => i.value !== 0).map(i => i.tactical_instructions.code),
      players: this.formatPlayerData(pos.players, pos.formation_positions?.slot_code, nextMatch, yellowCards.get(pos.players?.id), squadType),
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
          players: this.formatPlayerData(foundSub.players, undefined, nextMatch, yellowCards.get(foundSub.players?.id), squadType),
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
      next_match: nextMatch ? { id: String(nextMatch.id), competition_season_id: nextMatch.competition_season_id == null ? null : String(nextMatch.competition_season_id), competition_name: nextMatch.competition_seasons?.name || null } : null,
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
    dto: any,
    squadType: string = 'FIRST_TEAM',
  ) {
    const finalSquadType = dto.squadType || squadType || 'FIRST_TEAM';
    const instructionCodes: string[] = [...new Set<string>((dto.positions || []).flatMap(p => p.instructions || []))];
    if (instructionCodes.some(code => !TACTICAL_RULEBOOK.instructions.includes(code))) {
      throw new BadRequestException('Mã chỉ dẫn chiến thuật không hợp lệ');
    }
    const instructionRows = instructionCodes.length ? await this.prisma.tactical_instructions.findMany({ where: { code: { in: instructionCodes } } }) : [];
    if (instructionRows.length !== instructionCodes.length) throw new BadRequestException('Thiếu chỉ dẫn trong danh mục chiến thuật');
    await this.prisma.$transaction(async tx => {
      let tactic = await tx.club_tactics.findFirst({
        where: {
          club_id: clubId,
          squad_type: (finalSquadType as any),
        },
      });

      if (!tactic) {
        tactic = await tx.club_tactics.create({
          data: {
            club_id: clubId,
            squad_type: (finalSquadType as any),
            name: dto.name || (finalSquadType === 'YOUTH_U21' ? 'Đội hình trẻ U21' : 'Đội hình thi đấu'),
            formation_id: BigInt(dto.formationId || '1'),
            mentality: dto.mentality || 'BALANCED',
            tempo: dto.tempo ?? 50,
            passing_style: dto.passingStyle || 'MIXED',
            pressing_intensity: dto.pressingIntensity ?? 50,
            defensive_line: dto.defensiveLine ?? 50,
          },
        });
      } else {
        await tx.club_tactics.update({
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
        const existingStarters = await tx.club_tactic_positions.findMany({
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

            let positionId: bigint;
            if (matched) {
              // Có rồi -> CẬP NHẬT
              const savedPosition = await tx.club_tactic_positions.update({
                where: { id: matched.id },
                data: {
                  player_id: pId,
                  role: pos.role || 'STANDARD',
                  duty: pos.duty || 'SUPPORT',
                  order_no: i + 1,
                },
              });
              positionId = savedPosition.id;
            } else {
              // Chưa có -> TẠO MỚI
              const savedPosition = await tx.club_tactic_positions.create({
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
              positionId = savedPosition.id;
            }
            if (pos.instructions !== undefined) {
              const codes = normalizeInstructions(pos.instructions);
              await tx.tactic_position_instructions.deleteMany({ where: { tactic_position_id: positionId } });
              if (codes.length) await tx.tactic_position_instructions.createMany({ data: codes.map(code => ({
                tactic_position_id: positionId, instruction_id: instructionRows.find(row => row.code === code).id, value: 1,
              })) });
            }
          }
        }

        // Nếu HLV đổi sang sơ đồ mới, dọn dẹp các vị trí của sơ đồ cũ không còn trong sơ đồ mới
        if (activeFormationPosIds.length > 0) {
          await tx.club_tactic_positions.deleteMany({
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
      if (dto.substitutes !== undefined) {
        const existingSubs = await tx.club_tactic_positions.findMany({
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
            await tx.club_tactic_positions.update({
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
            await tx.club_tactic_positions.create({
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
          await tx.club_tactic_positions.deleteMany({
            where: { id: { in: extraIds } },
          });
        }

      }
    }, { timeout: 10_000 });

    return {
      message: 'Cập nhật chiến thuật, đội hình xuất phát và danh sách dự bị thành công!',
      tactic: await this.getClubTactic(clubId, finalSquadType),
    };
  }
}
