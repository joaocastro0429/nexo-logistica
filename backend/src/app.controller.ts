import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getStore } from './server/store';
import { SESSION_SECONDS, REFRESH_SECONDS, type LoginResult, type Tokens } from './server/auth';
import { availableProviders, frontendOrigin, providerName } from './server/oauth';
import { parseCodeDto, parseLoginDto, parseOAuthLinkDto, parsePasswordDto } from './application/dtos/auth.dto';
import { AuthPresenter } from './application/presenters/auth.presenter';
import { ClientIp } from './http/decorators/client-ip.decorator';

const COOKIE = 'nexo-sessao';
const REFRESH = 'nexo-refresh';
const MFA = 'nexo-mfa';
function cookieOptions() { return { httpOnly: true, sameSite: 'lax' as const, secure: frontendOrigin().startsWith('https:'), path: '/' }; }
@Controller()
export class AppController {
  private readonly store = getStore();
  @Get('health')
  async health() { return (await this.store).health(); }

  private validarOrigem(request: Request) {
    if (request.headers.origin !== frontendOrigin()) throw new UnauthorizedException('Origem não permitida.');
  }
  private async guard(request: Request, scope: string, max = 60) {
    this.validarOrigem(request);
    // Não confia em X-Forwarded-For enviado pelo cliente. Atrás do Next, o limite é compartilhado.
    await (await this.store).limit(`ip:${scope}`, request.ip || request.socket.remoteAddress || 'unknown', max, 900);
  }
  private cookies(response: Response, tokens: Tokens) {
    response.cookie(COOKIE, tokens.access, { ...cookieOptions(), maxAge: SESSION_SECONDS * 1000 });
    response.cookie(REFRESH, tokens.refresh, { ...cookieOptions(), maxAge: REFRESH_SECONDS * 1000 });
    response.clearCookie(MFA, cookieOptions());
  }
  private clear(response: Response) {
    for (const name of [COOKIE, REFRESH, MFA]) response.clearCookie(name, cookieOptions());
  }
  private async result(result: LoginResult, request: Request, response: Response) {
    const store = await this.store;
    await store.logout(request.cookies?.[COOKIE], request.cookies?.[REFRESH], request.cookies?.[MFA]);
    if ('challenge' in result) {
      for (const name of [COOKIE, REFRESH]) response.clearCookie(name, cookieOptions());
      response.cookie(MFA, result.challenge, { ...cookieOptions(), maxAge: 300000 });
      return { mfaRequired: true };
    }
    this.cookies(response, result);
    return AuthPresenter.login(result, await store.session(result.access));
  }

  @Post('cadastro')
  async cadastrar(@Body() body: unknown, @Req() request: Request) {
    await this.guard(request, 'cadastro', 10);
    return (await this.store).cadastrar(body);
  }
  @Post('sessao')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response, @ClientIp() ip?: string) {
    await this.guard(request, 'login');
    const data = parseLoginDto(body);
    const result = await (await this.store).passwordLogin(data.email, data.senha, data.perfil, { ip });
    if (!result) throw new UnauthorizedException('E-mail, senha ou perfil inválidos.');
    return this.result(result, request, response);
  }
  @Post('sessao/mfa')
  @HttpCode(200)
  async mfa(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response, @ClientIp() ip?: string) {
    await this.guard(request, 'mfa');
    const result = await (await this.store).completeMfa(request.cookies?.[MFA], parseCodeDto(body).codigo, { ip });
    if (!result) throw new UnauthorizedException('Código inválido ou desafio expirado.');
    return this.result(result, request, response);
  }
  @Post('sessao/refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.guard(request, 'refresh', 120);
    const result = await (await this.store).refresh(request.cookies?.[REFRESH]);
    if (!result) { this.clear(response); throw new UnauthorizedException('Sessão expirada. Entre novamente.'); }
    this.cookies(response, result);
    return { ok: true };
  }
  @Delete('sessao')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response, @ClientIp() ip?: string) {
    this.validarOrigem(request);
    await (await this.store).logout(request.cookies?.[COOKIE], request.cookies?.[REFRESH], request.cookies?.[MFA], { ip });
    this.clear(response);
    return { ok: true };
  }
  @Get('plataforma')
  async painel(@Req() request: Request) {
    const store = await this.store;
    const sessao = await store.session(request.cookies?.[COOKIE]);
    if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
    return { sessao, ...(await store.buscarPainel(sessao.tenantId)) };
  }
  @Get('seguranca')
  async status(@Req() request: Request) { return (await this.store).securityStatus(request.cookies?.[COOKIE]); }
  @Post('seguranca/mfa/configurar')
  async setup(@Body() body: unknown, @Req() request: Request) {
    await this.guard(request, 'security');
    return (await this.store).setupMfa(request.cookies?.[COOKIE], parsePasswordDto(body).senha);
  }
  @Post('seguranca/mfa/ativar')
  async enable(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.guard(request, 'security');
    const result = await (await this.store).enableMfa(request.cookies?.[COOKIE], parseCodeDto(body).codigo);
    this.clear(response);
    return result;
  }
  @Delete('seguranca/mfa')
  async disable(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.guard(request, 'security');
    const data = parsePasswordDto(body);
    const result = await (await this.store).disableMfa(request.cookies?.[COOKIE], data.senha, parseCodeDto(body).codigo);
    this.clear(response);
    return result;
  }
  @Get('oauth/providers')
  providers() { return availableProviders(); }
  @Post('oauth/:provider/vincular')
  async link(@Param('provider') name: string, @Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.guard(request, 'security');
    const provider = providerName(name);
    const data = parseOAuthLinkDto(body);
    const store = await this.store;
    const user = await store.reauthenticate(request.cookies?.[COOKIE], data.senha, data.codigo || '');
    const result = await store.oauth.start(provider, { id: user.id, version: user.sessionVersion });
    response.cookie(`nexo-oauth-${provider}`, result.browser, { ...cookieOptions(), maxAge: 300000 });
    return { url: result.url };
  }
  @Get('oauth/:provider')
  async oauth(@Param('provider') name: string, @Req() request: Request, @Res() response: Response) {
    const provider = providerName(name);
    await (await this.store).limit('ip:oauth', request.ip || 'unknown', 30, 900);
    const result = await (await this.store).oauth.start(provider);
    response.cookie(`nexo-oauth-${provider}`, result.browser, { ...cookieOptions(), maxAge: 300000 });
    response.redirect(result.url);
  }
  @Get('oauth/:provider/callback')
  async callback(@Param('provider') name: string, @Req() request: Request, @Res() response: Response) {
    const provider = providerName(name);
    response.clearCookie(`nexo-oauth-${provider}`, cookieOptions());
    try {
      await (await this.store).limit('ip:oauth-callback', request.ip || 'unknown', 60, 900);
      const result = await (await this.store).oauth.callback(provider, request.query.state, request.query.code, request.cookies?.[`nexo-oauth-${provider}`], request.cookies?.[COOKIE]);
      if ('linked' in result) { response.redirect(`${frontendOrigin()}/seguranca?vinculado=1`); return; }
      await this.result(result, request, response);
      response.redirect(`${frontendOrigin()}${'challenge' in result ? '/login?mfa=1' : '/plataforma'}`);
    } catch {
      // Não encaminha mensagens/tokens do provedor para URL ou logs.
      response.redirect(`${frontendOrigin()}/login?oauth=erro`);
    }
  }
}
