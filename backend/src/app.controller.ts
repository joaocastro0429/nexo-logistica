import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getStore } from './server/store';
import { SESSION_SECONDS } from './server/auth';

const COOKIE = 'nexo-sessao';
// O navegador acessa /api pelo Next, que encaminha as requisições ao Nest.
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

@Controller()
export class AppController {
  private readonly store = getStore();

  private validarOrigem(request: Request) {
    if (request.headers.origin !== frontendOrigin) throw new ForbiddenException('Origem não permitida.');
  }

  @Get('health')
  async health() { return (await this.store).health(); }

  @Post('sessao')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.validarOrigem(request);
    const store = await this.store;
    if (!body || typeof body !== 'object') throw new BadRequestException('Dados inválidos.');
    const { email, senha, perfil } = body as Record<string, unknown>;
    if (typeof email !== 'string' || typeof senha !== 'string' || typeof perfil !== 'string'
      || email.length > 254 || !senha || senha.length > 256) throw new BadRequestException('Dados inválidos.');
    const token = await store.login(email, senha, perfil);
    if (!token) throw new UnauthorizedException('E-mail, senha ou perfil inválidos.');
    await store.logout(request.cookies?.[COOKIE]);
    response.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: frontendOrigin.startsWith('https:'), path: '/', maxAge: SESSION_SECONDS * 1000 });
    response.setHeader('Cache-Control', 'private, no-store');
    return { sessao: await store.session(token) };
  }

  @Delete('sessao')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.validarOrigem(request);
    const store = await this.store;
    await store.logout(request.cookies?.[COOKIE]);
    response.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
    response.setHeader('Cache-Control', 'private, no-store');
    return { ok: true };
  }

  @Get('plataforma')
  async painel(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const store = await this.store;
    // 1. Valida a sessão e identifica a empresa do usuário no servidor.
    const sessao = await store.session(request.cookies?.[COOKIE]);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    // 2. Todas as consultas usam a empresa autenticada.
    const dados = await store.buscarPainel(sessao.tenantId);
    response.setHeader('Cache-Control', 'private, no-store');
    return { sessao, ...dados };
  }
}
