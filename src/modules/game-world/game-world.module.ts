import { Module } from '@nestjs/common';
import { GameWorldService } from './game-world.service';
import { GameWorldController } from './game-world.controller';
import { CompetitionsModule } from '../competitions/competitions.module';

@Module({
  imports: [CompetitionsModule],
  controllers: [GameWorldController],
  providers: [GameWorldService],
  exports: [GameWorldService],
})
export class GameWorldModule {}
