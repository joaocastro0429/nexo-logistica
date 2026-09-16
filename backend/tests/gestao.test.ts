import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/server/database';
import { criarGestao, calcularFrete } from '../src/server/gestao';
import { criarAutenticacao } from '../src/server/auth';
import { cadastrarDemonstracao } from '../src/server/demo';
import type { Sessao } from '../src/types';

test('cálculo usa o maior peso e arredonda as parcelas monetárias', () => {
  assert.deepEqual(calcularFrete(10, 60, 40, 50, 100, 1000, { taxa_base: 20, valor_kg: 2, valor_km: 0.5 }), {
    pesoCubado: 20, pesoCobrado: 20, base: 20, porPeso: 40, porDistancia: 50, seguro: 5, total: 115,
  });
  assert.equal(calcularFrete(30, 60, 40, 50, 100, 1000, { taxa_base: 20, valor_kg: 2, valor_km: 0.5 }).total, 135);
});

test('CRUD, permissões e relacionamentos respeitam a empresa; histórico preserva os valores', () => {
  const db = abrirBanco(':memory:');
  try {
    cadastrarDemonstracao(db);
    const store = criarGestao(db);
    const auth = criarAutenticacao(db);
    const sessao = (email: string, perfil: string) => auth.session(auth.login(email, 'NexoDemo@2026', perfil)!)!;
    const a = sessao('admin@aurea.com', 'Administrador');
    const b = sessao('admin@vertex.com', 'Administrador');
    const gestor = sessao('gestor@aurea.com', 'Gestor');
    const operador = sessao('operador@aurea.com', 'Operador');
    const negar = (fn: () => unknown, status: number) => assert.throws(fn, (e: unknown) => (e as { getStatus(): number }).getStatus() === status);
    const cliente = { nome: 'Cliente teste', email: 'teste@example.com', telefone: '', documento: '' };
    const transportadora = { ...cliente, taxa_base: 20, valor_kg: 2, valor_km: 0.5 };
    for (const tipo of ['clientes', 'transportadoras']) {
      const body = tipo === 'clientes' ? cliente : transportadora;
      negar(() => store.salvar(operador, tipo, body), 403);
      const registro = store.salvar(gestor, tipo, { ...body, tenant_id: 'vertex' });
      const id = String(registro.id);
      assert.equal(store.consultar(a, tipo, id).nome, body.nome);
      assert.ok(store.listar(operador, tipo).some(r => r.id === id));
      negar(() => store.consultar(b, tipo, id), 404);
      negar(() => store.salvar(b, tipo, body, id), 404);
      negar(() => store.remover(b, tipo, id), 404);
      store.salvar(gestor, tipo, { ...body, nome: 'Editado' }, id);
      assert.equal(store.consultar(a, tipo, id).nome, 'Editado');
      store.remover(gestor, tipo, id);
      negar(() => store.consultar(a, tipo, id), 404);
    }
    negar(() => store.listar(gestor, 'usuarios'), 403);
    negar(() => store.salvar(operador, 'usuarios', {}), 403);
    negar(() => store.remover(a, 'usuarios', a.usuarioId), 409);
    negar(() => store.salvar(a, 'usuarios', { nome: a.nome, email: 'admin@aurea.com', perfil: 'Operador' }, a.usuarioId), 409);
    const novo = { nome: 'Novo', email: 'novo@example.com', perfil: 'Operador', senha: 'NovaSenha123' };
    const user = store.salvar(a, 'usuarios', novo);
    assert.equal(user.senha_hash, undefined);
    assert.equal(auth.login(novo.email, 'errada', 'Operador'), null);
    const token = auth.login(novo.email, novo.senha, 'Operador')!;
    assert.ok(auth.session(token));
    negar(() => store.salvar(b, 'usuarios', novo, String(user.id)), 404);
    negar(() => store.salvar(a, 'usuarios', novo), 409);
    store.salvar(a, 'usuarios', { ...novo, perfil: 'Gestor', senha: '' }, String(user.id));
    assert.equal(auth.session(token), null);
    assert.ok(auth.login(novo.email, novo.senha, 'Gestor'));
    store.remover(a, 'usuarios', String(user.id));
    assert.equal(auth.login(novo.email, novo.senha, 'Gestor'), null);
    const entrada = { origem: 'São Paulo/SP', destino: 'Campinas/SP', peso: 10, comprimento: 60, largura: 40, altura: 50, distancia: 100, valorCarga: 1000, transportadoraId: 'aurea-transportadora', clienteId: 'aurea-cliente' };
    negar(() => store.simular(operador, { ...entrada, peso: -1 }), 400);
    negar(() => store.simular(operador, { ...entrada, peso: '10' }), 400);
    negar(() => store.simular(operador, { ...entrada, altura: Infinity }), 400);
    negar(() => store.simular(operador, { ...entrada, transportadoraId: 'vertex-transportadora' }), 404);
    negar(() => store.simular(operador, { ...entrada, clienteId: 'vertex-cliente' }), 404);
    assert.equal(store.historico(a).length, 0);
    const simulacao = store.simular(operador, entrada);
    assert.equal(simulacao.total, 115);
    assert.equal(store.historico(b).length, 0);
    negar(() => store.historico(b, simulacao.id), 404);
    store.salvar(a, 'transportadoras', { ...transportadora, taxa_base: 900 }, entrada.transportadoraId);
    store.remover(a, 'transportadoras', entrada.transportadoraId);
    store.remover(a, 'clientes', entrada.clienteId);
    assert.deepEqual(store.historico(a, simulacao.id), simulacao);
    negar(() => store.listar(a, 'usuarios; DROP TABLE empresas'), 404);
  } finally { db.close(); }
});
