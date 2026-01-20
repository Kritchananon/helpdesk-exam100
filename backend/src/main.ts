// functions/src/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import * as bodyParser from 'body-parser';

export async function createApp() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL,
      'https://helpdesk-support-44934.web.app',
      'http://localhost:4200'
    ],
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'language',
      'user-id',
      'api-key',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  return app;
}

// 👉 ใช้เฉพาะ Local dev เท่านั้น
async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Local API running on http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap();
}
