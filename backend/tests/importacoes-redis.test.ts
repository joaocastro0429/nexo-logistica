import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { abrirRedis } from '../src/server/redis';
import { criarImportacoesRedis } from '../src/infrastructure/repositories/importacoes.repository';
import { criarImportacoes } from '../src/server/importacoes';
import type { TrabalhoImportacao } from '../src/domain/importacoes';
import type { Sessao } from '../src/types';

test('Redis real: concorrência entre instâncias, isolamento, expiração e liberação por proprietário', async () => {
  const redis = await abrirRedis();
  const namespace = `nexo_test_importacoes_${randomUUID()}`;
  const a = criarImportacoesRedis(redis, namespace);
  const b = criarImportacoesRedis(redis, namespace);
  const sessao: Sessao = { usuarioId: 'u', nome: 'Gestor', perfil: 'Gestor', tenantId: 'a', empresa: 'A' };
  const job = (id: string, tenantId = 'a'): TrabalhoImportacao => ({ tenantId, criado: Date.now(), limiteExecucao: Date.now() + 300000, progresso: { id, estado: 'aguardando', total: 1, processadas: 0, importadas: 0, erros: [] } });
  try {
    const tentativas = Array.from({ length: 8 }, (_, i) => job(`job-${i}`));
    const resultados = await Promise.all(tentativas.map((j, i) => (i % 2 ? a : b).criar(j)));
    assert.equal(resultados.filter(Boolean).length, 1);
    const vencedor = tentativas[resultados.indexOf(true)];
    assert.equal((await b.buscar(vencedor.progresso.id))?.tenantId, 'a');
    const consulta = criarImportacoes({ repository: b, session: async () => sessao, salvar: async () => {} });
    await assert.rejects(consulta.consultar({ ...sessao, tenantId: 'b' }, vencedor.progresso.id), /não encontrada/);
    await consulta.close();
    vencedor.progresso.estado = 'concluida';
    await a.salvar(vencedor);
    assert.equal((await b.buscar(vencedor.progresso.id))?.progresso.estado, 'concluida');
    const novo = job('novo');
    assert.equal(await b.criar(novo), true);
    await a.salvar(vencedor);
    assert.equal(await a.criar(job('bloqueado')), false, 'um trabalho antigo não libera o lock atual');
    assert.equal(await a.criar(job('outra-empresa', 'b')), true);
    const expirado = job('expirado', 'c');
    expirado.limiteExecucao = Date.now() + 20;
    assert.equal(await a.criar(expirado), true);
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(await b.criar(job('substituto', 'c')), true, 'lock expira após interrupção');
    const ttl = await redis.pTTL(`${namespace}:importacoes:{jobs}:job:${vencedor.progresso.id}`);
    assert.ok(ttl > 0 && ttl <= 3600000);
  } finally {
    for await (const keys of redis.scanIterator({ MATCH: `${namespace}:*`, COUNT: 100 })) if (keys.length) await redis.del(keys);
    await redis.quit();
  }
});
