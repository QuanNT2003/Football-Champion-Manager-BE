import { BadRequestException, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AcademyService } from './academy.service';

function parseId(value: string) {
  if (!/^[1-9]\d{0,19}$/.test(value) || BigInt(value) > 18446744073709551615n) {
    throw new BadRequestException('ID không hợp lệ');
  }
  return BigInt(value);
}

@ApiTags('Học viện bóng đá trẻ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clubs/:clubId/academy')
export class AcademyController {
  constructor(private readonly academy: AcademyService) {}

  @Get()
  @ApiOperation({ summary: 'Xem học viện và danh sách đội trẻ hiện tại' })
  overview(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string) {
    return this.academy.getOverview(BigInt(user.id), parseId(clubId));
  }

  @Post('recruitment')
  @ApiOperation({ summary: 'Mở lại danh sách ứng viên cố định của mùa hiện tại' })
  recruitment(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string) {
    return this.academy.getRecruitment(BigInt(user.id), parseId(clubId));
  }

  @Post('candidates/:candidateId/sign')
  @ApiOperation({ summary: 'Ký hợp đồng và đưa ứng viên vào đội trẻ U21' })
  sign(@CurrentUser() user: AuthUser, @Param('clubId') clubId: string, @Param('candidateId') candidateId: string) {
    return this.academy.signCandidate(BigInt(user.id), parseId(clubId), parseId(candidateId));
  }
}
