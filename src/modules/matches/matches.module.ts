import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchSimulatorService } from './match-simulator.service';
import { MatchesGateway } from './matches.gateway';
import { MatchLineupService } from './match-lineup.service';
import { MatchResultService } from './match-result.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, MatchSimulatorService, MatchLineupService, MatchResultService, MatchesGateway],
  exports: [MatchesService, MatchSimulatorService],
})
export class MatchesModule {}
