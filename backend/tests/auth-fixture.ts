import { scryptSync } from 'node:crypto';
import type { AuditoriaRepository, AutenticacaoRepository, UsuarioPersistido } from '../src/domain/repositories';
import type { Redis } from '../src/server/redis';
import { criarAutenticacao } from '../src/server/auth';

export function testKeys() {
  process.env.JWT_SECRET ||= 'nexo-unit-test-only-secret-at-least-32-bytes';
  process.env.MFA_ENCRYPTION_KEY ||= 'a'.repeat(64);
}
export class MemoryRedis {
  values = new Map<string, { value: string; expires: number }>();
  async get(key: string) { const v = this.values.get(key); return v && v.expires > Date.now() ? v.value : null; }
  async set(key: string, value: string, options: { EX: number }) { this.values.set(key, { value, expires: Date.now() + options.EX * 1000 }); return 'OK'; }
  async del(key: string) { return Number(this.values.delete(key)); }
  async getDel(key: string) { const v = await this.get(key); this.values.delete(key); return v; }
  multi() {
    const tasks: (() => Promise<unknown>)[] = [];
    const chain = { set: (key: string, value: string, options: { EX: number }) => { tasks.push(() => this.set(key, value, options)); return chain; }, exec: () => Promise.all(tasks.map(t => t())) };
    return chain;
  }
  async eval(script: string, options: { keys: string[]; arguments: string[] }) {
    // Simula os contratos; a suíte de serviços executa os scripts no Redis real.
    const [key, next] = options.keys; const args = options.arguments;
    const old = this.values.get(key);
    const raw = old && old.expires > Date.now() ? old.value : null;
    if (script.includes("'INCR'")) {
      const count = Number(raw || 0) + 1;
      this.values.set(key, { value: String(count), expires: raw ? old!.expires : Date.now() + Number(args[0]) * 1000 }); return count;
    }
    if (!raw) return 0;
    const family = JSON.parse(raw);
    if (family.current !== args[0]) { this.values.delete(key); return 0; }
    family.current = args[1];
    this.values.set(key, { value: JSON.stringify(family), expires: old!.expires });
    this.values.set(next, { value: args[2], expires: old!.expires }); return 1;
  }
}
export function authFixture() {
  testKeys();
  const senha = 'TesteSeguro@2026';
  const salt = '1'.repeat(32);
  const user: UsuarioPersistido = { id: 'u1', nome: 'Teste', perfil: 'Administrador', tenantId: 'empresa-a', sessionVersion: 0, senhaHash: `${salt}:${scryptSync(senha, salt, 64).toString('hex')}`, mfaLastStep: -1 };
  const users = new Map([[user.id, user]]);
  const links = new Map<string, string>();
  const repository: AutenticacaoRepository = {
    buscarUsuario: async id => users.get(id) ? { ...users.get(id)! } : null,
    buscarPorEmail: async email => email === 'teste@example.com' ? { ...user } : null,
    buscarSessao: async (id, version) => {
      const u = users.get(id);
      return u && u.sessionVersion === version ? { usuarioId: u.id, nome: u.nome, perfil: u.perfil, tenantId: u.tenantId, empresa: 'Empresa' } : null;
    },
    salvarMfa: async (id, version, secret, hashes, step) => {
      const u = users.get(id); if (!u || u.sessionVersion !== version) return false;
      Object.assign(u, { mfaSecret: secret, recoveryHashes: hashes, mfaLastStep: step, sessionVersion: version + 1 }); return true;
    },
    consumirTotp: async (id, secret, step) => {
      const u = users.get(id); if (!u || u.mfaSecret !== secret || (u.mfaLastStep ?? -1) >= step) return false;
      u.mfaLastStep = step; return true;
    },
    consumirRecovery: async (id, previous, next) => {
      const u = users.get(id); if (!u || u.recoveryHashes !== previous) return false;
      u.recoveryHashes = next; return true;
    },
    buscarOAuth: async (provider, subject) => { const u = users.get(links.get(`${provider}:${subject}`) || ''); return u ? { ...u } : null; },
    vincularOAuth: async (id, provider, subject) => { links.set(`${provider}:${subject}`, id); },
    listarOAuth: async id => [...links].filter(([, value]) => value === id).map(([key]) => key.split(':')[0]),
  };
  const memory = new MemoryRedis();
  const redis = memory as unknown as Redis;
  const eventos: Parameters<AuditoriaRepository['registrar']>[0][] = [];
  const auditoria: AuditoriaRepository = { registrar: async evento => { eventos.push(evento); } };
  return { auth: criarAutenticacao(repository, redis, auditoria), memory, redis, repository, auditoria, eventos, user, senha, links, users };
}
