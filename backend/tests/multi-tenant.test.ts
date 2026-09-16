import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../src/server/store';
import { abrirBanco } from '../src/server/database';
import { cadastrarDemonstracao } from '../src/server/demo';

test('autenticação e isolamento persistem entre conexões, com expiração e revogação', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexo-test-'));
  const path = join(dir, 'test.sqlite');
  let store = openStore(path);
  // Mesmo fluxo da API: autenticar antes de consultar a empresa.
  function painel(token: string | undefined) {
    const sessao = store.session(token);
    return sessao ? { sessao, ...store.buscarPainel(sessao.tenantId) } : null;
  }
  try {
    const seedDb = abrirBanco(path);
    cadastrarDemonstracao(seedDb);
    cadastrarDemonstracao(seedDb); // Provisionar novamente não duplica dados.
    seedDb.close();
    assert.equal(store.login('admin@aurea.com', 'incorreta', 'Administrador'), null);
    assert.equal(store.login('inexistente@aurea.com', 'NexoDemo@2026', 'Administrador'), null);
    assert.equal(store.login('operador@aurea.com', 'NexoDemo@2026', 'Administrador'), null);
    assert.equal(painel(undefined), null);
    assert.equal(painel('a'.repeat(64)), null);
    const a = store.login(' ADMIN@AUREA.COM ', 'NexoDemo@2026', 'Administrador')!;
    const b = store.login('admin@vertex.com', 'NexoDemo@2026', 'Administrador')!;
    assert.ok(a && b);
    assert.equal(store.session(a)?.tenantId, 'aurea');
    assert.equal(store.session(b)?.tenantId, 'vertex');
    const pa = painel(a)!;
    const pb = painel(b)!;
    assert.equal(pa.rotas.length, 3);
    assert.equal(pb.rotas.length, 3);
    assert.ok(pa.rotas.some(r => r.nome.includes('Guarulhos')));
    assert.ok(pb.rotas.some(r => r.nome.includes('Campinas')));
    assert.ok(pa.rotas.every(r => !pb.rotas.some(other => other.nome === r.nome)));
    assert.notDeepEqual(pa.resumo, pb.resumo);
    assert.notDeepEqual(pa.eficiencia, pb.eficiencia);
    const operador = store.login('operador@vertex.com', 'NexoDemo@2026', 'Operador')!;
    assert.equal(store.session(operador)?.perfil, 'Operador');
    assert.equal(store.session(operador)?.tenantId, 'vertex');
    store.close();
    store = openStore(path);
    assert.deepEqual(painel(a), pa);
    store.logout(a);
    assert.equal(painel(a), null);
    assert.ok(painel(b));
    const db = new DatabaseSync(path);
    db.prepare('UPDATE sessoes SET expira = 0').run();
    db.close();
    assert.equal(painel(b), null);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
