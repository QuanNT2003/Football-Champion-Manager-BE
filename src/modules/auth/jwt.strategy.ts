import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'qkaito_football_champion_secret_jwt_key_2026',
    });
  }

  async validate(payload: any) {
    const userId = BigInt(payload.sub);
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar_url: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc phiên đăng nhập đã hết hạn');
    }

    // Check if user owns a club
    const club = await this.prisma.clubs.findFirst({
      where: { owner_user_id: userId },
      select: { id: true, name: true },
    });

    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      clubId: club?.id ? club.id.toString() : null,
      clubName: club?.name || null,
    };
  }
}
