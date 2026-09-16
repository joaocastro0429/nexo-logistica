import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Banco } from './database';
import type { Redis } from './redis';
import type { Sessao } from '../types';

export const SESSION_SECONDS = 60 * 60 * 8;
export const chaveSessao = (token: string) => `nexo:sessao:${createHash('sha256').update(token).digest('hex')}`;

export function criarAutenticacao(db: Banco, redis: Redis) {
  async function session(token: string | undefined): Promise<Sessao | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const dados = await redis.get(chaveSessao(token));
    if (!dados) return null;
    const { usuarioId, version } = JSON.parse(dados);
    // O perfil e a empresa vêm do MySQL, nunca de um valor enviado pelo navegador.
    const row = await db.prepare(`SELECT u.id AS usuarioId, u.nome, u.perfil, u.tenant_id AS tenantId, e.nome AS empresa
      FROM usuarios u JOIN empresas e ON e.id = u.tenant_id
      WHERE u.id = ? AND u.session_version = ?`).get(usuarioId, version);
    return row ? row as Sessao : null;
  }
  async function login(email: string, senha: string, perfil: string) {
    const user = await db.prepare('SELECT id, senha_hash, perfil, session_version FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    const [salt, hash] = (user ? String(user.senha_hash) : `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const valid = timingSafeEqual(scryptSync(senha, salt, 64), Buffer.from(hash, 'hex'));
    if (!user || !valid || user.perfil !== perfil) return null;
    const token = randomBytes(32).toString('hex');
    await redis.set(chaveSessao(token), JSON.stringify({ usuarioId: user.id, version: user.session_version }), { EX: SESSION_SECONDS });
    return token;
  }
  async function logout(token: string | undefined) {
    if (token) await redis.del(chaveSessao(token));
  }
  return { session, login, logout };
}
