import { criarCadastro } from './cadastro';
import { abrirRedis } from './redis';
import { criarGestao } from './gestao.js';
import { abrirBanco } from './database';
import { criarAutenticacao } from './auth';
import type { Painel } from '../types';
import { MySqlAutenticacaoRepository, MySqlDashboardRepository, MySqlGestaoRepository } from '../infrastructure/repositories/mysql.repositories';

export async function openStore(url?: string, redisUrl?: string) {
  const db = await abrirBanco(url);
  const redis = await abrirRedis(redisUrl).catch(async error => { await db.close(); throw error; });
  const authRepository = new MySqlAutenticacaoRepository(db.db);
  const gestaoRepository = new MySqlGestaoRepository(db.db);
  const dashboardRepository = new MySqlDashboardRepository(db.db);
  const auth = criarAutenticacao(authRepository, redis);

  // Regra do multi-tenant: toda consulta usa a empresa da sessão validada.
  // Esta função é interna do servidor; nunca passar um tenant recebido do cliente.
  async function buscarPainel(tenantId: string): Promise<Omit<Painel, 'sessao'>> {
    const painel = await dashboardRepository.buscarPainel(tenantId);
    return {
      resumo: painel.resumo as Painel['resumo'],
      eficiencia: painel.eficiencia,
      rotas: painel.rotas as Painel['rotas'],
    };
  }

  return { health: async () => { await db.pool.query('SELECT 1'); await redis.ping(); return { status: 'ok' }; }, ...auth, cadastrar: criarCadastro(db), ...criarGestao(gestaoRepository), buscarPainel, close: async () => { await redis.quit(); await db.close(); } };
}

let store: ReturnType<typeof openStore> | undefined;
export function getStore() {
  if (!store) store = openStore();
  return store;
}

export async function closeStore() {
  if (store) { await (await store).close(); store = undefined; }
}
