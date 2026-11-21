import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString, Matches } from 'class-validator';
import { TrainingSquad } from '../training.rules';

export class ScheduleTrainingDto {
  @ApiProperty({ description: 'Đội tham gia buổi tập', enum: ['FIRST_TEAM', 'YOUTH'] })
  @IsIn(['FIRST_TEAM', 'YOUTH'])
  squadType: TrainingSquad;

  @ApiProperty({ description: 'Đúng 6 ID bài tập theo thứ tự ô; được lặp bài', type: [String] })
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @Matches(/^[1-9]\d{0,18}$/, { each: true })
  trainingTypeIds: string[];

  @ApiProperty({ description: 'Danh sách cầu thủ CLB tham gia buổi tập', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[1-9]\d{0,18}$/, { each: true })
  playerIds: string[];
}
