import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchSimulatorService } from './match-simulator.service';
import { MatchesGateway } from './matches.gateway';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, MatchSimulatorService, MatchesGateway],
  exports: [MatchesService, MatchSimulatorService],
})
export class MatchesModule {}
