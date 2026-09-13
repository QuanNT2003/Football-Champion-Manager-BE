import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'manager_quan', description: 'Tên đăng nhập của HLV' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'quan@footballchampion.com', description: 'Email tài khoản' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Pass123456@', description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'manager_quan', description: 'Tên đăng nhập hoặc email' })
  @IsString()
  @IsNotEmpty()
  usernameOrEmail: string;

  @ApiProperty({ example: 'Pass123456@', description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
