import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { abrirRedis } from '../src/server/redis';
import { criarNotificacoesRedis } from '../src/infrastructure/repositories/notificacoes.repository';
import { criarNotificacoes } from '../src/server/notificacoes';
import type { Sessao } from '../src/types';

test('Redis real: mensagens entre instâncias, retenção, limite e cursor monotônico por usuário', { skip: !process.env.REDIS_TEST_URL }, async () => {
  const redis = await abrirRedis(process.env.REDIS_TEST_URL);
  const outroRedis = await abrirRedis(process.env.REDIS_TEST_URL);
  const namespace = `nexo_test_notificacoes_${randomUUID()}`;
  const repo = criarNotificacoesRedis(redis, namespace);
  const produtor = criarNotificacoes(repo);
  const consumidor = criarNotificacoes(criarNotificacoesRedis(outroRedis, namespace));
  const sessao: Sessao = { usuarioId: 'u1', tenantId: 'a', empresa: 'A', nome: 'Teste', perfil: 'Operador' };
  try {
    await produtor.publicar('a', 'frete_criado');
    const primeira = (await consumidor.listar(sessao)).ultimaId!;
    await consumidor.marcarLidas(sessao, { ate: primeira });
    await produtor.publicar('a', 'frete_excluido');
    const segunda = (await consumidor.listar(sessao)).ultimaId!;
    assert.notEqual(primeira, segunda);
    assert.equal((await consumidor.listar(sessao)).naoLidas, 1);
    await consumidor.marcarLidas(sessao, { ate: segunda });
    await consumidor.marcarLidas(sessao, { ate: primeira });
    assert.equal((await consumidor.listar(sessao)).naoLidas, 0, 'requisição antiga não reabre avisos lidos');
    assert.equal((await consumidor.listar({ ...sessao, usuarioId: 'u2' })).naoLidas, 2);
    await assert.rejects(consumidor.marcarLidas({ ...sessao, tenantId: 'b' }, { ate: segunda }));
    for (let i = 0; i < 105; i++) await produtor.publicar('a', 'frete_criado');
    const lista = await consumidor.listar(sessao);
    assert.equal(lista.itens.length, 100);
    assert.equal(lista.naoLidas, 100);
    assert.deepEqual((await consumidor.listar({ ...sessao, tenantId: 'b' })).itens, []);
    const chaves = [] as string[];
    for await (const keys of redis.scanIterator({ MATCH: `${namespace}:*`, COUNT: 100 })) chaves.push(...keys);
    const stream = chaves.find(k => k.endsWith(':eventos'))!;
    assert.equal(await redis.type(stream), 'stream');
    assert.ok(await redis.ttl(stream) > 0);
    // Eventos antigos ficam invisíveis mesmo sem novas publicações.
    await redis.del(stream);
    await redis.xAdd(stream, `${Date.now() - 8 * 86400000}-0`, { tipo: 'frete_criado', criadaEm: new Date(Date.now() - 8 * 86400000).toISOString() });
    assert.equal((await consumidor.listar(sessao)).itens.length, 0);
    await produtor.publicar('a', 'importacao_concluida');
    assert.equal(await redis.xLen(stream), 1, 'publicação remove eventos expirados');
  } finally {
    for await (const keys of redis.scanIterator({ MATCH: `${namespace}:*`, COUNT: 100 })) if (keys.length) await redis.del(keys);
    await outroRedis.quit();
    await redis.quit();
  }
});
