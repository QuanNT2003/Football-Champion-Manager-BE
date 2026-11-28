import { Module } from '@nestjs/common';
import { ClubRankingsService } from './club-rankings.service';

@Module({ providers: [ClubRankingsService], exports: [ClubRankingsService] })
export class ClubRankingsModule {}
