import { OperacaoController } from './operacao.controller';
import { GestaoController } from './gestao.controller';
import { closeStore } from './server/store';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController, GestaoController, OperacaoController],
})
export class AppModule implements OnApplicationShutdown {
  async onApplicationShutdown() { await closeStore(); }
}
