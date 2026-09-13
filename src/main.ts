import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Ensure BigInt can be serialized to JSON universally
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Global Interceptor and Pipes
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('QKaito Football Champion Manager API')
    .setDescription(
      'Hệ thống API Backend quản lý game bóng đá chuyên sâu: CLB, Đội hình, Cầu thủ, Chiến thuật, Mô phỏng trận đấu (Match Engine), Chuyển nhượng, Mùa giải và Tài chính.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'QKaito Football Champion - API Docs',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Server is running at: http://localhost:${port}/api/v1`);
  logger.log(`Swagger API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
