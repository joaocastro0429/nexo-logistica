import { fixture } from './fixture';
import { chaveSessao } from '../src/server/auth';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/server/store';
import { abrirBanco } from '../src/server/database';
import { cadastrarDemonstracao } from '../src/server/demo';
test('autenticação e isolamento persistem entre conexões, com expiração e revogação', async () => {
    const bancoTeste = await fixture();
    const path = bancoTeste.url;
    let store = (await openStore(path));
    // Mesmo fluxo da API: autenticar antes de consultar a empresa.
    async function painel(token: string | undefined) {
        const sessao = (await store.session(token));
        return sessao ? { sessao, ...(await store.buscarPainel(sessao.tenantId)) } : null;
    }
    try {
        const seedDb = (await abrirBanco(path));
        try {
            await cadastrarDemonstracao(seedDb);
            await cadastrarDemonstracao(seedDb); // Provisionar novamente não duplica dados.
        } finally { await seedDb.close(); }
        assert.equal((await store.login('admin@aurea.com', 'incorreta', 'Administrador')), null);
        assert.equal((await store.login('inexistente@aurea.com', 'NexoDemo@2026', 'Administrador')), null);
        assert.equal((await store.login('operador@aurea.com', 'NexoDemo@2026', 'Administrador')), null);
        assert.equal((await painel(undefined)), null);
        assert.equal((await painel('a'.repeat(64))), null);
        const a = (await store.login(' ADMIN@AUREA.COM ', 'NexoDemo@2026', 'Administrador'))!;
        const b = (await store.login('admin@vertex.com', 'NexoDemo@2026', 'Administrador'))!;
        assert.ok(a && b);
        assert.equal((await store.session(a))?.tenantId, 'aurea');
        assert.equal((await store.session(b))?.tenantId, 'vertex');
        assert.deepEqual((await painel(a))!.rotas, []);
        await store.simular((await store.session(a))!, {
            origem: 'São Paulo', destino: 'Guarulhos', peso: 10, comprimento: 60,
            largura: 40, altura: 50, distancia: 100, valorCarga: 1000,
            transportadoraId: 'aurea-transportadora',
        });
        const pa = (await painel(a))!;
        const pb = (await painel(b))!;
        assert.equal(pa.rotas.length, 1);
        assert.equal(pb.rotas.length, 0);
        assert.equal(pa.resumo[0].valor, '1');
        assert.equal(pb.resumo[0].valor, '0');
        assert.ok(pa.rotas[0].nome.includes('Guarulhos'));
        assert.notDeepEqual(pa.insights, pb.insights);
        const operador = (await store.login('operador@vertex.com', 'NexoDemo@2026', 'Operador'))!;
        assert.equal((await store.session(operador))?.perfil, 'Operador');
        assert.equal((await store.session(operador))?.tenantId, 'vertex');
        (await store.close());
        store = (await openStore(path));
        assert.deepEqual((await painel(a)), pa);
        (await store.logout(a));
        assert.equal((await painel(a)), null);
        assert.ok((await painel(b)));
        await bancoTeste.redis.pExpire(chaveSessao(b), 1);
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal((await painel(b)), null);
    }
    finally {
        (await store.close());
        await bancoTeste.close();
    }
});
