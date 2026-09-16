import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getStore } from './server/store';
import { SESSION_SECONDS } from './server/auth';

const COOKIE = 'nexo-sessao';

@Controller()
export class AppController {
  private readonly store = getStore();

  @Get('health')
  async health() { return (await this.store).health(); }

  @Post('sessao')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.validarOrigem(request);
    if (!body || typeof body !== 'object') throw new BadRequestException('Dados inválidos.');
    const { email, senha, perfil } = body as Record<string, unknown>;
    if (typeof email !== 'string' || typeof senha !== 'string' || typeof perfil !== 'string' || email.length > 254 || !senha || senha.length > 256) {
      throw new BadRequestException('Dados inválidos.');
    }
    const store = await this.store;
    const token = await store.login(email, senha, perfil);
    if (!token) throw new UnauthorizedException('E-mail, senha ou perfil inválidos.');
    await store.logout(request.cookies?.[COOKIE]);
    response.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: this.frontendOrigin().startsWith('https:'), path: '/', maxAge: SESSION_SECONDS * 1000 });
    response.setHeader('Cache-Control', 'private, no-store');
    return { sessao: await store.session(token) };
  }

  @Delete('sessao')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.validarOrigem(request);
    await (await this.store).logout(request.cookies?.[COOKIE]);
    response.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
    response.setHeader('Cache-Control', 'private, no-store');
    return { ok: true };
  }

  @Get('plataforma')
  async painel(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const store = await this.store;
    const sessao = await store.session(request.cookies?.[COOKIE]);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    response.setHeader('Cache-Control', 'private, no-store');
    return { sessao, ...(await store.buscarPainel(sessao.tenantId)) };
  }

  private frontendOrigin() { return process.env.FRONTEND_ORIGIN || 'http://localhost:3000'; }
  private validarOrigem(request: Request) {
    if (request.headers.origin !== this.frontendOrigin()) throw new UnauthorizedException('Origem não permitida.');
  }
}
