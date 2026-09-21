import { UnauthorizedException, ServiceUnavailableException, ConflictException } from '@nestjs/common';
import type { AutenticacaoRepository } from '../domain/repositories';
import type { Redis } from './redis';
import type { criarAutenticacao } from './auth';
import { digest, randomToken, redisKey } from './security';
import { createHash } from 'node:crypto';

export type Provider = 'google' | 'github';
export const frontendOrigin = () => process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
export function providerName(value: string): Provider {
  if (value !== 'google' && value !== 'github') throw new UnauthorizedException('Provedor inválido.');
  return value;
}
function settings(provider: Provider) {
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new ServiceUnavailableException('Provedor não configurado.');
  return { clientId, clientSecret, callback: `${frontendOrigin()}/api/oauth/${provider}/callback` };
}
export const availableProviders = () => ({
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
});
async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new UnauthorizedException('Falha ao autenticar no provedor.');
  return response.json();
}
export function criarOAuth(repository: AutenticacaoRepository, redis: Redis, auth: ReturnType<typeof criarAutenticacao>) {
  async function start(provider: Provider, link?: { id: string; version: number }) {
    const { clientId, callback } = settings(provider);
    const state = randomToken();
    const browser = randomToken();
    const verifier = randomToken();
    const nonce = randomToken();
    await redis.set(redisKey(`oauth:${digest(state)}`), JSON.stringify({ provider, browser: digest(browser), verifier, nonce, link }), { EX: 300 });
    const url = new URL(provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://github.com/login/oauth/authorize');
    const params: Record<string, string> = {
      client_id: clientId, redirect_uri: callback, response_type: 'code', state,
      scope: provider === 'google' ? 'openid email' : 'read:user user:email',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    };
    if (provider === 'google') { params.nonce = nonce; params.prompt = 'select_account'; }
    url.search = new URLSearchParams(params).toString();
    return { url: url.toString(), browser };
  }
  async function callback(provider: Provider, state: unknown, code: unknown, browser: string | undefined, sessionToken?: string) {
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) || typeof code !== 'string' || !code || code.length > 4096 || !browser) throw new UnauthorizedException();
    const raw = await redis.getDel(redisKey(`oauth:${digest(state)}`));
    if (!raw) throw new UnauthorizedException();
    const pending = JSON.parse(raw);
    if (pending.provider !== provider || pending.browser !== digest(browser)) throw new UnauthorizedException();
    const { clientId, clientSecret, callback: redirectUri } = settings(provider);
    const tokens = await jsonRequest(provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: pending.verifier }),
    });
    let subject: string;
    if (provider === 'google') {
      if (typeof tokens.id_token !== 'string') throw new UnauthorizedException();
      const { jwtVerify, createRemoteJWKSet } = await import('jose');
      const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 10000 });
      const { payload } = await jwtVerify(tokens.id_token, keys, { algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId, requiredClaims: ['sub', 'exp', 'iat', 'nonce'], maxTokenAge: '10m' });
      if (payload.nonce !== pending.nonce || payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub) throw new UnauthorizedException();
      subject = payload.sub;
    } else {
      if (typeof tokens.access_token !== 'string') throw new UnauthorizedException();
      const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Nexo', 'X-GitHub-Api-Version': '2022-11-28' };
      const user = await jsonRequest('https://api.github.com/user', { headers });
      const emails = await jsonRequest('https://api.github.com/user/emails', { headers });
      if (!Number.isSafeInteger(user.id) || user.id <= 0 || !Array.isArray(emails) || !emails.some(email => email.verified === true && email.primary === true)) throw new UnauthorizedException();
      subject = String(user.id);
    }
    if (subject.length > 255) throw new UnauthorizedException();
    if (pending.link) {
      const current = await auth.session(sessionToken);
      if (!current || current.usuarioId !== pending.link.id || !await repository.buscarSessao(pending.link.id, pending.link.version)) throw new UnauthorizedException();
      try { await repository.vincularOAuth(current.usuarioId, provider, subject); }
      catch (error) {
        const e = error as { code?: string; cause?: { code?: string } };
        if (e.code === 'ER_DUP_ENTRY' || e.cause?.code === 'ER_DUP_ENTRY') throw new ConflictException('Identidade já vinculada.');
        throw error;
      }
      return { linked: true as const };
    }
    const user = await repository.buscarOAuth(provider, subject);
    if (!user) throw new UnauthorizedException('Entre com senha e vincule o provedor em Segurança.');
    return auth.finish(user);
  }
  return { start, callback };
}
