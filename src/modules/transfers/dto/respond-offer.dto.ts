import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class RespondOfferDto {
  @ApiPropertyOptional({ description: 'ID CLB đưa ra phản hồi', example: '1' })
  @IsOptional()
  @IsString()
  club_id?: string;

  @ApiProperty({ description: 'Trạng thái phản hồi (ACCEPTED hoặc REJECTED)', enum: ['ACCEPTED', 'REJECTED'] })
  @IsNotEmpty({ message: 'Thiếu thông tin response (ACCEPTED hoặc REJECTED)' })
  @IsIn(['ACCEPTED', 'REJECTED'])
  response: 'ACCEPTED' | 'REJECTED';
}
