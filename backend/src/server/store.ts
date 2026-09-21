import { securityConfig } from './security';
import { getDeadline, waitUntil } from '@vercel/functions';
import { criarImportacoesRedis } from '../infrastructure/repositories/importacoes.repository';
import { criarOAuth } from './oauth';
import { criarImportacoes } from './importacoes';
import { calcularPainel, type SimulacaoAnalitica } from './painel';
import { criarCadastro } from './cadastro';
import { abrirRedis } from './redis';
import { criarGestao } from './gestao.js';
import { abrirBanco } from './database';
import { criarAutenticacao } from './auth';
import type { Painel } from '../types';
import { MySqlAuditoriaRepository, MySqlAutenticacaoRepository, MySqlGestaoRepository } from '../infrastructure/repositories/mysql.repositories';

export async function openStore(url?: string, redisUrl?: string) {
  securityConfig();
  const db = await abrirBanco(url);
  const redis = await abrirRedis(redisUrl).catch(async error => { await db.close(); throw error; });
  const authRepository = new MySqlAutenticacaoRepository(db.db);
  const gestaoRepository = new MySqlGestaoRepository(db.db);
  const auditoria = new MySqlAuditoriaRepository(db.db);
  const auth = criarAutenticacao(authRepository, redis, auditoria);

  const gestao = criarGestao(gestaoRepository, auditoria);
  const importacoes = criarImportacoes({
    session: auth.session, salvar: gestao.salvar,
    repository: criarImportacoesRedis(redis, process.env.AUTH_NAMESPACE || 'nexo'),
    agendar: process.env.VERCEL === '1' ? waitUntil : undefined,
    prazo: () => (getDeadline()?.getTime() ?? Date.now() + 300000) - 30000,
  });

  // Regra do multi-tenant: toda consulta usa a empresa da sessão validada.
  // Esta função é interna do servidor; nunca passar um tenant recebido do cliente.
  async function buscarPainel(tenantId: string): Promise<Omit<Painel, 'sessao'>> {
    const dados = await gestaoRepository.listarSimulacoes(tenantId);
    return calcularPainel(dados.map(dado => JSON.parse(dado) as SimulacaoAnalitica));
  }

  return { health: async () => { await db.pool.query('SELECT 1'); await redis.ping(); return { status: 'ok' }; }, ...auth, oauth: criarOAuth(authRepository, redis, auth), cadastrar: criarCadastro(db, auditoria), ...gestao, importacoes, buscarPainel, close: async () => { await importacoes.close(); await redis.quit(); await db.close(); } };
}

let store: ReturnType<typeof openStore> | undefined;
export function getStore() {
  if (!store) store = openStore();
  return store;
}

export async function closeStore() {
  if (store) { await (await store).close(); store = undefined; }
}
