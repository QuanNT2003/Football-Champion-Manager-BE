import { Module } from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { FacilityUpgradeScheduler } from './facility-upgrade.scheduler';

@Module({
  controllers: [ClubsController],
  providers: [ClubsService, FacilityUpgradeScheduler],
  exports: [ClubsService],
})
export class ClubsModule {}
