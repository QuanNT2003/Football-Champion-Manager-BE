import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HireStaffDto {
  @ApiProperty({ description: 'ID CLB tuyển dụng', example: '1' })
  @IsNotEmpty()
  @IsString()
  clubId: string;

  @ApiProperty({ description: 'ID nhân viên tự do được tuyển dụng', example: '12' })
  @IsNotEmpty()
  @IsString()
  staffId: string;
}
