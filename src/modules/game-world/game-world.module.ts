import { Module } from '@nestjs/common';
import { GameWorldService } from './game-world.service';
import { GameWorldController } from './game-world.controller';

@Module({
  controllers: [GameWorldController],
  providers: [GameWorldService],
  exports: [GameWorldService],
})
export class GameWorldModule {}
