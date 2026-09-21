import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { parseCodeDto, parseLoginDto, parseOAuthLinkDto, parsePasswordDto } from '../src/application/dtos/auth.dto';
import { AuthPresenter } from '../src/application/presenters/auth.presenter';

test('DTO de login aceita o contrato mínimo e preserva perfil opcional', () => {
  assert.deepEqual(parseLoginDto({ email: 'admin@example.com', senha: 'segura', perfil: 'Administrador' }), {
    email: 'admin@example.com', senha: 'segura', perfil: 'Administrador',
  });
  assert.deepEqual(parseLoginDto({ email: 'admin@example.com', senha: 'segura' }), {
    email: 'admin@example.com', senha: 'segura', perfil: undefined,
  });
});

test('DTOs rejeitam corpos, campos vazios e tipos inválidos', () => {
  for (const body of [null, [], 'texto', { email: [], senha: 'segura' }, { email: 'a@b.com', senha: '' }, { email: 'a@b.com', senha: 'segura', perfil: 1 }]) {
    assert.throws(() => parseLoginDto(body), BadRequestException);
  }
  assert.throws(() => parsePasswordDto({ senha: 1 }), BadRequestException);
  assert.throws(() => parseCodeDto({ codigo: '' }), BadRequestException);
  assert.throws(() => parseOAuthLinkDto({ codigo: '123456' }), BadRequestException);
});

test('DTOs de segurança validam campos opcionais sem aceitar dados extras como credenciais', () => {
  assert.deepEqual(parsePasswordDto({ senha: 'segura', token: 'ignorar' }), { senha: 'segura' });
  assert.deepEqual(parseCodeDto({ codigo: '123456', refresh: 'ignorar' }), { codigo: '123456' });
  assert.deepEqual(parseOAuthLinkDto({ senha: 'segura' }), { senha: 'segura', codigo: undefined });
});

test('presenter de autenticação expõe somente sessão ou sinal de MFA', () => {
  const sessao = { usuarioId: 'u1', nome: 'Admin', perfil: 'Administrador' as const, tenantId: 't1', empresa: 'Empresa' };
  const tokens = { access: 'access-secreto', refresh: 'refresh-secreto' };
  assert.deepEqual(AuthPresenter.login({ challenge: 'challenge-secreto' }, sessao), { mfaRequired: true });
  assert.deepEqual(AuthPresenter.login(tokens, sessao), { sessao });
  assert.equal(JSON.stringify(AuthPresenter.login(tokens, sessao)).includes('refresh-secreto'), false);
});