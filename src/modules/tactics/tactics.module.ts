import { Module } from '@nestjs/common';
import { TacticsService } from './tactics.service';
import { TacticsController } from './tactics.controller';

@Module({
  controllers: [TacticsController],
  providers: [TacticsService],
  exports: [TacticsService],
})
export class TacticsModule {}
