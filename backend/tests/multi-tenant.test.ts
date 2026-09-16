import { fixture } from './fixture';
import { chaveSessao } from '../src/server/auth';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
        (await cadastrarDemonstracao(seedDb));
        (await cadastrarDemonstracao(seedDb)); // Provisionar novamente não duplica dados.
        (await seedDb.close());
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
        const pa = (await painel(a))!;
        const pb = (await painel(b))!;
        assert.equal(pa.rotas.length, 3);
        assert.equal(pb.rotas.length, 3);
        assert.ok(pa.rotas.some(r => r.nome.includes('Guarulhos')));
        assert.ok(pb.rotas.some(r => r.nome.includes('Campinas')));
        assert.ok(pa.rotas.every(r => !pb.rotas.some(other => other.nome === r.nome)));
        assert.notDeepEqual(pa.resumo, pb.resumo);
        assert.notDeepEqual(pa.eficiencia, pb.eficiencia);
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
