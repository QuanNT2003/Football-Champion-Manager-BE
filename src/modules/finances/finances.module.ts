import { Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';
import { SponsorshipsService } from './sponsorships.service';

@Module({
  controllers: [FinancesController],
  providers: [FinancesService, SponsorshipsService],
  exports: [FinancesService],
})
export class FinancesModule {}
