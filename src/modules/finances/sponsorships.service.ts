import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MAX_SPONSORSHIPS, rollSponsorshipAmount, selectSponsors, sponsorshipProfile } from './sponsorship.rules';

@Injectable()
export class SponsorshipsService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(tx: Prisma.TransactionClient, userId: bigint, clubId: bigint) {
    // Same lock order as facility upgrades; serializes opening/signing across tabs.
    await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${clubId} FOR UPDATE`;
    const club = await tx.clubs.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException({ code: 'SPONSORSHIP_CLUB_NOT_FOUND', message: 'Không tìm thấy CLB' });
    if (club.owner_user_id !== userId) throw new ForbiddenException({ code: 'SPONSORSHIP_FORBIDDEN', message: 'Bạn không có quyền quản lý CLB này' });
    await tx.$queryRaw`SELECT id FROM seasons WHERE world_id = ${club.world_id} AND status = 'ACTIVE' ORDER BY season_number DESC LIMIT 1 FOR UPDATE`;
    const season = await tx.seasons.findFirst({ where: { world_id: club.world_id, status: 'ACTIVE' }, orderBy: { season_number: 'desc' } });
    if (!season) throw new BadRequestException({ code: 'SPONSORSHIP_NO_ACTIVE_SEASON', message: 'Thế giới chưa có mùa giải đang hoạt động' });
    // Compatibility: contracts created before season_id was introduced still occupy slots.
    await tx.club_sponsorships.updateMany({
      where: { club_id: clubId, season_id: null, status: 'ACTIVE', OR: [{ end_date: null }, { end_date: { gte: season.start_date } }] },
      data: { season_id: season.id },
    });
    await tx.club_sponsorships.updateMany({
      where: { club_id: clubId, status: { in: ['ACTIVE', 'OFFERED'] }, OR: [
        { season_id: { not: season.id } }, { season_id: null, end_date: { lt: season.start_date } },
      ] },
      data: { status: 'EXPIRED' },
    });
    const facility = await tx.facilities.findFirst({
      where: { club_id: clubId, facility_types: { code: 'COMMERCIAL_OFFICE' }, status: { in: ['OPERATIONAL', 'ACTIVE', 'UPGRADING'] } },
      include: { facility_levels: true },
    });
    const financeLevel = facility?.facility_levels.level ?? 0;
    return { club, season, financeLevel };
  }

  private async summary(tx: Prisma.TransactionClient, context: Awaited<ReturnType<SponsorshipsService['context']>>) {
    const { club, season, financeLevel } = context;
    const rows = await tx.club_sponsorships.findMany({
      where: { club_id: club.id, season_id: season.id }, include: { sponsors: true }, orderBy: [{ amount: 'desc' }, { id: 'asc' }],
    });
    const contracts = rows.filter(row => row.status === 'ACTIVE');
    // Count signed then cancelled/expired rows too: four signatures per season.
    const signedCount = rows.filter(row => row.status !== 'OFFERED').length;
    return {
      season_id: season.id, season_name: season.name, season_number: season.season_number, reputation: club.reputation,
      finance_level: financeLevel, max_contracts: MAX_SPONSORSHIPS, signed_count: signedCount,
      available_slots: Math.max(0, MAX_SPONSORSHIPS - signedCount),
      total_income: contracts.reduce((sum, row) => sum + Number(row.amount), 0),
      offers: rows.filter(row => row.status === 'OFFERED').map(row => this.serialize(row)),
      contracts: contracts.map(row => this.serialize(row)),
    };
  }

  private serialize(row: { id: bigint; sponsor_id: bigint; amount: Prisma.Decimal; start_date: Date; end_date: Date | null; status: string; sponsors: { name: string; industry: string; description: string | null; logo_url: string | null } }) {
    return {
      id: row.id, sponsor_id: row.sponsor_id, amount: Number(row.amount), status: row.status,
      start_date: row.start_date, end_date: row.end_date,
      name: row.sponsors.name, industry: row.sponsors.industry,
      description: row.sponsors.description, logo_url: row.sponsors.logo_url,
    };
  }

  async getSponsorships(userId: bigint, clubId: bigint) {
    return this.prisma.$transaction(async tx => {
      const context = await this.context(tx, userId, clubId);
      return this.summary(tx, context);
    }, { isolationLevel: 'ReadCommitted' });
  }

  async openOffers(userId: bigint, clubId: bigint) {
    return this.prisma.$transaction(async tx => {
      const context = await this.context(tx, userId, clubId);
      const { club, season, financeLevel } = context;
      const existing = await tx.club_sponsorships.count({ where: { club_id: clubId, season_id: season.id } });
      if (existing < MAX_SPONSORSHIPS) {
        const currency = await tx.currencies.findUnique({ where: { code: 'CASH' } });
        if (!currency?.is_active || currency.type !== 'SOFT') throw new BadRequestException({ code: 'SPONSORSHIP_CASH_NOT_CONFIGURED', message: 'Chưa cấu hình tiền CASH' });
        const profile = sponsorshipProfile(club.reputation, financeLevel);
        const sponsors = selectSponsors(await tx.sponsors.findMany({ where: { club_sponsorships: { none: { club_id: clubId, season_id: season.id } } }, orderBy: { id: 'asc' } }), profile.offerCount - existing, profile.appeal);
        if (!sponsors.length) throw new BadRequestException({ code: 'SPONSORSHIP_NO_SPONSORS', message: 'Chưa có nhà tài trợ trong hệ thống' });
        await tx.club_sponsorships.createMany({ data: sponsors.map(sponsor => ({
          club_id: clubId, sponsor_id: sponsor.id, season_id: season.id,
          start_date: new Date(), end_date: season.end_date,
          amount: rollSponsorshipAmount(profile.appeal), currency_id: currency.id, status: 'OFFERED',
        })) });
      }
      return this.summary(tx, context);
    }, { isolationLevel: 'ReadCommitted' });
  }

  async sign(userId: bigint, clubId: bigint, offerId: bigint) {
    return this.prisma.$transaction(async tx => {
      const context = await this.context(tx, userId, clubId);
      const { season } = context;
      const offer = await tx.club_sponsorships.findFirst({ where: { id: offerId, club_id: clubId, season_id: season.id }, include: { sponsors: true } });
      if (!offer) throw new NotFoundException({ code: 'SPONSORSHIP_OFFER_NOT_FOUND', message: 'Lời mời tài trợ không tồn tại trong mùa này' });
      if (offer.status !== 'OFFERED') throw new ConflictException({ code: 'SPONSORSHIP_OFFER_UNAVAILABLE', message: 'Hợp đồng này đã được ký hoặc hết hiệu lực' });
      const signed = await tx.club_sponsorships.count({ where: { club_id: clubId, season_id: season.id, status: { not: 'OFFERED' } } });
      const active = await tx.club_sponsorships.count({ where: { club_id: clubId, status: 'ACTIVE' } });
      if (signed >= MAX_SPONSORSHIPS || active >= MAX_SPONSORSHIPS) throw new ConflictException({ code: 'SPONSORSHIP_LIMIT_REACHED', message: 'Mỗi CLB chỉ được ký tối đa 4 hợp đồng tài trợ trong một mùa' });
      const account = await tx.financial_accounts.findFirst({ where: { club_id: clubId }, orderBy: { id: 'asc' } });
      if (!account) throw new NotFoundException({ code: 'SPONSORSHIP_ACCOUNT_NOT_FOUND', message: 'Tài khoản tài chính không tồn tại' });
      await tx.club_sponsorships.update({ where: { id: offer.id }, data: { status: 'ACTIVE', start_date: new Date() } });
      await tx.financial_accounts.update({ where: { id: account.id }, data: { balance_cash: { increment: offer.amount } } });
      await tx.financial_transactions.create({ data: {
        club_id: clubId, financial_account_id: account.id, type: 'SPONSORSHIP', category: 'SPONSORSHIP',
        amount: offer.amount, currency_type: 'CASH', reference_type: 'CLUB_SPONSORSHIP', reference_id: offer.id,
        description: `Tài trợ ${offer.sponsors.name} - ${season.name}`, season_id: season.id, season_day: season.current_day,
        transaction_date: new Date(), idempotency_key: `SPONSORSHIP_${offer.id}`,
      } });
      return this.summary(tx, context);
    }, { isolationLevel: 'ReadCommitted' });
  }
}
