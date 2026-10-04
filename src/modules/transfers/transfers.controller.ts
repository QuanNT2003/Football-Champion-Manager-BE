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
import {
  MakeOfferDto,
  RespondOfferDto,
  CancelOfferDto,
  MakeStaffOfferDto,
  HireStaffDto,
  GetMarketFilterDto,
} from './dto';

function parseOptionalNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy lời đề nghị chuyển nhượng đã gửi (PUT)' })
  async cancelOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body?: CancelOfferDto,
  ) {
    const clubId = body?.club_id ? BigInt(body.club_id) : (body?.clubId ? BigInt(body.clubId) : (user?.clubId ? BigInt(user.clubId) : undefined));
    return this.transfersService.cancelOffer(BigInt(id), clubId);
  }

  @Post('offers/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy lời đề nghị chuyển nhượng đã gửi (POST alias)' })
  async cancelOfferPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body?: CancelOfferDto,
  ) {
    return this.cancelOffer(user, id, body);
  }

  @Put('offers/:id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận hoặc từ chối đề nghị chuyển nhượng (PUT)' })
  async respondOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondOfferDto,
  ) {
    const clubId = dto.club_id ? BigInt(dto.club_id) : (user?.clubId ? BigInt(user.clubId) : undefined);
    if (!clubId) {
      throw new Error('Thiếu thông tin CLB quyết định đề nghị (club_id)');
    }
    return this.transfersService.respondOffer(BigInt(id), clubId, dto.response);
  }

  @Post('offers/:id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận hoặc từ chối đề nghị chuyển nhượng (POST alias)' })
  async respondOfferPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondOfferDto,
  ) {
    return this.respondOffer(user, id, dto);
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
    @Body() body: HireStaffDto,
  ) {
    return this.transfersService.hireStaff(BigInt(body.clubId), BigInt(body.staffId));
  }

  @Get('staff/:id')
  @ApiOperation({ summary: 'Lấy chi tiết hồ sơ & chỉ số năng lực của nhân sự' })
  @ApiQuery({ name: 'clubId', required: false, description: 'ID CLB của người dùng để check đề nghị hiện tại' })
  async getStaffDetail(
    @Param('id') id: string,
    @Query('clubId') clubId?: string,
  ) {
    return this.transfersService.getStaffDetail(BigInt(id), clubId ? BigInt(clubId) : undefined);
  }

  @Post('staff-offers')
  @ApiOperation({ summary: 'Gửi hoặc cập nhật lời đề nghị tuyển mộ nhân sự' })
  async makeStaffOffer(@Body() body: MakeStaffOfferDto) {
    return this.transfersService.makeStaffOffer({
      staff_id: body.staff_id,
      club_id: body.club_id,
      role_offered: body.role_offered,
      proposed_wage: body.proposed_wage !== undefined ? Number(body.proposed_wage) : undefined,
      contract_years: body.contract_years !== undefined ? Number(body.contract_years) : undefined,
      signing_bonus: body.signing_bonus !== undefined ? Number(body.signing_bonus) : undefined,
    });
  }

  @Get('staff-offers/club/:clubId')
  @ApiOperation({ summary: 'Lấy danh sách các đề nghị tuyển mộ staff của CLB' })
  async getStaffOffers(@Param('clubId') clubId: string) {
    return this.transfersService.getStaffOffers(BigInt(clubId));
  }

  @Put('staff-offers/:id/cancel')
  @ApiOperation({ summary: 'Hủy lời đề nghị tuyển mộ nhân sự' })
  async cancelStaffOffer(
    @Param('id') id: string,
    @Body() body: CancelOfferDto,
  ) {
    const targetClubId = body?.club_id || body?.clubId;
    return this.transfersService.cancelStaffOffer(BigInt(id), targetClubId ? BigInt(targetClubId) : undefined);
  }

  @Get('club/:clubId/staff')
  @ApiOperation({ summary: 'Lấy danh sách ban huấn luyện và nhân sự của CLB' })
  async getClubStaff(@Param('clubId') clubId: string) {
    return this.transfersService.getClubStaff(BigInt(clubId));
  }
}
