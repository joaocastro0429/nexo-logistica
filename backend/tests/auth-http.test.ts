import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppController } from '../src/app.controller';
import { authFixture } from './auth-fixture';
import { TOTP, Secret } from 'otpauth';

test('HTTP: cookies HttpOnly, CSRF, refresh, MFA sem acesso prematuro e limite de tentativas', async () => {
  const { auth, senha } = authFixture();
  const store = require('../src/server/store'); const original = store.getStore;
  store.getStore = async () => ({ ...auth, buscarPainel: async () => ({}), cadastrar: async () => ({ ok: true }) });
  class TestModule {} Module({ controllers: [AppController] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  try {
    app.use(cookieParser()); app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1');
    const base = await app.getUrl(); const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    let cookie = '';
    const req = (path: string, method = 'GET', body?: unknown, source = origin) => fetch(`${base}/api/${path}`, { method, headers: { Cookie: cookie, Origin: source, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const cookies = (res: Response) => res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    assert.equal((await req('sessao', 'POST', { email: 'teste@example.com', senha }, 'https://evil.example')).status, 401);
    assert.equal((await req('sessao', 'POST', { email: [], senha })).status, 400);
    const login = await req('sessao', 'POST', { email: 'teste@example.com', senha, tenantId: 'empresa-invasora' });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).sessao.tenantId, 'empresa-a');
    for (const header of login.headers.getSetCookie()) { assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Lax/); }
    cookie = cookies(login);
    assert.equal((await req('plataforma')).status, 200);
    assert.equal((await req('sessao/refresh', 'POST', undefined, 'https://evil.example')).status, 401);
    const renewed = await req('sessao/refresh', 'POST'); assert.equal(renewed.status, 200); cookie = cookies(renewed);
    const setup = await req('seguranca/mfa/configurar', 'POST', { senha }); assert.equal(setup.status, 201);
    const secret = (await setup.json()).secret;
    const totp = new TOTP({ secret: Secret.fromBase32(secret) });
    const enabled = await req('seguranca/mfa/ativar', 'POST', { codigo: totp.generate() }); assert.equal(enabled.status, 201);
    const recoveryCodes = (await enabled.json()).recoveryCodes;
    assert.equal((await req('plataforma')).status, 401);
    const challenge = await req('sessao', 'POST', { email: 'teste@example.com', senha });
    assert.deepEqual(await challenge.json(), { mfaRequired: true }); cookie = cookies(challenge);
    assert.equal((await req('plataforma')).status, 401);
    assert.equal((await req('sessao/refresh', 'POST')).status, 401);
    const completed = await req('sessao/mfa', 'POST', { codigo: recoveryCodes[0] }); assert.equal(completed.status, 200);
    cookie = cookies(completed); assert.equal((await req('plataforma')).status, 200);
    assert.equal((await req('sessao', 'DELETE')).status, 200);
    assert.equal((await req('sessao/refresh', 'POST')).status, 401);
    for (let i = 0; i < 10; i++) await req('sessao', 'POST', { email: 'ataque@example.com', senha: 'errada' });
    assert.equal((await req('sessao', 'POST', { email: 'ataque@example.com', senha: 'errada' })).status, 429);
  } finally { await app.close(); store.getStore = original; }
});
