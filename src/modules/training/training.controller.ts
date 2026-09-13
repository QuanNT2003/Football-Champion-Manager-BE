import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

class ScheduleTrainingDto {
  trainingTypeId: string;
  intensity?: number;
}

@ApiTags('Tập Luyện & Phát Triển Cầu Thủ')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('types')
  @ApiOperation({ summary: 'Lấy danh mục các bài tập huấn luyện' })
  async getTrainingTypes() {
    return this.trainingService.getTrainingTypes();
  }

  @Get('club/:clubId/sessions')
  @ApiOperation({ summary: 'Lấy các buổi tập gần đây của CLB' })
  async getClubSessions(@Param('clubId') clubId: string) {
    return this.trainingService.getClubSessions(BigInt(clubId));
  }

  @Post('club/:clubId/schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lên lịch buổi tập mới cho CLB' })
  async scheduleSession(
    @Param('clubId') clubId: string,
    @Body() dto: ScheduleTrainingDto,
  ) {
    return this.trainingService.scheduleSession(BigInt(clubId), dto);
  }
}
