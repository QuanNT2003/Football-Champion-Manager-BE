import { Module } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { ContinentalCoefficientService } from './continental-coefficient.service';

@Module({
  controllers: [CompetitionsController],
  providers: [CompetitionsService, ContinentalCoefficientService],
  exports: [CompetitionsService, ContinentalCoefficientService],
})
export class CompetitionsModule {}

