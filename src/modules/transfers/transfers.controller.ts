import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';

function parseOptionalNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}

class MakeOfferDto {
  playerId: string;
  toClubId: string;
  offerAmount: number;
  isLoan?: boolean;
  proposedWage?: number;
  contractYears?: number;
}

class RespondOfferDto {
  clubId: string;
  response: 'ACCEPTED' | 'REJECTED';
}

@ApiTags('Thị Trường Chuyển Nhượng')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get('filter-options')
  @ApiOperation({ summary: 'Lấy danh sách các tùy chọn lọc (Quốc gia, 40 Kỹ năng thuộc 4 nhóm)' })
  async getFilterOptions() {
    return this.transfersService.getFilterOptions();
  }

  @Get('market')
  @ApiOperation({ summary: 'Xem danh sách cầu thủ trên thị trường chuyển nhượng/cho mượn/tự do' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['ALL', 'FREE', 'LOAN', 'TRANSFER'] })
  @ApiQuery({ name: 'isLoan', required: false, type: Boolean })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiQuery({ name: 'minAge', required: false })
  @ApiQuery({ name: 'maxAge', required: false })
  @ApiQuery({ name: 'nationalityId', required: false })
  @ApiQuery({ name: 'minOvr', required: false })
  @ApiQuery({ name: 'maxOvr', required: false })
  @ApiQuery({ name: 'attributes', required: false, description: 'JSON string of { attributeId: minValue }' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'position', required: false })
  async getMarket(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: 'ALL' | 'FREE' | 'LOAN' | 'TRANSFER',
    @Query('isLoan') isLoan?: boolean,
    @Query('minPrice') minPrice?: any,
    @Query('maxPrice') maxPrice?: any,
    @Query('minAge') minAge?: any,
    @Query('maxAge') maxAge?: any,
    @Query('nationalityId') nationalityId?: string,
    @Query('minOvr') minOvr?: any,
    @Query('maxOvr') maxOvr?: any,
    @Query('attributes') attributes?: string,
    @Query('search') search?: string,
    @Query('position') position?: string,
  ) {
    return this.transfersService.getMarket({
      page: parseOptionalNumber(page) || 1,
      limit: parseOptionalNumber(limit) || 20,
      status,
      isLoan: isLoan !== undefined ? Boolean(isLoan) : undefined,
      minPrice: parseOptionalNumber(minPrice),
      maxPrice: parseOptionalNumber(maxPrice),
      minAge: parseOptionalNumber(minAge),
      maxAge: parseOptionalNumber(maxAge),
      nationalityId: nationalityId && nationalityId !== '' ? nationalityId : undefined,
      minOvr: parseOptionalNumber(minOvr),
      maxOvr: parseOptionalNumber(maxOvr),
      attributes,
      search: search && search.trim() ? search.trim() : undefined,
      position: position && position !== 'ALL' ? position : undefined,
    });
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi lời đề nghị mua hoặc mượn cầu thủ' })
  async makeOffer(
    @CurrentUser() user: AuthUser,
    @Body() dto: MakeOfferDto,
  ) {
    if (!user.clubId) {
      throw new Error('Bạn cần quản lý một CLB để tham gia chuyển nhượng');
    }
    return this.transfersService.makeOffer(BigInt(user.clubId), dto);
  }

  @Get('offers/club/:clubId/player/:playerId')
  @ApiOperation({ summary: 'Lấy đề nghị chuyển nhượng gần nhất của CLB cho cầu thủ' })
  async getPlayerOffer(
    @Param('clubId') clubId: string,
    @Param('playerId') playerId: string,
  ) {
    return this.transfersService.getPlayerOffer(BigInt(clubId), BigInt(playerId));
  }

  @Get('offers/club/:clubId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách các đề nghị chuyển nhượng đến và đi của CLB' })
  async getOffersForClub(@Param('clubId') clubId: string) {
    return this.transfersService.getOffersForClub(BigInt(clubId));
  }

  @Get('club/:clubId/offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách các đề nghị chuyển nhượng đến và đi của CLB (alias)' })
  async getClubOffersAlias(@Param('clubId') clubId: string) {
    return this.transfersService.getOffersForClub(BigInt(clubId));
  }

  @Put('offers/:id/cancel')
  @Post('offers/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy lời đề nghị chuyển nhượng đã gửi' })
  async cancelOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body?: { clubId?: string },
  ) {
    const clubId = body?.clubId ? BigInt(body.clubId) : (user?.clubId ? BigInt(user.clubId) : undefined);
    return this.transfersService.cancelOffer(BigInt(id), clubId);
  }

  @Put('offers/:id/respond')
  @Post('offers/:id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận hoặc từ chối đề nghị chuyển nhượng' })
  async respondOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const responseType = (dto.response || dto.action) as 'ACCEPTED' | 'REJECTED';
    const clubId = dto.clubId ? BigInt(dto.clubId) : (user?.clubId ? BigInt(user.clubId) : undefined);
    if (!clubId) {
      throw new Error('Thiếu thông tin CLB quyết định đề nghị');
    }
    return this.transfersService.respondOffer(BigInt(id), clubId, responseType);
  }

  @Get('staff-market')
  @ApiOperation({ summary: 'Xem danh sách nhân viên tự do trên thị trường (HLV, Trợ lý, Thể lực...)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'role', required: false, example: 'HEAD_COACH' })
  @ApiQuery({ name: 'search', required: false })
  async getStaffMarket(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    return this.transfersService.getStaffMarket(
      Number(page),
      Number(limit),
      role,
      search,
    );
  }

  @Post('hire-staff')
  @ApiOperation({ summary: 'Ký hợp đồng tuyển dụng nhân viên tự do cho CLB' })
  async hireStaff(
    @Body() body: { clubId: string; staffId: string },
  ) {
    return this.transfersService.hireStaff(BigInt(body.clubId), BigInt(body.staffId));
  }
}
