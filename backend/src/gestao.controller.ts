import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { getStore } from './server/store';

@Controller()
export class GestaoController {
  private readonly store = getStore();
  private sessao(request: Request, escrita = false) {
    if (escrita && request.headers.origin !== (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')) throw new ForbiddenException('Origem não permitida.');
    const sessao = this.store.session(request.cookies?.['nexo-sessao']);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    return sessao;
  }
  @Get('gestao/:tipo')
  listar(@Req() req: Request, @Param('tipo') tipo: string, @Query('q') q?: string) {
    return this.store.listar(this.sessao(req), tipo, typeof q === 'string' ? q : '');
  }
  @Get('gestao/:tipo/:id')
  consultar(@Req() req: Request, @Param('tipo') tipo: string, @Param('id') id: string) {
    return this.store.consultar(this.sessao(req), tipo, id);
  }
  @Post('gestao/:tipo')
  cadastrar(@Req() req: Request, @Param('tipo') tipo: string, @Body() body: unknown) {
    return this.store.salvar(this.sessao(req, true), tipo, body);
  }
  @Put('gestao/:tipo/:id')
  editar(@Req() req: Request, @Param('tipo') tipo: string, @Param('id') id: string, @Body() body: unknown) {
    return this.store.salvar(this.sessao(req, true), tipo, body, id);
  }
  @Delete('gestao/:tipo/:id')
  remover(@Req() req: Request, @Param('tipo') tipo: string, @Param('id') id: string) {
    return this.store.remover(this.sessao(req, true), tipo, id);
  }
  @Post('simulacoes')
  simular(@Req() req: Request, @Body() body: unknown) { return this.store.simular(this.sessao(req, true), body); }
  @Get('simulacoes')
  historico(@Req() req: Request) { return this.store.historico(this.sessao(req)); }
  @Get('simulacoes/:id')
  detalhe(@Req() req: Request, @Param('id') id: string) { return this.store.historico(this.sessao(req), id); }
}
