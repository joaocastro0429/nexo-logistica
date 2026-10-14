import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StartupError, startupDiagnostic } from '../src/server/startup';

test('diagnóstico identifica etapa e código sem expor mensagens ou credenciais', () => {
  const cause = Object.assign(new Error('mysql://usuario:SEGREDO@host/banco'), { code: 'ENOTFOUND' });
  const diagnostic = startupDiagnostic(new StartupError('mysql', cause));
  assert.equal(diagnostic.stage, 'mysql');
  assert.equal(diagnostic.code, 'ENOTFOUND');
  assert.equal(JSON.stringify(diagnostic).includes('SEGREDO'), false);
});

test('diagnóstico não registra códigos arbitrários e aceita causas encadeadas', () => {
  assert.equal(startupDiagnostic({ code: 'senha-secreta' }).code, 'UNKNOWN');
  assert.equal(startupDiagnostic(new StartupError('redis', { cause: { code: 'ECONNREFUSED' } })).code, 'ECONNREFUSED');
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(startupDiagnostic(cyclic).code, 'UNKNOWN');
});

test('diagnóstico informa nomes de variáveis ausentes, sem registrar seus valores', () => {
  const previous = process.env.REDIS_URL;
  try {
    delete process.env.REDIS_URL;
    assert.ok(startupDiagnostic(null).missingVariables.includes('REDIS_URL'));
    process.env.REDIS_URL = 'rediss://usuario:SEGREDO@host:6379';
    const diagnostic = startupDiagnostic(null);
    assert.equal(diagnostic.missingVariables.includes('REDIS_URL'), false);
    assert.equal(JSON.stringify(diagnostic).includes('SEGREDO'), false);
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});
