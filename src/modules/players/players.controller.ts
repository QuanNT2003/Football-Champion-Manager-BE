import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

class UpdateListingDto {
  isTransferListed: boolean;
  isLoanListed: boolean;
  askingPrice?: number;
}

@ApiTags('Cầu Thủ & Đội Hình')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm cầu thủ với phân trang và bộ lọc' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'Lionel' })
  @ApiQuery({ name: 'clubId', required: false })
  @ApiQuery({ name: 'nationalityId', required: false })
  @ApiQuery({ name: 'squadType', required: false, example: 'FIRST_TEAM' })
  async getPlayers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('clubId') clubId?: string,
    @Query('nationalityId') nationalityId?: string,
    @Query('squadType') squadType?: string,
  ) {
    return this.playersService.getPlayers(
      Number(page),
      Number(limit),
      search,
      clubId,
      nationalityId,
      squadType,
    );
  }

  @Get('club/:clubId/squad')
  @ApiOperation({ summary: 'Lấy toàn bộ danh sách đội hình của một CLB' })
  @ApiQuery({ name: 'squadType', required: false, enum: ['FIRST_TEAM', 'RESERVES', 'YOUTH_U19'] })
  async getClubSquad(
    @Param('clubId') clubId: string,
    @Query('squadType') squadType?: string,
  ) {
    return this.playersService.getClubSquad(BigInt(clubId), squadType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết hồ sơ, chỉ số, hợp đồng và tình trạng cầu thủ' })
  async getPlayerById(@Param('id') id: string) {
    return this.playersService.getPlayerById(BigInt(id));
  }

  @Put(':id/transfer-listing')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi trạng thái rao bán / cho mượn và giá yêu cầu của cầu thủ' })
  async updateTransferListing(
    @Param('id') id: string,
    @Body() body: UpdateListingDto,
  ) {
    return this.playersService.updateTransferListing(
      BigInt(id),
      body.isTransferListed,
      body.isLoanListed,
      body.askingPrice,
    );
  }
}
