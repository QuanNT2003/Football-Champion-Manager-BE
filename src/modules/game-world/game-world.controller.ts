import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameWorldService } from './game-world.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@ApiTags('Game World & Timeline')
@Controller('game-worlds')
export class GameWorldController {
  constructor(private readonly gameWorldService: GameWorldService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các máy chủ / Game Worlds' })
  async getWorlds() {
    return this.gameWorldService.getWorlds();
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Lấy thông tin tiến độ mùa giải (Season Timeline 40 ngày) của World' })
  async getTimeline(@Param('id') id: string) {
    return this.gameWorldService.getCurrentTimeline(BigInt(id));
  }

  @Post(':id/advance-day')
  @ApiOperation({ summary: 'Chuyển sang ngày tiếp theo của mùa giải (Advance Day loop)' })
  async advanceDay(@Param('id') id: string) {
    return this.gameWorldService.advanceDay(BigInt(id));
  }

  @Post(':id/trigger-day1-auto')
  @ApiOperation({ summary: 'Kích hoạt kiểm tra tự động hóa Day 1: tự động sinh giải đấu và lịch thi đấu' })
  async triggerDay1Auto(@Param('id') id: string) {
    await this.gameWorldService.checkAndTriggerDay1AutoGeneration(BigInt(id));
    return { success: true, message: 'Đã hoàn tất quy trình tự động hóa Day 1 cho World ' + id };
  }

}
