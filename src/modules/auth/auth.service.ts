import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.users.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existing) {
      if (existing.username === dto.username) {
        throw new ConflictException('Tên đăng nhập đã được sử dụng');
      }
      throw new ConflictException('Email này đã được đăng ký');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.users.create({
      data: {
        username: dto.username,
        email: dto.email,
        password_hash: passwordHash,
        status: 'ACTIVE',
      },
    });

    const token = this.generateToken(user.id, user.username);

    return {
      message: 'Đăng ký tài khoản HLV thành công!',
      accessToken: token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [
          { username: dto.usernameOrEmail },
          { email: dto.usernameOrEmail },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác');
    }

    const club = await this.prisma.clubs.findFirst({
      where: { owner_user_id: user.id },
      select: { id: true, name: true, logo_url: true },
    });

    const token = this.generateToken(user.id, user.username);

    return {
      message: 'Đăng nhập thành công!',
      accessToken: token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        club: club ? {
          id: club.id.toString(),
          name: club.name,
          logo_url: club.logo_url,
        } : null,
      },
    };
  }

  async getProfile(userId: bigint) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
        status: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    const club = await this.prisma.clubs.findFirst({
      where: { owner_user_id: userId },
      include: {
        countries: true,
        stadiums: true,
        financial_accounts: true,
      },
    });

    const fin = club?.financial_accounts?.[0] || null;

    return {
      ...user,
      club: club ? {
        id: club.id.toString(),
        name: club.name,
        short_name: club.short_name,
        reputation: club.reputation,
        ranking_points: club.ranking_points,
        country: club.countries?.name,
        stadium: club.stadiums?.[0]?.name,
        finances: fin ? {
          cash: fin.balance_cash,
          gold: fin.balance_gold,
        } : null,
      } : null,
    };
  }

  private generateToken(userId: bigint, username: string) {
    return this.jwtService.sign({
      sub: userId.toString(),
      username,
    });
  }
}
