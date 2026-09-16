import { criarGestao } from './gestao';
import { abrirBanco } from './database';
import { criarAutenticacao } from './auth';
import type { Painel } from '../types';

export function openStore(path?: string) {
  const db = abrirBanco(path);
  const auth = criarAutenticacao(db);

  // Regra do multi-tenant: toda consulta usa a empresa da sessão validada.
  // Esta função é interna do servidor; nunca passar um tenant recebido do cliente.
  function buscarPainel(tenantId: string): Omit<Painel, 'sessao'> {
    const indicadores = db.prepare(`
      SELECT resumo, eficiencia FROM paineis WHERE tenant_id = ?
    `).get(tenantId);

    const rotas = db.prepare(`
      SELECT id, nome, pedidos, previsao, status
      FROM rotas WHERE tenant_id = ? ORDER BY id
    `).all(tenantId);

    return {
      resumo: indicadores ? JSON.parse(String(indicadores.resumo)) : [],
      eficiencia: indicadores ? JSON.parse(String(indicadores.eficiencia)) : [],
      rotas: rotas as unknown as Painel['rotas'],
    };
  }

  return { ...auth, ...criarGestao(db), buscarPainel, close: () => db.close() };
}

let store: ReturnType<typeof openStore> | undefined;
export function getStore() {
  if (!store) store = openStore();
  return store;
}
