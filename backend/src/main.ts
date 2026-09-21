import 'reflect-metadata';
import { SecurityExceptionFilter } from './security.filter';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { getStore, closeStore } from './server/store';
import { AppModule } from './app.module';

async function bootstrap() {
  await getStore();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalFilters(new SecurityExceptionFilter());
  app.use((_req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), process.env.HOST || '0.0.0.0');
}
bootstrap().catch(async (error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'EADDRINUSE') {
    console.error(`A porta ${process.env.PORT || 3001} já está em uso. Encerre o backend duplicado ou escolha outra porta com PORT=...`);
  } else {
    console.error('Falha ao iniciar. Verifique as chaves de segurança, MySQL, Redis e migrações.');
  }
  await closeStore().catch(() => {});
  process.exit(1);
});
