import { createHash } from 'node:crypto';
import type { Redis } from '../../server/redis';
import { RETENCAO_IMPORTACAO_MS, type ImportacoesRepository, type TrabalhoImportacao } from '../../domain/importacoes';

// Usado nos testes sem infraestrutura. O store da aplicação usa Redis.
export function criarImportacoesEmMemoria(): ImportacoesRepository {
  const trabalhos = new Map<string, TrabalhoImportacao>();
  return {
    async criar(trabalho) {
      const agora = Date.now();
      for (const [id, atual] of trabalhos) if (agora - atual.criado >= RETENCAO_IMPORTACAO_MS) trabalhos.delete(id);
      if (trabalhos.size >= 100 || [...trabalhos.values()].some(atual => atual.tenantId === trabalho.tenantId && atual.limiteExecucao > agora && ['aguardando', 'processando'].includes(atual.progresso.estado))) return false;
      trabalhos.set(trabalho.progresso.id, structuredClone(trabalho));
      return true;
    },
    async buscar(id) {
      const trabalho = trabalhos.get(id);
      return trabalho && Date.now() - trabalho.criado < RETENCAO_IMPORTACAO_MS ? structuredClone(trabalho) : undefined;
    },
    async salvar(trabalho) { trabalhos.set(trabalho.progresso.id, structuredClone(trabalho)); },
  };
}

export function criarImportacoesRedis(redis: Pick<Redis, 'get' | 'eval'>, namespace: string): ImportacoesRepository {
  // A mesma hash tag mantém os scripts compatíveis com Redis Cluster.
  const prefixo = `${namespace}:importacoes:{jobs}`;
  const chaveJob = (id: string) => `${prefixo}:job:${id}`;
  const chaveEmpresa = (tenantId: string) => `${prefixo}:empresa:${createHash('sha256').update(tenantId).digest('hex')}`;
  return {
    async criar(trabalho) {
      const agora = Date.now();
      const resultado = await redis.eval(`
        redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])
        if redis.call('ZCARD', KEYS[3]) >= 100 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
        redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
        redis.call('SET', KEYS[2], ARGV[4], 'PX', ARGV[5])
        redis.call('ZADD', KEYS[3], ARGV[6], ARGV[4])
        redis.call('PEXPIRE', KEYS[3], ARGV[3])
        return 1
      `, {
        keys: [chaveJob(trabalho.progresso.id), chaveEmpresa(trabalho.tenantId), `${prefixo}:indice`],
        arguments: [String(agora), JSON.stringify(trabalho), String(RETENCAO_IMPORTACAO_MS), trabalho.progresso.id, String(Math.max(1, trabalho.limiteExecucao - agora)), String(agora + RETENCAO_IMPORTACAO_MS)],
      });
      return Number(resultado) === 1;
    },
    async buscar(id) {
      const valor = await redis.get(chaveJob(id));
      return valor ? JSON.parse(valor) as TrabalhoImportacao : undefined;
    },
    async salvar(trabalho) {
      const finalizado = ['concluida', 'falhou'].includes(trabalho.progresso.estado);
      await redis.eval(`
        if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
        redis.call('SET', KEYS[1], ARGV[2], 'XX', 'KEEPTTL')
        if ARGV[3] == '1' then redis.call('DEL', KEYS[2]) end
        return 1
      `, {
        keys: [chaveJob(trabalho.progresso.id), chaveEmpresa(trabalho.tenantId)],
        arguments: [trabalho.progresso.id, JSON.stringify(trabalho), finalizado ? '1' : '0'],
      });
    },
  };
}
