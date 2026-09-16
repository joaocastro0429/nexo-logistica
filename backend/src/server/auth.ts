import type { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Sessao } from '../types';

export const SESSION_SECONDS = 60 * 60 * 8;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

// A sessão identifica o usuário; sua empresa vem do cadastro no banco.
// O navegador não escolhe a empresa nem concede um perfil de acesso.
export function criarAutenticacao(db: DatabaseSync) {
  function session(token: string | undefined): Sessao | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = db.prepare(`SELECT u.id AS usuarioId, u.nome, u.perfil, u.tenant_id AS tenantId, e.nome AS empresa
      FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id JOIN empresas e ON e.id = u.tenant_id
      WHERE s.token_hash = ? AND s.expira > ?`).get(digest(token), Date.now());
    return row ? row as unknown as Sessao : null;
  }

  function login(email: string, senha: string, perfil: string) {
    const user = db.prepare('SELECT id, senha_hash, perfil FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    const [salt, hash] = (user ? String(user.senha_hash) : `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const valid = timingSafeEqual(scryptSync(senha, salt, 64), Buffer.from(hash, 'hex'));
    if (!user || !valid || user.perfil !== perfil) return null;
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessoes WHERE expira <= ?').run(Date.now());
    db.prepare('INSERT INTO sessoes VALUES (?, ?, ?)').run(digest(token), String(user.id), Date.now() + SESSION_SECONDS * 1000);
    return token;
  }

  function logout(token: string | undefined) {
    if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(digest(token));
  }

  return { session, login, logout };
}
