import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { GameWorldModule } from './modules/game-world/game-world.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { PlayersModule } from './modules/players/players.module';
import { TacticsModule } from './modules/tactics/tactics.module';
import { MatchesModule } from './modules/matches/matches.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { FinancesModule } from './modules/finances/finances.module';
import { TrainingModule } from './modules/training/training.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    GameWorldModule,
    ClubsModule,
    PlayersModule,
    TacticsModule,
    MatchesModule,
    CompetitionsModule,
    TransfersModule,
    FinancesModule,
    TrainingModule,
  ],
})
export class AppModule {}
