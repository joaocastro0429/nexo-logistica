import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { getStore, closeStore } from './server/store';
import { AppModule } from './app.module';

async function bootstrap() {
  await getStore();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), process.env.HOST || '0.0.0.0');
}
bootstrap().catch(async error => { console.error(error); await closeStore().catch(() => {}); process.exit(1); });
