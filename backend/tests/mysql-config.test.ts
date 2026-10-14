import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuracaoMySql } from '../src/infrastructure/database/mysql.config';

const url = 'mysql://nexo:senha%40com%3Acaracteres@localhost:3307/nexo';

test('MySQL local mantém conexão sem TLS e decodifica credenciais da URL', () => {
  assert.deepEqual(configuracaoMySql(url, {}), {
    host: 'localhost', port: 3307, user: 'nexo', password: 'senha@com:caracteres', database: 'nexo', ssl: undefined,
  });
  assert.equal(configuracaoMySql('mysql://nexo:senha@[::1]/nexo', {}).host, '::1');
});

test('MySQL hospedado exige certificado e identidade válidos com TLS 1.2 ou superior', () => {
  for (const env of [{ VERCEL: '1' }, { MYSQL_SSL: 'true' }]) {
    const { ssl } = configuracaoMySql(url, env);
    assert.equal(ssl?.rejectUnauthorized, true);
    assert.equal(ssl?.verifyIdentity, true);
    assert.equal(ssl?.minVersion, 'TLSv1.2');
  }
  const ca = '-----BEGIN CERTIFICATE-----\ncertificado\n-----END CERTIFICATE-----';
  assert.equal(configuracaoMySql(url, { MYSQL_SSL_CA: ca.replace(/\n/g, '\\n') }).ssl?.ca, ca);
  assert.equal(configuracaoMySql(url, { MYSQL_SSL_CA: ca }).ssl?.ca, ca);
  assert.equal(configuracaoMySql(`${url}?ssl-mode=REQUIRED`, {}).ssl?.verifyIdentity, true);
});

test('MySQL rejeita tentativas de desativar TLS quando obrigatório', () => {
  assert.throws(() => configuracaoMySql(url, { VERCEL: '1', MYSQL_SSL: 'false' }), /TLS é obrigatório/);
  assert.throws(() => configuracaoMySql(url, { MYSQL_SSL_CA: 'ca', MYSQL_SSL: 'false' }), /TLS é obrigatório/);
  assert.throws(() => configuracaoMySql(`${url}?ssl-mode=DISABLED`, { VERCEL: '1' }), /TLS é obrigatório/);
  assert.throws(() => configuracaoMySql(`${url}?ssl-mode=REQUIRED`, { MYSQL_SSL: 'false' }), /TLS é obrigatório/);
  assert.throws(() => configuracaoMySql(`${url}?ssl=%7B%22rejectUnauthorized%22%3Afalse%7D`, { VERCEL: '1' }), /Parâmetro não suportado/);
});

test('MySQL rejeita URLs e configurações inválidas sem revelar credenciais', () => {
  for (const value of ['', 'invalida', 'postgres://nexo:segredo@localhost/nexo',
    'mysql://nexo:segredo@localhost', 'mysql://nexo:%XX@localhost/nexo',
    'mysql://nexo:segredo@localhost:0/nexo', `${url}?ssl-mode=PREFERRED`]) {
    assert.throws(() => configuracaoMySql(value, {}), (error: Error) => {
      assert.equal(error.message.includes('segredo'), false);
      assert.equal(error.message.includes('senha%40'), false);
      return true;
    });
  }
  assert.throws(() => configuracaoMySql(url, { MYSQL_SSL: 'yes' }), /MYSQL_SSL deve ser/);
});
