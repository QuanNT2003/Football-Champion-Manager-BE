import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface AwardTrophyItem {
  clubId: bigint;
  clubName: string;
  competitionId: bigint;
  competitionName: string;
  seasonId: bigint;
  seasonNumber: number;
  titleType: 'CHAMPION' | 'RUNNER_UP' | 'THIRD_PLACE';
  trophyName: string;
  trophyUrl?: string | null;
  rankPosition: number;
  achievedAt: Date;
}

@Injectable()
export class SeasonTrophiesService {
  private readonly logger = new Logger(SeasonTrophiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. TRAO CÚP TỨC THÌ NGAY SAU TRẬN CHUNG KẾT CÚP (VD: SIÊU CÚP DAY 3, CÚP QG, C1...)
   * Gọi ngay khi một trận đấu kết thúc.
   * Nếu là trận Chung kết và giải đấu chưa trao cúp, trao cúp ngay tức khắc cho Quán quân & Á quân!
   */
  async awardCupFinalTrophyImmediate(matchId: bigint) {
    try {
      const match = await this.prisma.matches.findUnique({
        where: { id: matchId },
        include: {
          competition_seasons: {
            include: {
              competitions: true,
              seasons: true,
            },
          },
          competition_stages: true,
          stage_rounds: true,
          clubs_matches_home_club_idToclubs: true,
          clubs_matches_away_club_idToclubs: true,
        },
      });

      if (!match || match.status !== 'FINISHED' || !match.competition_seasons) {
        return { awarded: false, reason: 'Trận đấu chưa kết thúc hoặc không thuộc mùa giải' };
      }

      const cs = match.competition_seasons;
      const comp = (cs as any).competitions;
      const season = (cs as any).seasons;

      if (!comp || !season) return { awarded: false };

      // Chỉ áp dụng cho giải đấu cấp CLB
      if (comp.participant_type && comp.participant_type !== 'CLUB') {
        return { awarded: false };
      }

      // 1. Kiểm tra cờ chống trùng: Nếu đã trao cúp rồi thì bỏ qua ngay!
      if ((cs as any).is_trophies_awarded) {
        return { awarded: false, reason: 'Giải đấu này đã được trao cúp mùa này' };
      }

      // 2. Kiểm tra xem có phải trận Chung Kết (Final) không:
      // - Hoặc là giải Siêu Cúp (DOMESTIC_SUPER_CUP)
      // - Hoặc tên Stage / Round có chữ 'Chung Kết' / 'Final'
      const isSuperCup = comp.competition_type === 'DOMESTIC_SUPER_CUP';
      const stageName = (match.competition_stages?.name || '').toLowerCase();
      const roundName = (match.stage_rounds?.name || '').toLowerCase();
      const isFinalMatch =
        isSuperCup ||
        stageName.includes('chung kết') ||
        stageName.includes('final') ||
        roundName.includes('chung kết') ||
        roundName.includes('final');

      if (!isFinalMatch) {
        return { awarded: false, reason: 'Không phải trận chung kết' };
      }

      if (!match.home_club_id || !match.away_club_id) {
        return { awarded: false };
      }

      // 3. Xác định Đội Thắng (Quán quân) & Đội Thua (Á quân)
      const winnerId = this.determineMatchWinnerId(match);
      if (!winnerId) return { awarded: false };

      const isHomeWinner = winnerId === match.home_club_id;
      const runnerUpId = isHomeWinner ? match.away_club_id : match.home_club_id;
      const winnerName = isHomeWinner
        ? match.clubs_matches_home_club_idToclubs?.name || 'CLB Vô Địch'
        : match.clubs_matches_away_club_idToclubs?.name || 'CLB Vô Địch';
      const runnerUpName = isHomeWinner
        ? match.clubs_matches_away_club_idToclubs?.name || 'CLB Á Quân'
        : match.clubs_matches_home_club_idToclubs?.name || 'CLB Á Quân';

      const matchDate = match.match_date || new Date();
      const seasonNumber = season.season_number;

      // 4. Lưu vào Database (Dùng try/catch chống trùng lặp theo Unique Key)
      await this.saveTrophySafely({
        clubId: winnerId,
        competitionId: comp.id,
        seasonId: season.id,
        seasonNumber: seasonNumber,
        titleType: 'CHAMPION',
        trophyName: `Vô Địch ${comp.name}`,
        trophyUrl: comp.trophy_url,
        rankPosition: 1,
        achievedAt: matchDate,
      });

      await this.saveTrophySafely({
        clubId: runnerUpId,
        competitionId: comp.id,
        seasonId: season.id,
        seasonNumber: seasonNumber,
        titleType: 'RUNNER_UP',
        trophyName: `Á Quân ${comp.name}`,
        trophyUrl: comp.trophy_url,
        rankPosition: 2,
        achievedAt: matchDate,
      });

      // 5. Đánh dấu cờ is_trophies_awarded = 1 để không bao giờ bị trao lại
      await this.prisma.$executeRaw`
        UPDATE competition_seasons 
        SET is_trophies_awarded = 1 
        WHERE id = ${cs.id}
      `;

      this.logger.log(
        `🏆 [LỄ TRAO CÚP TỨC THÌ] Trận Chung kết ${comp.name} kết thúc! ` +
          `CLB "${winnerName}" xưng vương Quán Quân, CLB "${runnerUpName}" đoạt Á Quân. ` +
          `Đã trao cúp trực tiếp vào Phòng Truyền Thống!`,
      );

      return {
        awarded: true,
        competitionName: comp.name,
        winner: { id: winnerId.toString(), name: winnerName },
        runnerUp: { id: runnerUpId.toString(), name: runnerUpName },
      };
    } catch (err) {
      this.logger.error(`Lỗi khi trao cúp tức thì sau trận ${matchId}:`, err);
      return { awarded: false, error: String(err) };
    }
  }

  /**
   * 2. TỰ ĐỘNG QUÉT CÁC GIẢI ĐẤU ĐÃ KẾT THÚC TRONG NGÀY
   * Được gọi mỗi khi game world chuyển ngày (advanceDay):
   * - Quét các giải Cúp nếu trận chung kết vừa đá xong thì trao ngay.
   * - Quét các giải VĐQG nếu đã hoàn tất toàn bộ vòng đấu thì trao cúp ngay.
   */
  async checkAndAwardCompletedCompetitions(seasonId: bigint) {
    const unawardedCompSeasons = await this.prisma.competition_seasons.findMany({
      where: {
        season_id: seasonId,
        is_trophies_awarded: false,
      },
      include: {
        competitions: true,
        seasons: true,
        competition_stages: {
          include: {
            stage_standings: {
              include: { clubs: true },
              orderBy: [
                { points: 'desc' },
                { goal_difference: 'desc' },
                { goals_for: 'desc' },
              ],
            },
          },
        },
      },
    });

    if (unawardedCompSeasons.length === 0) return { awardedCount: 0 };

    let totalAwardedComps = 0;

    for (const cs of unawardedCompSeasons) {
      const comp = (cs as any).competitions;
      const season = (cs as any).seasons;
      if (!comp || !season) continue;
      if (comp.participant_type && comp.participant_type !== 'CLUB') continue;

      const compType = comp.competition_type;

      // A. Nếu là Giải VĐQG (League) -> Kiểm tra xem toàn bộ các trận đã FINISHED chưa
      if (compType === 'DOMESTIC_LEAGUE' || comp.tier !== null) {
        const totalMatches = await this.prisma.matches.count({
          where: { competition_season_id: cs.id },
        });

        if (totalMatches === 0) continue;

        const unfinishedCount = await this.prisma.matches.count({
          where: {
            competition_season_id: cs.id,
            status: { not: 'FINISHED' },
          },
        });

        // Nếu tất cả các trận của giải đấu đã hoàn thành
        if (unfinishedCount === 0) {
          await this.awardLeagueTrophies(cs, season.season_number);
          totalAwardedComps++;
        }
      }

      // B. Nếu là Giải Cúp Knockout -> Kiểm tra trận Chung Kết
      else {
        const finalMatch = await this.findFinishedFinalMatch(cs.id);
        if (finalMatch && finalMatch.home_club_id && finalMatch.away_club_id) {
          const res = await this.awardCupFinalTrophyImmediate(finalMatch.id);
          if (res.awarded) {
            totalAwardedComps++;
          }
        }
      }
    }

    return { awardedCount: totalAwardedComps };
  }

  /**
   * 3. LƯỚI BẢO VỆ CUỐI MÙA GIẢI (SAFETY NET)
   * Được gọi trong processSeasonTransition (Day 36).
   * Rà soát các giải đấu còn sót chưa có is_trophies_awarded = 1 để trao trọn vẹn.
   */
  async awardSeasonTrophies(seasonId: bigint, fallbackSeasonNumber?: number) {
    this.logger.log(`🏆 [SEASON TROPHIES] Quét bảo vệ cuối mùa cho Mùa giải ID: ${seasonId}...`);

    const season = await this.prisma.seasons.findUnique({
      where: { id: seasonId },
    });
    const seasonNumber = season?.season_number || fallbackSeasonNumber || 1;

    // Chỉ quét các giải đấu CHƯA được trao cúp trong mùa
    const compSeasons = await this.prisma.competition_seasons.findMany({
      where: {
        season_id: seasonId,
        is_trophies_awarded: false,
      },
      include: {
        competitions: true,
        competition_stages: {
          include: {
            stage_standings: {
              include: { clubs: true },
              orderBy: [
                { points: 'desc' },
                { goal_difference: 'desc' },
                { goals_for: 'desc' },
              ],
            },
          },
        },
      },
    });

    let newlyAwardedCount = 0;

    for (const cs of compSeasons) {
      const comp = (cs as any).competitions;
      if (!comp || (comp.participant_type && comp.participant_type !== 'CLUB')) continue;

      if (comp.competition_type === 'DOMESTIC_LEAGUE' || comp.tier !== null) {
        const awarded = await this.awardLeagueTrophies(cs, seasonNumber);
        if (awarded) newlyAwardedCount++;
      } else {
        const finalMatch = await this.findFinishedFinalMatch(cs.id);
        if (finalMatch) {
          const res = await this.awardCupFinalTrophyImmediate(finalMatch.id);
          if (res.awarded) newlyAwardedCount++;
        }
      }
    }

    this.logger.log(
      `🎉 [SEASON TROPHIES HOÀN TẤT] Mùa ${seasonNumber}: Đã xử lý ${newlyAwardedCount} giải đấu trao cúp thành công.`,
    );

    return {
      success: true,
      seasonId: seasonId.toString(),
      seasonNumber,
      totalCompetitionsProcessed: compSeasons.length,
      newlyAwardedCount,
    };
  }

  /**
   * Helper trao cúp cho giải VĐQG dựa trên Standings
   */
  private async awardLeagueTrophies(cs: any, seasonNumber: number): Promise<boolean> {
    const comp = (cs as any).competitions;
    const now = new Date();

    for (const stage of cs.competition_stages) {
      const standings = stage.stage_standings;
      if (!standings || standings.length === 0) continue;

      const stageSuffix = cs.competition_stages.length > 1 ? ` (${stage.name})` : '';

      // Quán quân (Hạng 1)
      if (standings[0]?.club_id) {
        await this.saveTrophySafely({
          clubId: standings[0].club_id,
          competitionId: comp.id,
          seasonId: cs.season_id,
          seasonNumber: seasonNumber,
          titleType: 'CHAMPION',
          trophyName: `Vô Địch ${comp.name}${stageSuffix}`,
          trophyUrl: comp.trophy_url,
          rankPosition: 1,
          achievedAt: now,
        });
      }

      // Á quân (Hạng 2)
      if (standings[1]?.club_id) {
        await this.saveTrophySafely({
          clubId: standings[1].club_id,
          competitionId: comp.id,
          seasonId: cs.season_id,
          seasonNumber: seasonNumber,
          titleType: 'RUNNER_UP',
          trophyName: `Á Quân ${comp.name}${stageSuffix}`,
          trophyUrl: comp.trophy_url,
          rankPosition: 2,
          achievedAt: now,
        });
      }

      // Hạng ba (Hạng 3)
      if (standings[2]?.club_id) {
        await this.saveTrophySafely({
          clubId: standings[2].club_id,
          competitionId: comp.id,
          seasonId: cs.season_id,
          seasonNumber: seasonNumber,
          titleType: 'THIRD_PLACE',
          trophyName: `Hạng Ba ${comp.name}${stageSuffix}`,
          trophyUrl: comp.trophy_url,
          rankPosition: 3,
          achievedAt: now,
        });
      }
    }

    // Đánh dấu đã trao cúp
    await this.prisma.$executeRaw`
      UPDATE competition_seasons 
      SET is_trophies_awarded = 1 
      WHERE id = ${cs.id}
    `;

    return true;
  }

  /**
   * Helper tìm trận Chung kết đã kết thúc của giải đấu
   */
  private async findFinishedFinalMatch(competitionSeasonId: bigint) {
    const finishedMatches = await this.prisma.matches.findMany({
      where: {
        competition_season_id: competitionSeasonId,
        status: 'FINISHED',
        home_score: { not: null },
        away_score: { not: null },
      },
      include: {
        competition_stages: true,
        stage_rounds: true,
      },
      orderBy: [
        { season_day: 'desc' },
        { kickoff_time: 'desc' },
      ],
    });

    if (finishedMatches.length === 0) return null;

    let finalMatch = finishedMatches.find((m) => {
      const rName = (m.stage_rounds?.name || '').toLowerCase();
      const sName = (m.competition_stages?.name || '').toLowerCase();
      return (
        rName.includes('chung kết') ||
        rName.includes('final') ||
        sName.includes('chung kết') ||
        sName.includes('final')
      );
    });

    return finalMatch || finishedMatches[0];
  }

  /**
   * Helper lưu cúp an toàn (Chống trùng lặp tuyệt đối với Unique Key)
   */
  private async saveTrophySafely(data: {
    clubId: bigint;
    competitionId: bigint;
    seasonId: bigint;
    seasonNumber: number;
    titleType: 'CHAMPION' | 'RUNNER_UP' | 'THIRD_PLACE';
    trophyName: string;
    trophyUrl?: string | null;
    rankPosition: number;
    achievedAt: Date;
  }) {
    try {
      const existing = await this.prisma.club_trophies.findFirst({
        where: {
          competition_id: data.competitionId,
          season_id: data.seasonId,
          title_type: data.titleType,
        },
      });

      if (!existing) {
        await this.prisma.club_trophies.create({
          data: {
            club_id: data.clubId,
            competition_id: data.competitionId,
            season_id: data.seasonId,
            season_number: data.seasonNumber,
            title_type: data.titleType,
            trophy_name: data.trophyName,
            trophy_url: data.trophyUrl || null,
            rank_position: data.rankPosition,
            achieved_at: data.achievedAt,
          },
        });
      }
    } catch (err: any) {
      // Bỏ qua lỗi duplicate key nếu có race condition
      if (err.code !== 'P2002') {
        this.logger.warn(`Lỗi khi tạo club_trophies cho CLB ${data.clubId}:`, err.message);
      }
    }
  }

  /**
   * Helper xác định CLB thắng trận Knockout
   */
  private determineMatchWinnerId(match: any): bigint | null {
    if (match.home_score === null || match.away_score === null) return null;
    if (match.home_score > match.away_score) return match.home_club_id;
    if (match.away_score > match.home_score) return match.away_club_id;
    if (match.home_penalty_score !== null && match.away_penalty_score !== null) {
      if (match.home_penalty_score > match.away_penalty_score) return match.home_club_id;
      if (match.away_penalty_score > match.home_penalty_score) return match.away_club_id;
    }
    return match.home_club_id;
  }
}
