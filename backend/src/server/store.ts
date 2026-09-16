import { abrirRedis } from './redis';
import { criarGestao } from './gestao';
import { abrirBanco } from './database';
import { criarAutenticacao } from './auth';
import type { Painel } from '../types';

export async function openStore(url?: string, redisUrl?: string) {
  const db = await abrirBanco(url);
  const redis = await abrirRedis(redisUrl).catch(async error => { await db.close(); throw error; });
  const auth = criarAutenticacao(db, redis);

  // Regra do multi-tenant: toda consulta usa a empresa da sessão validada.
  // Esta função é interna do servidor; nunca passar um tenant recebido do cliente.
  async function buscarPainel(tenantId: string): Promise<Omit<Painel, 'sessao'>> {
    const indicadores = await db.prepare(`
      SELECT resumo, eficiencia FROM paineis WHERE tenant_id = ?
    `).get(tenantId);

    const rotas = await db.prepare(`
      SELECT id, nome, pedidos, previsao, status
      FROM rotas WHERE tenant_id = ? ORDER BY id
    `).all(tenantId);

    return {
      resumo: indicadores ? JSON.parse(String(indicadores.resumo)) : [],
      eficiencia: indicadores ? JSON.parse(String(indicadores.eficiencia)) : [],
      rotas: rotas as unknown as Painel['rotas'],
    };
  }

  return { health: async () => { await db.prepare('SELECT 1').get(); await redis.ping(); return { status: 'ok' }; }, ...auth, ...criarGestao(db), buscarPainel, close: async () => { await redis.quit(); await db.close(); } };
}

let store: ReturnType<typeof openStore> | undefined;
export function getStore() {
  if (!store) store = openStore();
  return store;
}

export async function closeStore() {
  if (store) { await (await store).close(); store = undefined; }
}
