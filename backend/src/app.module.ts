import { GestaoController } from './gestao.controller';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({ controllers: [AppController, GestaoController] })
export class AppModule {}
