import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface SimEvent {
  minute: number;
  eventType: 'GOAL' | 'ASSIST' | 'YELLOW_CARD' | 'RED_CARD' | 'INJURY' | 'SHOT_SAVED';
  clubId: bigint;
  playerId: bigint;
  playerName: string;
  relatedPlayerId?: bigint;
  relatedPlayerName?: string;
  description: string;
}

@Injectable()
export class MatchSimulatorService {
  private readonly logger = new Logger(MatchSimulatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async simulateMatch(matchId: bigint) {
    const match = await this.prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        clubs_matches_home_club_idToclubs: {
          include: {
            stadiums: true,
            financial_accounts: true,
          },
        },
        clubs_matches_away_club_idToclubs: true,
      },
    });

    if (!match) {
      throw new Error('Trận đấu không tồn tại');
    }

    if (match.status === 'FINISHED') {
      return { message: 'Trận đấu này đã kết thúc', matchId: matchId.toString() };
    }

    const homeClub = match.clubs_matches_home_club_idToclubs;
    const awayClub = match.clubs_matches_away_club_idToclubs;

    if (!homeClub || !awayClub) {
      throw new Error('Trận đấu phải có cả CLB chủ nhà và đội khách');
    }

    const [homePlayers, awayPlayers] = await Promise.all([
      this.prisma.players.findMany({
        where: { current_club_id: homeClub.id, squad_type: 'FIRST_TEAM' },
        take: 16,
        orderBy: { reputation: 'desc' },
      }),
      this.prisma.players.findMany({
        where: { current_club_id: awayClub.id, squad_type: 'FIRST_TEAM' },
        take: 16,
        orderBy: { reputation: 'desc' },
      }),
    ]);

    const homeRep = homePlayers.reduce((acc, p) => acc + p.reputation, 0) / Math.max(1, homePlayers.length);
    const awayRep = awayPlayers.reduce((acc, p) => acc + p.reputation, 0) / Math.max(1, awayPlayers.length);

    const homeAdvantage = 1.08;
    const homeStrength = homeRep * homeAdvantage;
    const awayStrength = awayRep;

    const ratio = homeStrength / (homeStrength + awayStrength);
    let homeScore = 0;
    let awayScore = 0;
    const events: SimEvent[] = [];

    const periods = [8, 17, 26, 34, 42, 53, 62, 71, 80, 89];

    for (const minute of periods) {
      const chanceRoll = Math.random();

      if (chanceRoll < 0.45) {
        const isHomeChance = Math.random() < ratio;
        const attackingTeam = isHomeChance ? homeClub : awayClub;
        const attackingPlayers = isHomeChance ? homePlayers : awayPlayers;
        const defendingTeam = isHomeChance ? awayClub : homeClub;

        if (attackingPlayers.length === 0) continue;

        const scorer = attackingPlayers[Math.floor(Math.random() * Math.min(5, attackingPlayers.length))];
        const assistCandidate = attackingPlayers.find((p) => p.id !== scorer.id);

        const goalRoll = Math.random();
        if (goalRoll < 0.35) {
          if (isHomeChance) homeScore++;
          else awayScore++;

          events.push({
            minute,
            eventType: 'GOAL',
            clubId: attackingTeam.id,
            playerId: scorer.id,
            playerName: `${scorer.first_name} ${scorer.last_name}`.trim(),
            relatedPlayerId: assistCandidate?.id,
            relatedPlayerName: assistCandidate ? `${assistCandidate.first_name} ${assistCandidate.last_name}`.trim() : undefined,
            description: `VÀOOO! ${scorer.first_name} ${scorer.last_name} ghi bàn cho ${attackingTeam.name}!`,
          });
        } else if (goalRoll < 0.65) {
          events.push({
            minute,
            eventType: 'SHOT_SAVED',
            clubId: attackingTeam.id,
            playerId: scorer.id,
            playerName: `${scorer.first_name} ${scorer.last_name}`.trim(),
            description: `Cơ hội nguy hiểm! Pha dứt điểm hiểm hóc của ${scorer.last_name} bị thủ môn ${defendingTeam.name} cản phá xuất sắc.`,
          });
        }
      }

      if (Math.random() < 0.12) {
        const isHomeFoul = Math.random() < 0.5;
        const foulTeam = isHomeFoul ? homeClub : awayClub;
        const players = isHomeFoul ? homePlayers : awayPlayers;
        if (players.length > 0) {
          const carded = players[Math.floor(Math.random() * players.length)];
          events.push({
            minute,
            eventType: 'YELLOW_CARD',
            clubId: foulTeam.id,
            playerId: carded.id,
            playerName: `${carded.first_name} ${carded.last_name}`.trim(),
            description: `Thẻ vàng! ${carded.first_name} ${carded.last_name} phạm lỗi thô bạo.`,
          });
        }
      }
    }

    const stadium = homeClub.stadiums?.[0];
    const capacity = stadium?.capacity || 25000;
    const ticketPrice = 25.0;
    const avgReputation = (homeClub.reputation + awayClub.reputation) / 20000;
    const fillPercentage = Math.min(0.98, Math.max(0.4, 0.5 + avgReputation * 0.4));
    const attendance = Math.floor(capacity * fillPercentage);
    const ticketRevenue = attendance * ticketPrice;
    const fin = homeClub.financial_accounts?.[0];

    await this.prisma.$transaction(async (tx) => {
      await tx.matches.update({
        where: { id: matchId },
        data: {
          home_score: homeScore,
          away_score: awayScore,
          home_regular_score: homeScore,
          away_regular_score: awayScore,
          status: 'FINISHED',
          attendance,
          ticket_revenue: ticketRevenue,
        },
      });

      for (const ev of events) {
        await tx.match_events.create({
          data: {
            match_id: matchId,
            minute: ev.minute,
            event_type: ev.eventType,
            club_id: ev.clubId,
            player_id: ev.playerId,
            related_player_id: ev.relatedPlayerId,
            metadata: { description: ev.description },
          },
        });
      }

      if (fin) {
        await tx.financial_accounts.update({
          where: { id: fin.id },
          data: { balance_cash: { increment: ticketRevenue } },
        });

        await tx.financial_transactions.create({
          data: {
            club_id: homeClub.id,
            financial_account_id: fin.id,
            type: 'MATCHDAY_TICKET_INCOME',
            category: 'MATCHDAY',
            amount: ticketRevenue,
            currency_type: 'CASH',
            reference_type: 'MATCH',
            reference_id: matchId,
            description: `Doanh thu bán vé trận đấu (${attendance.toLocaleString()} khán giả)`,
            transaction_date: new Date(),
            idempotency_key: `MATCH_TICKET_${matchId}_${Date.now()}`,
          },
        });
      }
    });

    this.logger.log(`Match ${matchId} simulated: ${homeClub.name} ${homeScore} - ${awayScore} ${awayClub.name}`);

    return {
      matchId: matchId.toString(),
      homeClub: homeClub.name,
      awayClub: awayClub.name,
      homeScore,
      awayScore,
      attendance,
      ticketRevenue,
      events,
    };
  }
}
