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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chuyển sang ngày tiếp theo của mùa giải (Advance Day loop)' })
  async advanceDay(@Param('id') id: string) {
    return this.gameWorldService.advanceDay(BigInt(id));
  }
}
