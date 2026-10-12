import { Module } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { ContinentalCoefficientService } from './continental-coefficient.service';
import { SeasonTrophiesService } from './season-trophies.service';

@Module({
  controllers: [CompetitionsController],
  providers: [CompetitionsService, ContinentalCoefficientService, SeasonTrophiesService],
  exports: [CompetitionsService, ContinentalCoefficientService, SeasonTrophiesService],
})
export class CompetitionsModule {}
