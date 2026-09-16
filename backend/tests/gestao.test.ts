import { fixture } from './fixture';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/server/database';
import { criarGestao, calcularFrete } from '../src/server/gestao';
import { criarAutenticacao } from '../src/server/auth';
import { cadastrarDemonstracao } from '../src/server/demo';
import type { Sessao } from '../src/types';
import { MySqlAutenticacaoRepository, MySqlGestaoRepository } from '../src/infrastructure/repositories/mysql.repositories';

test('CRUD, permissões e relacionamentos respeitam a empresa; histórico preserva os valores', async () => {
    const bancoTeste = await fixture();
    const db = bancoTeste.db;
    try {
        (await cadastrarDemonstracao(db));
        const store = criarGestao(new MySqlGestaoRepository(db.db));
        const auth = criarAutenticacao(new MySqlAutenticacaoRepository(db.db), bancoTeste.redis);
        const sessao = async (email: string, perfil: string) => (await auth.session((await auth.login(email, 'NexoDemo@2026', perfil))!))!;
        const a = (await sessao('admin@aurea.com', 'Administrador'));
        const b = (await sessao('admin@vertex.com', 'Administrador'));
        const gestor = (await sessao('gestor@aurea.com', 'Gestor'));
        const operador = (await sessao('operador@aurea.com', 'Operador'));
        const negar = (fn: () => Promise<unknown>, status: number) => assert.rejects(fn, (e: unknown) => (e as {
            getStatus(): number;
        }).getStatus() === status);
        const cliente = { nome: 'Cliente teste', email: 'teste@example.com', telefone: '', documento: '' };
        const transportadora = { ...cliente, taxa_base: 20, valor_kg: 2, valor_km: 0.5 };
        for (const tipo of ['clientes', 'transportadoras']) {
            const body = tipo === 'clientes' ? cliente : transportadora;
            (await negar(async () => (await store.salvar(operador, tipo, body)), 403));
            const registro = (await store.salvar(gestor, tipo, { ...body, tenant_id: 'vertex' }));
            const id = String(registro.id);
            assert.equal((await store.consultar(a, tipo, id)).nome, body.nome);
            assert.ok((await (await store.listar(operador, tipo)).some(r => r.id === id)));
            (await negar(async () => (await store.consultar(b, tipo, id)), 404));
            (await negar(async () => (await store.salvar(b, tipo, body, id)), 404));
            (await negar(async () => (await store.remover(b, tipo, id)), 404));
            (await store.salvar(gestor, tipo, { ...body, nome: 'Editado' }, id));
            assert.equal((await store.consultar(a, tipo, id)).nome, 'Editado');
            (await store.remover(gestor, tipo, id));
            (await negar(async () => (await store.consultar(a, tipo, id)), 404));
        }
        (await negar(async () => (await store.listar(gestor, 'usuarios')), 403));
        (await negar(async () => (await store.salvar(operador, 'usuarios', {})), 403));
        (await negar(async () => (await store.remover(a, 'usuarios', a.usuarioId)), 409));
        (await negar(async () => (await store.salvar(a, 'usuarios', { nome: a.nome, email: 'admin@aurea.com', perfil: 'Operador' }, a.usuarioId)), 409));
        const novo = { nome: 'Novo', email: 'novo@example.com', perfil: 'Operador', senha: 'NovaSenha123' };
        const user = (await store.salvar(a, 'usuarios', novo));
        assert.equal(user.senha_hash, undefined);
        assert.equal((await auth.login(novo.email, 'errada', 'Operador')), null);
        const token = (await auth.login(novo.email, novo.senha, 'Operador'))!;
        assert.ok((await auth.session(token)));
        (await negar(async () => (await store.salvar(b, 'usuarios', novo, String(user.id))), 404));
        (await negar(async () => (await store.salvar(a, 'usuarios', novo)), 409));
        (await store.salvar(a, 'usuarios', { ...novo, perfil: 'Gestor', senha: '' }, String(user.id)));
        assert.equal((await auth.session(token)), null);
        assert.ok((await auth.login(novo.email, novo.senha, 'Gestor')));
        (await store.remover(a, 'usuarios', String(user.id)));
        assert.equal((await auth.login(novo.email, novo.senha, 'Gestor')), null);
        const entrada = { origem: 'São Paulo/SP', destino: 'Campinas/SP', peso: 10, comprimento: 60, largura: 40, altura: 50, distancia: 100, valorCarga: 1000, transportadoraId: 'aurea-transportadora', clienteId: 'aurea-cliente' };
        (await negar(async () => (await store.simular(operador, { ...entrada, peso: -1 })), 400));
        (await negar(async () => (await store.simular(operador, { ...entrada, peso: '10' })), 400));
        (await negar(async () => (await store.simular(operador, { ...entrada, altura: Infinity })), 400));
        (await negar(async () => (await store.simular(operador, { ...entrada, transportadoraId: 'vertex-transportadora' })), 404));
        (await negar(async () => (await store.simular(operador, { ...entrada, clienteId: 'vertex-cliente' })), 404));
        assert.equal((await store.historico(a)).length, 0);
        const simulacao = (await store.simular(operador, entrada));
        assert.equal(simulacao.total, 115);
        assert.equal((await store.historico(b)).length, 0);
        (await negar(async () => (await store.historico(b, simulacao.id)), 404));
        (await store.salvar(a, 'transportadoras', { ...transportadora, taxa_base: 900 }, entrada.transportadoraId));
        (await store.remover(a, 'transportadoras', entrada.transportadoraId));
        (await store.remover(a, 'clientes', entrada.clienteId));
        assert.deepEqual((await store.historico(a, simulacao.id)), simulacao);
        (await negar(async () => (await store.listar(a, 'usuarios; DROP TABLE empresas')), 404));
    }
    finally {
        await bancoTeste.close();
    }
});
