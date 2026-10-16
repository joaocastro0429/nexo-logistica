import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Module, BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { criarNotificacoes } from '../src/server/notificacoes';
import { NotificacoesController } from '../src/notificacoes.controller';
import type { NotificacoesRepository, EventoNotificacao } from '../src/domain/notificacoes';
import type { Sessao } from '../src/types';

function fixture() {
  const eventos = new Map<string, EventoNotificacao[]>();
  const lidas = new Map<string, string>();
  const repo: NotificacoesRepository = {
    async publicar(tenant, tipo) { eventos.set(tenant, [{ id: `${Date.now()}-${(eventos.get(tenant)?.length || 0) + 1}`, tipo, criadaEm: new Date().toISOString() }, ...eventos.get(tenant) || []]); },
    async listar(tenant) { return eventos.get(tenant) || []; },
    async ultimaLida(tenant, usuario) { return lidas.get(`${tenant}:${usuario}`) || '0-0'; },
    async marcarLidas(tenant, usuario, ate) { if (!eventos.get(tenant)?.some(e => e.id === ate)) return false; lidas.set(`${tenant}:${usuario}`, ate); return true; },
  };
  return { repo, servico: criarNotificacoes(repo) };
}
const sessao: Sessao = { usuarioId: 'u1', tenantId: 'a', empresa: 'A', nome: 'Operador', perfil: 'Operador' };

test('notificações: isolamento por empresa, leitura individual e validação', async () => {
  const { servico } = fixture();
  await servico.publicar('a', 'frete_criado');
  const lista = await servico.listar(sessao);
  assert.equal(lista.naoLidas, 1);
  assert.equal(lista.itens[0].titulo, 'Nova simulação de frete');
  assert.equal((await servico.listar({ ...sessao, tenantId: 'b' })).itens.length, 0);
  await assert.rejects(servico.marcarLidas({ ...sessao, tenantId: 'b' }, { ate: lista.ultimaId }), BadRequestException);
  await assert.rejects(servico.marcarLidas(sessao, { ate: 'invalido', tenantId: 'b' }), BadRequestException);
  await assert.rejects(servico.marcarLidas(sessao, { ate: '99999999999999999999-0' }), BadRequestException);
  await servico.marcarLidas(sessao, { ate: lista.ultimaId, tenantId: 'b', usuarioId: 'outro' });
  assert.equal((await servico.listar(sessao)).naoLidas, 0);
  assert.equal((await servico.listar({ ...sessao, usuarioId: 'u2' })).naoLidas, 1);
});

test('HTTP notificações: autenticação, origem e empresa vindas da sessão', async () => {
  const { servico } = fixture();
  await servico.publicar('a', 'frete_excluido');
  const moduloStore = require('../src/server/store');
  const original = moduloStore.getStore;
  moduloStore.getStore = async () => ({ notificacoes: servico, session: async (token?: string) => token === 'a' ? sessao : token === 'b' ? { ...sessao, tenantId: 'b' } : null });
  class TestModule {}
  Module({ controllers: [NotificacoesController] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  try {
    app.use(cookieParser()); app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    assert.equal((await fetch(`${base}/api/notificacoes`)).status, 401);
    const lista = await (await fetch(`${base}/api/notificacoes`, { headers: { Cookie: 'nexo-sessao=a' } })).json() as { ultimaId: string; naoLidas: number };
    assert.equal(lista.naoLidas, 1);
    const escrever = (cookie: string, origin: string) => fetch(`${base}/api/notificacoes/lidas`, { method: 'POST', headers: { Cookie: `nexo-sessao=${cookie}`, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ ate: lista.ultimaId, tenantId: 'a' }) });
    const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    assert.equal((await escrever('a', 'https://invalida.example')).status, 403);
    assert.equal((await escrever('invalida', origin)).status, 401);
    assert.equal((await escrever('b', origin)).status, 400);
    assert.equal((await escrever('a', origin)).status, 201);
    assert.equal((await servico.listar(sessao)).naoLidas, 0);
  } finally { await app.close(); moduloStore.getStore = original; }
});

import { GestaoController } from '../src/gestao.controller';
import { criarImportacoes } from '../src/server/importacoes';

test('fretes publicam somente após sucesso; importação publica conclusão ou falha', async () => {
  const publicados: string[] = [];
  const moduloStore = require('../src/server/store');
  const original = moduloStore.getStore;
  let falhar = false;
  moduloStore.getStore = async () => ({
    session: async () => sessao,
    simular: async () => { if (falhar) throw new Error('Falha simulada'); return { id: 's1' }; },
    removerSimulacao: async () => { if (falhar) throw new Error('Falha simulada'); return { ok: true }; },
    notificacoes: { publicar: async (tenant: string, tipo: string) => { assert.equal(tenant, 'a'); publicados.push(tipo); } },
  });
  try {
    const controller = new GestaoController();
    const req = { headers: { origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }, cookies: { 'nexo-sessao': 'a' } } as any;
    await controller.simular(req, {}); await controller.removerSimulacao(req, 's1');
    falhar = true;
    await assert.rejects(controller.simular(req, {})); await assert.rejects(controller.removerSimulacao(req, 's1'));
    assert.deepEqual(publicados, ['frete_criado', 'frete_excluido']);
  } finally { moduloStore.getStore = original; }
  for (const falha of [false, true]) {
    const importacoes = criarImportacoes({ session: async () => falha ? null : { ...sessao, perfil: 'Gestor' }, salvar: async () => {}, notificar: async (tenant, tipo) => { assert.equal(tenant, 'a'); publicados.push(tipo); } });
    await importacoes.iniciar({ ...sessao, perfil: 'Gestor' }, 'token-nao-publicado', Buffer.from('nome,email\nCliente,a@example.com'));
    await importacoes.close();
  }
  assert.deepEqual(publicados, ['frete_criado', 'frete_excluido', 'importacao_concluida', 'importacao_falhou']);
});
