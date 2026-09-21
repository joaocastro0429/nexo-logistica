import jwt from 'jsonwebtoken';
import { TOTP, Secret } from 'otpauth';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import type { AutenticacaoRepository, UsuarioPersistido } from '../domain/repositories';
import type { Redis } from './redis';
import type { Sessao } from '../types';
import { createLimiter, decrypt, digest, encrypt, randomToken, redisKey, securityConfig, verifyPassword } from './security';

export const SESSION_SECONDS = 15 * 60;
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
const issuer = 'nexo';
const audience = 'nexo-api';
type Family = { usuarioId: string; version: number; current: string; expires: number };
export type Tokens = { access: string; refresh: string };
export type LoginResult = Tokens | { challenge: string };
// Usado também pelos testes de expiração. O conteúdo só é confiável após jwt.verify.
export const chaveSessao = (token: string) => {
  const data = jwt.decode(token);
  return redisKey(`sessao:${digest(typeof data === 'object' && typeof data?.sid === 'string' ? data.sid : token)}`);
};
export function criarAutenticacao(repository: AutenticacaoRepository, redis: Redis) {
  const config = securityConfig();
  const limit = createLimiter(redis);
  const familyKey = (sid: string) => redisKey(`sessao:${digest(sid)}`);
  const refreshKey = (token: string) => redisKey(`refresh:${digest(token)}`);
  function claims(token: string, ignoreExpiration = false) {
    try {
      const data = jwt.verify(token, config.jwt, { algorithms: ['HS256'], issuer, audience, ignoreExpiration });
      if (typeof data === 'string' || data.typ !== 'access' || typeof data.sid !== 'string' || typeof data.sub !== 'string' || typeof data.exp !== 'number' || !/^[a-f0-9]{64}$/.test(data.sid)) return null;
      return data;
    } catch { return null; }
  }
  async function identity(token: string | undefined) {
    if (!token || token.length > 2048) return null;
    const data = claims(token);
    if (!data) return null;
    const raw = await redis.get(familyKey(data.sid));
    if (!raw) return null;
    const family = JSON.parse(raw) as Family;
    if (family.usuarioId !== data.sub) return null;
    return repository.buscarSessao(family.usuarioId, family.version);
  }
  async function session(token: string | undefined): Promise<Sessao | null> { return identity(token); }
  function access(sid: string, id: string) {
    return jwt.sign({ sid, typ: 'access' }, config.jwt, { algorithm: 'HS256', subject: id, issuer, audience, expiresIn: SESSION_SECONDS });
  }
  async function issue(user: UsuarioPersistido): Promise<Tokens> {
    if (!await repository.buscarSessao(user.id, user.sessionVersion)) throw new UnauthorizedException();
    const sid = randomToken();
    const refresh = randomToken();
    const family: Family = { usuarioId: user.id, version: user.sessionVersion, current: digest(refresh), expires: Math.floor(Date.now() / 1000) + REFRESH_SECONDS };
    await redis.multi().set(familyKey(sid), JSON.stringify(family), { EX: REFRESH_SECONDS })
      .set(refreshKey(refresh), sid, { EX: REFRESH_SECONDS }).exec();
    return { access: access(sid, user.id), refresh };
  }
  async function finish(user: UsuarioPersistido): Promise<LoginResult> {
    if (!user.mfaSecret) return issue(user);
    const challenge = randomToken();
    await redis.set(redisKey(`challenge:${digest(challenge)}`), JSON.stringify({ id: user.id, version: user.sessionVersion }), { EX: 300 });
    return { challenge };
  }
  async function passwordUser(email: string, senha: string, perfil?: string) {
    await limit('email', email.trim().toLowerCase());
    const user = await repository.buscarPorEmail(email.trim().toLowerCase());
    if (user) await limit('account', user.id);
    const valid = await verifyPassword(senha, user?.senhaHash);
    return user && valid && (!perfil || user.perfil === perfil) ? user : null;
  }
  async function passwordLogin(email: string, senha: string, perfil?: string) {
    const user = await passwordUser(email, senha, perfil);
    return user ? finish(user) : null;
  }
  // Compatibilidade dos consumidores internos: nunca emite acesso sem o segundo fator.
  async function login(email: string, senha: string, perfil: string) {
    const user = await passwordUser(email, senha, perfil);
    return user && !user.mfaSecret ? (await issue(user)).access : null;
  }
  async function refresh(token: string | undefined): Promise<Tokens | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const sid = await redis.get(refreshKey(token));
    if (!sid) return null;
    const raw = await redis.get(familyKey(sid));
    if (!raw) return null;
    const family = JSON.parse(raw) as Family;
    if (!await repository.buscarSessao(family.usuarioId, family.version)) { await redis.del(familyKey(sid)); return null; }
    const next = randomToken();
    // A rotação e a detecção de reuso são atômicas inclusive entre instâncias.
    const result = await redis.eval(`local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
local f = cjson.decode(raw)
if f.current ~= ARGV[1] then redis.call('DEL', KEYS[1]); return 0 end
local ttl = redis.call('TTL', KEYS[1]); if ttl <= 0 then return 0 end
f.current = ARGV[2]; redis.call('SET', KEYS[1], cjson.encode(f), 'EX', ttl)
redis.call('SET', KEYS[2], ARGV[3], 'EX', ttl); return 1`, {
      keys: [familyKey(sid), refreshKey(next)], arguments: [digest(token), digest(next), sid],
    });
    return Number(result) === 1 ? { access: access(sid, family.usuarioId), refresh: next } : null;
  }
  async function logout(token: string | undefined, refreshToken?: string, challenge?: string) {
    if (challenge && /^[a-f0-9]{64}$/.test(challenge)) await redis.del(redisKey(`challenge:${digest(challenge)}`));
    const data = token ? claims(token, true) : null;
    if (data) await redis.del(familyKey(data.sid));
    if (refreshToken && /^[a-f0-9]{64}$/.test(refreshToken)) {
      const sid = await redis.get(refreshKey(refreshToken));
      if (sid) await redis.del(familyKey(sid));
    }
  }
  function totp(secret: string) { return new TOTP({ issuer: 'Nexo', label: 'Nexo', algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) }); }
  function step(secret: string, code: string) {
    if (!/^\d{6}$/.test(code)) return null;
    const now = Date.now();
    const delta = totp(secret).validate({ token: code, window: 1, timestamp: now });
    return delta === null ? null : Math.floor(now / 30000) + delta;
  }
  async function factor(user: UsuarioPersistido, code: string) {
    if (!user.mfaSecret) return false;
    await limit('factor', user.id, 8, 300);
    const current = step(decrypt(user.mfaSecret, config.encryption), code);
    if (current !== null) return repository.consumirTotp(user.id, user.mfaSecret, current);
    const hashes = JSON.parse(user.recoveryHashes || '[]') as string[];
    const hash = digest(code);
    return hashes.includes(hash) && repository.consumirRecovery(user.id, user.recoveryHashes!, JSON.stringify(hashes.filter(item => item !== hash)));
  }
  async function completeMfa(challenge: string | undefined, code: string) {
    if (!challenge || !/^[a-f0-9]{64}$/.test(challenge)) return null;
    const key = redisKey(`challenge:${digest(challenge)}`);
    const raw = await redis.get(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const user = await repository.buscarUsuario(data.id);
    if (!user || user.sessionVersion !== data.version || !await factor(user, code)) return null;
    // Apenas uma requisição pode concluir o mesmo desafio.
    if (!await redis.getDel(key)) return null;
    return issue(user);
  }
  async function requireUser(token: string | undefined) {
    const sessao = await identity(token);
    const user = sessao && await repository.buscarUsuario(sessao.usuarioId);
    if (!user) throw new UnauthorizedException('Sessão inválida.');
    return user;
  }
  async function reauthenticate(token: string | undefined, password: string, code: string) {
    const user = await requireUser(token);
    await limit('reauth', user.id, 8, 300);
    if (!await verifyPassword(password, user.senhaHash) || (user.mfaSecret && !await factor(user, code))) throw new UnauthorizedException('Credenciais inválidas.');
    return user;
  }
  async function setupMfa(token: string | undefined, password: string) {
    const user = await reauthenticate(token, password, '');
    if (user.mfaSecret) throw new ConflictException('MFA já está ativo.');
    const secret = new Secret({ size: 20 }).base32;
    await redis.set(redisKey(`enroll:${user.id}`), JSON.stringify({ secret: encrypt(secret, config.encryption), version: user.sessionVersion }), { EX: 300 });
    return { secret, uri: totp(secret).toString() };
  }
  async function enableMfa(token: string | undefined, code: string) {
    const user = await requireUser(token);
    await limit('factor', user.id, 8, 300);
    const raw = await redis.get(redisKey(`enroll:${user.id}`));
    if (!raw || user.mfaSecret) throw new UnauthorizedException('Configuração expirada.');
    const pending = JSON.parse(raw);
    const current = step(decrypt(pending.secret, config.encryption), code);
    if (current === null || pending.version !== user.sessionVersion) throw new UnauthorizedException('Código inválido.');
    const recoveryCodes = Array.from({ length: 8 }, () => randomToken().slice(0, 20));
    if (!await repository.salvarMfa(user.id, user.sessionVersion, pending.secret, JSON.stringify(recoveryCodes.map(digest)), current)) throw new ConflictException('Conta alterada. Entre novamente.');
    await redis.del(redisKey(`enroll:${user.id}`));
    return { recoveryCodes };
  }
  async function disableMfa(token: string | undefined, password: string, code: string) {
    const user = await reauthenticate(token, password, code);
    if (!user.mfaSecret || !await repository.salvarMfa(user.id, user.sessionVersion, null, null, -1)) throw new ConflictException('Conta alterada. Entre novamente.');
    return { ok: true };
  }
  async function securityStatus(token: string | undefined) {
    const user = await requireUser(token);
    return { mfa: Boolean(user.mfaSecret), providers: await repository.listarOAuth(user.id) };
  }
  return { session, login, passwordLogin, refresh, logout, completeMfa, setupMfa, enableMfa, disableMfa, securityStatus, reauthenticate, finish, limit };
}
