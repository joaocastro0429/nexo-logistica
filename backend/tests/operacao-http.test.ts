import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { OperacaoController } from '../src/operacao.controller';
import { criarImportacoes } from '../src/server/importacoes';
import type { Sessao } from '../src/types';

test('HTTP: upload multipart, origem, permissões, isolamento e stream SSE', async () => {
  const gestor: Sessao = { usuarioId: 'u', nome: 'Gestor', perfil: 'Gestor', tenantId: 'a', empresa: 'A' };
  const session = async (token?: string) => token === 'gestor' ? gestor : token === 'outra' ? { ...gestor, tenantId: 'b' } : token === 'operador' ? { ...gestor, perfil: 'Operador' as const } : null;
  const registros: unknown[] = [];
  const importacoes = criarImportacoes({ session, salvar: async (_s, _t, body) => { registros.push(body); } });
  const moduloStore = require('../src/server/store');
  const original = moduloStore.getStore;
  moduloStore.getStore = async () => ({ session, importacoes });
  class TestModule {}
  Module({ controllers: [OperacaoController] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  try {
    app.use(cookieParser()); app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const upload = (token: string, origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000', nome = 'clientes.csv') => {
      const body = new FormData(); body.append('arquivo', new Blob(['nome,email\nCliente,a@example.com']), nome);
      return fetch(`${base}/api/importacoes/clientes`, { method: 'POST', headers: { Cookie: `nexo-sessao=${token}`, Origin: origin }, body });
    };
    assert.equal((await upload('invalido')).status, 401);
    assert.equal((await upload('gestor', 'https://invalida.example')).status, 403);
    assert.equal((await upload('operador')).status, 403);
    assert.equal((await upload('gestor', undefined, 'planilha.xlsx')).status, 400);
    const res = await upload('gestor');
    const job = await res.json() as { id: string; message?: string };
    assert.equal(res.status, 202, JSON.stringify(job));
    const headers = { Cookie: 'nexo-sessao=gestor' };
    assert.equal((await fetch(`${base}/api/importacoes/${job.id}`, { headers: { Cookie: 'nexo-sessao=outra' } })).status, 404);
    assert.equal((await fetch(`${base}/api/importacoes/${job.id}/eventos`, { headers: { Cookie: 'nexo-sessao=outra' } })).status, 404);
    const stream = await fetch(`${base}/api/importacoes/${job.id}/eventos`, { headers, signal: AbortSignal.timeout(5000) });
    assert.match(stream.headers.get('content-type') || '', /text\/event-stream/);
    const mensagem = await stream.text();
    assert.match(mensagem, /"estado":"concluida"/);
    assert.match(mensagem, /"importadas":1/);
    assert.equal(registros.length, 1);
  } finally { await importacoes.close(); await app.close(); moduloStore.getStore = original; }
});
