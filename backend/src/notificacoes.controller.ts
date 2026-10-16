import { Body, Controller, ForbiddenException, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { getStore } from './server/store';

@Controller('notificacoes')
export class NotificacoesController {
  private readonly store = getStore();
  private async sessao(req: Request, escrita = false) {
    if (escrita && req.headers.origin !== (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')) throw new ForbiddenException('Origem não permitida.');
    const sessao = await (await this.store).session(req.cookies?.['nexo-sessao']);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    return sessao;
  }
  @Get()
  async listar(@Req() req: Request) { return (await this.store).notificacoes.listar(await this.sessao(req)); }
  @Post('lidas')
  async marcarLidas(@Req() req: Request, @Body() body: unknown) { return (await this.store).notificacoes.marcarLidas(await this.sessao(req, true), body); }
}
