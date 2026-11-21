import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScheduleTrainingDto } from './dto';

function parseId(value: string) {
  if (!/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18446744073709551615n) {
    throw new BadRequestException('ID không hợp lệ');
  }
  return BigInt(value);
}

@ApiTags('Tập Luyện & Phát Triển Cầu Thủ')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('types')
  @ApiOperation({ summary: 'Danh mục bài tập và các chỉ số tác động' })
  getTrainingTypes() { return this.trainingService.getTrainingTypes(); }

  @Get('club/:clubId/overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cầu thủ, tỷ lệ tập luyện và đề xuất 6 ô của HLV trưởng' })
  @ApiQuery({ name: 'squadType', required: false, enum: ['FIRST_TEAM', 'YOUTH'] })
  overview(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string, @Query('squadType') squadType = 'FIRST_TEAM') {
    return this.trainingService.getOverview(BigInt(user.id), parseId(clubId), squadType);
  }

  @Get('club/:clubId/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử các buổi tập và kết quả đã lưu' })
  getClubSessions(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string) {
    return this.trainingService.getClubSessions(BigInt(user.id), parseId(clubId));
  }

  @Post('club/:clubId/schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thực hiện ngay buổi tập 6 bài, trừ 12 thể lực mỗi cầu thủ' })
  scheduleSession(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string, @Body() dto: ScheduleTrainingDto) {
    return this.trainingService.scheduleSession(BigInt(user.id), parseId(clubId), dto);
  }
}
