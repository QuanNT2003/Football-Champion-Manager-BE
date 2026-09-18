import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface ContinentalPrizeConfig {
  champion: number;
  runnerUp: number;
  semiFinal: number;
  quarterFinal: number;
  round16: number;
  groupWin: number;
  groupDraw: number;
}

@Injectable()
export class ContinentalCoefficientService {
  private readonly logger = new Logger(ContinentalCoefficientService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bảng định mức tiền thưởng Cúp Châu Lục CỐ ĐỊNH (Không phụ thuộc vào rank của quốc gia)
   */
  getContinentalFixedPrizeConfig(): Record<string, ContinentalPrizeConfig> {
    return {
      // Cúp C1: Champions League (comp.id: 8)
      '8': {
        champion: 50000000,
        runnerUp: 30000000,
        semiFinal: 15000000,
        quarterFinal: 8000000,
        round16: 5000000,
        groupWin: 2000000,
        groupDraw: 1000000,
      },
      // Cúp C2: Cup 2 (comp.id: 9) - bằng 60% C1
      '9': {
        champion: 30000000,
        runnerUp: 18000000,
        semiFinal: 9000000,
        quarterFinal: 5000000,
        round16: 3000000,
        groupWin: 1200000,
        groupDraw: 600000,
      },
      // Cúp C3: Cup 3 (comp.id: 10) - bằng 40% C1
      '10': {
        champion: 20000000,
        runnerUp: 12000000,
        semiFinal: 6000000,
        quarterFinal: 3500000,
        round16: 2000000,
        groupWin: 800000,
        groupDraw: 400000,
      },
    };
  }

  /**
   * Phương thức dựng sẵn: Ghi nhận điểm số hệ số ngay khi 1 trận đấu Cúp Châu Lục kết thúc.
   * Dành cho Module Thi Đấu (Match Simulation Engine) gọi sau này.
   */
  async recordMatchResult(matchId: bigint): Promise<{ homeClubPoints: number; awayClubPoints: number; processed: boolean }> {
    const match = await this.prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        competition_seasons: {
          include: { competitions: true },
        },
        clubs_matches_home_club_idToclubs: { select: { id: true, country_id: true } },
        clubs_matches_away_club_idToclubs: { select: { id: true, country_id: true } },
      },
    });

    if (!match || match.competition_seasons?.competitions?.scope !== 'CONTINENTAL' || match.status !== 'COMPLETED') {
      return { homeClubPoints: 0, awayClubPoints: 0, processed: false };
    }

    let homeClubPoints = 0;
    let awayClubPoints = 0;

    const homeScore = match.home_score ?? 0;
    const awayScore = match.away_score ?? 0;

    if (homeScore > awayScore) {
      homeClubPoints = 2.0;
    } else if (awayScore > homeScore) {
      awayClubPoints = 2.0;
    } else {
      homeClubPoints = 1.0;
      awayClubPoints = 1.0;
    }

    this.logger.debug(
      `[recordMatchResult] Trận ${matchId}: Home ${match.home_club_id} (+${homeClubPoints}đ), Away ${match.away_club_id} (+${awayClubPoints}đ)`,
    );

    return { homeClubPoints, awayClubPoints, processed: true };
  }

  /**
   * Tính toán điểm hệ số mùa giải (UEFA-style Coefficient Engine) của tất cả các quốc gia
   * dựa trên toàn bộ kết quả các trận C1, C2, C3 trong mùa vừa qua.
   */
  async calculateSeasonCountryCoefficients(seasonId: bigint): Promise<Map<string, {
    countryId: bigint;
    totalMatchPoints: number;
    bonusPoints: number;
    participatingClubs: number;
    seasonCoefficient: number;
  }>> {
    const result = new Map<string, {
      countryId: bigint;
      totalMatchPoints: number;
      bonusPoints: number;
      participatingClubs: number;
      seasonCoefficient: number;
    }>();

    // 1. Lấy tất cả các trận Cúp Châu Lục đã đá trong mùa
    const continentalMatches = await this.prisma.matches.findMany({
      where: {
        season_id: seasonId,
        competition_seasons: {
          competitions: { scope: 'CONTINENTAL' },
        },
        status: 'COMPLETED',
      },
      include: {
        competition_seasons: { select: { competition_id: true } },
        competition_stages: { select: { name: true, stage_type: true } },
        clubs_matches_home_club_idToclubs: { select: { id: true, country_id: true } },
        clubs_matches_away_club_idToclubs: { select: { id: true, country_id: true } },
      },
    });

    // 2. Tìm tất cả CLB tham gia Cúp Châu Lục mùa này theo từng quốc gia
    const stageTeams = await this.prisma.stage_teams.findMany({
      where: {
        competition_stages: {
          competition_seasons: {
            season_id: seasonId,
            competitions: { scope: 'CONTINENTAL' },
          },
        },
      },
      select: { club_id: true, country_id: true },
    });

    const clubsByCountry = new Map<string, Set<string>>();
    for (const st of stageTeams) {
      if (st.country_id) {
        const cId = st.country_id.toString();
        if (!clubsByCountry.has(cId)) clubsByCountry.set(cId, new Set());
        clubsByCountry.get(cId)!.add(st.club_id.toString());
      }
    }

    // Khởi tạo map kết quả cho các nước có đội tham dự
    clubsByCountry.forEach((clubs, cId) => {
      result.set(cId, {
        countryId: BigInt(cId),
        totalMatchPoints: 0,
        bonusPoints: 0,
        participatingClubs: clubs.size,
        seasonCoefficient: 0,
      });
    });

    // 3. Tính điểm thi đấu từng trận
    for (const m of continentalMatches) {
      const homeCountryId = m.clubs_matches_home_club_idToclubs?.country_id?.toString();
      const awayCountryId = m.clubs_matches_away_club_idToclubs?.country_id?.toString();
      const homeScore = m.home_score ?? 0;
      const awayScore = m.away_score ?? 0;

      if (homeCountryId && result.has(homeCountryId)) {
        const item = result.get(homeCountryId)!;
        if (homeScore > awayScore) item.totalMatchPoints += 2.0;
        else if (homeScore === awayScore) item.totalMatchPoints += 1.0;
      }

      if (awayCountryId && result.has(awayCountryId)) {
        const item = result.get(awayCountryId)!;
        if (awayScore > homeScore) item.totalMatchPoints += 2.0;
        else if (homeScore === awayScore) item.totalMatchPoints += 1.0;
      }

      // Điểm thưởng vượt qua các vòng Knockout (vào Tứ kết/Bán kết/Chung kết)
      const stageName = (m.competition_stages?.name || '').toLowerCase();
      if (stageName.includes('chung kết') || stageName.includes('final')) {
        if (homeCountryId && result.has(homeCountryId)) result.get(homeCountryId)!.bonusPoints += 1.0;
        if (awayCountryId && result.has(awayCountryId)) result.get(awayCountryId)!.bonusPoints += 1.0;
      }
    }

    // 4. Tính hệ số trung bình của từng quốc gia
    result.forEach((item) => {
      const totalPoints = item.totalMatchPoints + item.bonusPoints;
      const divisor = Math.max(1, item.participatingClubs);
      item.seasonCoefficient = Number((totalPoints / divisor).toFixed(4));
    });

    return result;
  }

  /**
   * Cập nhật điểm hệ số tích lũy & xếp hạng lại các quốc gia theo từng Liên đoàn Châu Lục,
   * lưu snapshot mới vào bảng country_rankings cho Mùa giải mới.
   */
  async updateCountryRankingsForNewSeason(worldId: bigint, completedSeasonId: bigint): Promise<{
    updatedCountriesCount: number;
    topCountriesByConfed: Record<string, Array<{ countryName: string; rank: number; previousRank: number; points: number }>>;
  }> {
    const seasonCoeffMap = await this.calculateSeasonCountryCoefficients(completedSeasonId);

    // Lấy toàn bộ quốc gia kèm liên đoàn châu lục
    const allCountries = await this.prisma.countries.findMany({
      include: {
        confederations_countries_confederation_idToconfederations: true,
        country_rankings: {
          where: { world_id: worldId, ranking_type: 'LEAGUE_COEFFICIENT' },
          orderBy: { ranking_date: 'desc' },
          take: 1,
        },
      },
    });

    // Gom nhóm theo Liên đoàn (Confederation)
    const byConfed = new Map<string, Array<{
      countryId: bigint;
      countryName: string;
      confedCode: string;
      oldRank: number;
      oldPoints: number;
      oldCoeff: number;
      seasonCoeff: number;
      newPoints: number;
    }>>();

    for (const c of allCountries) {
      const confed = c.confederations_countries_confederation_idToconfederations;
      const confedCode = confed?.code || 'UEFA';
      if (!byConfed.has(confedCode)) byConfed.set(confedCode, []);

      const lastRanking = c.country_rankings?.[0];
      const oldRank = lastRanking?.rank || 99;
      const oldPoints = Number(lastRanking?.points || 50.0);
      const oldCoeff = Number(lastRanking?.coefficient || 5.0);

      const seasonData = seasonCoeffMap.get(c.id.toString());
      const seasonCoeff = seasonData ? seasonData.seasonCoefficient : 0;
      // Công thức UEFA: Điểm hệ số mới = điểm cũ (chiết khấu mùa cũ) + điểm mùa vừa xong
      const newPoints = Number((oldPoints * 0.8 + seasonCoeff * 10).toFixed(2));

      byConfed.get(confedCode)!.push({
        countryId: c.id,
        countryName: c.name,
        confedCode,
        oldRank,
        oldPoints,
        oldCoeff,
        seasonCoeff,
        newPoints,
      });
    }

    let updatedCountriesCount = 0;
    const topCountriesByConfed: Record<string, any[]> = {};
    const rankingDate = new Date();

    for (const [confedCode, countryList] of byConfed.entries()) {
      // Sắp xếp các quốc gia trong liên đoàn theo điểm hệ số mới giảm dần
      countryList.sort((a, b) => b.newPoints - a.newPoints);

      topCountriesByConfed[confedCode] = [];

      for (let r = 0; r < countryList.length; r++) {
        const item = countryList[r];
        const newRank = r + 1;

        // Lưu snapshot mới vào country_rankings
        await this.prisma.country_rankings.create({
          data: {
            world_id: worldId,
            country_id: item.countryId,
            ranking_type: 'LEAGUE_COEFFICIENT',
            ranking_date: rankingDate,
            rank: newRank,
            previous_rank: item.oldRank,
            points: item.newPoints,
            coefficient: Number((item.newPoints / 10).toFixed(4)),
          },
        });

        updatedCountriesCount++;

        if (newRank <= 4) {
          topCountriesByConfed[confedCode].push({
            countryName: item.countryName,
            rank: newRank,
            previousRank: item.oldRank,
            points: item.newPoints,
          });
        }
      }
    }

    this.logger.log(`✅ [updateCountryRankingsForNewSeason] Đã xếp hạng lại thành công ${updatedCountriesCount} quốc gia theo hệ số mới.`);

    return {
      updatedCountriesCount,
      topCountriesByConfed,
    };
  }

  /**
   * Tra cứu hệ số nhân tiền thưởng giải VĐQG mùa mới (Prize Multiplier) dựa trên thứ hạng quốc gia
   */
  async getCountryPrizeMultiplier(countryId: bigint): Promise<number> {
    const latestRank = await this.prisma.country_rankings.findFirst({
      where: { country_id: countryId, ranking_type: 'LEAGUE_COEFFICIENT' },
      orderBy: { ranking_date: 'desc' },
      select: { rank: true },
    });

    const rank = latestRank?.rank || 20;

    // Nhóm 1: Top 1-4 (Anh, TBN, Ý, Đức...) -> Thưởng x2.0
    if (rank <= 4) return 2.0;
    // Nhóm 2: Hạng 5-10 (Pháp, Hà Lan...) -> Thưởng x1.5
    if (rank <= 10) return 1.5;
    // Nhóm 3: Hạng 11-18 -> Thưởng x1.2
    if (rank <= 18) return 1.2;
    // Nhóm 4: Hạng 19-25 -> Chuẩn cơ sở x1.0
    if (rank <= 25) return 1.0;
    // Nhóm 5: Hạng 26+ -> Giải cấp thấp x0.8
    return 0.8;
  }

  /**
   * Trao tiền thưởng Cúp Châu Lục CỐ ĐỊNH 100% cho các CLB tham dự (Không phân biệt quốc gia)
   */
  async distributeContinentalFixedPrizes(completedSeason: any): Promise<{
    totalContinentalPrizes: number;
    clubsRewardedCount: number;
  }> {
    let totalContinentalPrizes = 0;
    let clubsRewardedCount = 0;

    const prizeConfigs = this.getContinentalFixedPrizeConfig();

    const continentalCompSeasons = await this.prisma.competition_seasons.findMany({
      where: {
        season_id: completedSeason.id,
        competitions: { scope: 'CONTINENTAL' },
      },
      include: {
        competitions: true,
        competition_stages: {
          include: {
            stage_standings: {
              include: { clubs: true },
              orderBy: [{ points: 'desc' }, { goal_difference: 'desc' }],
            },
          },
        },
      },
    });

    for (const cs of continentalCompSeasons) {
      const compIdStr = cs.competition_id.toString();
      const cfg = prizeConfigs[compIdStr] || prizeConfigs['8'];

      for (const stage of cs.competition_stages) {
        const standings = stage.stage_standings || [];
        for (let i = 0; i < standings.length; i++) {
          const s = standings[i];
          const rank = i + 1;
          let prize = 0;

          // Thưởng thành tích vòng bảng / chung cuộc Cúp Châu Lục
          if (rank === 1) prize = cfg.champion;
          else if (rank === 2) prize = cfg.runnerUp;
          else if (rank <= 4) prize = cfg.semiFinal;
          else if (rank <= 8) prize = cfg.quarterFinal;
          else if (rank <= 16) prize = cfg.round16;
          else prize = cfg.groupWin;

          if (prize > 0 && s.club_id) {
            let account = await this.prisma.financial_accounts.findFirst({
              where: { club_id: s.club_id },
            });
            if (!account) {
              account = await this.prisma.financial_accounts.create({
                data: { club_id: s.club_id, balance_cash: 0, balance_gold: 0, status: 'ACTIVE' },
              });
            }

            await this.prisma.financial_accounts.update({
              where: { id: account.id },
              data: { balance_cash: { increment: prize } },
            });

            const idempotencyKey = `CONT_PRIZE_${account.id}_${completedSeason.id}_${cs.id}_${s.club_id}`;
            try {
              await this.prisma.financial_transactions.create({
                data: {
                  club_id: s.club_id,
                  financial_account_id: account.id,
                  type: 'PRIZE_MONEY',
                  category: 'CONTINENTAL_CUP_PRIZE',
                  amount: prize,
                  currency_type: 'CASH',
                  reference_type: 'COMPETITION_SEASON',
                  reference_id: cs.id,
                  season_id: completedSeason.id,
                  season_day: completedSeason.total_days || 40,
                  description: `Tiền thưởng Cố Định ${cs.name} (Hạng ${rank}) - Mùa ${completedSeason.season_number}`,
                  transaction_date: new Date(),
                  idempotency_key: idempotencyKey,
                },
              });
            } catch (e) {
              // Bỏ qua nếu trùng key
            }

            totalContinentalPrizes += prize;
            clubsRewardedCount++;
          }
        }
      }
    }

    return { totalContinentalPrizes, clubsRewardedCount };
  }
}
