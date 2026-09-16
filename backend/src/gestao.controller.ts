import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { getStore } from './server/store';

@Controller()
export class GestaoController {
  private readonly store = getStore();
  private async sessao(request: Request, escrita = false) {
    if (escrita && request.headers.origin !== (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')) throw new ForbiddenException('Origem não permitida.');
    const sessao = await (await this.store).session(request.cookies?.['nexo-sessao']);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    return sessao;
  }
  @Get('gestao/:tipo')
  async listar(@Req() req: Request, @Param('tipo') tipo: string, @Query('q') q?: string) {
    return (await this.store).listar(await this.sessao(req), tipo, typeof q === 'string' ? q : '');
  }
  @Get('gestao/:tipo/:id')
  async consultar(@Req() req: Request, @Param('tipo') tipo: string, @Param('id') id: string) {
    return (await this.store).consultar(await this.sessao(req), tipo, id);
  }
  @Post('gestao/:tipo')
  async cadastrar(@Req() req: Request, @Param('tipo') tipo: string, @Body() body: unknown) {
    return (await this.store).salvar(await this.sessao(req, true), tipo, body);
  }
  @Put('gestao/:tipo/:id')
  async editar(@Req() req: Request, @Param('tipo') tipo: string, @Param('id') id: string, @Body() body: unknown) {
    return (await this.store).salvar(await this.sessao(req, true), tipo, body, id);
  }
  @Delete('gestao/:tipo/:id')
  async remover(@Req() req: Request, @Param('tipo') tipo: string, @Param('id') id: string) {
    return (await this.store).remover(await this.sessao(req, true), tipo, id);
  }
  @Post('simulacoes')
  async simular(@Req() req: Request, @Body() body: unknown) { return (await this.store).simular(await this.sessao(req, true), body); }
  @Get('simulacoes')
  async historico(@Req() req: Request) { return (await this.store).historico(await this.sessao(req)); }
  @Get('simulacoes/:id')
  async detalhe(@Req() req: Request, @Param('id') id: string) { return (await this.store).historico(await this.sessao(req), id); }
}
