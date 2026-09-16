import { fixture } from '../dist/tests/fixture.js';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

// Executa a API real em processo separado e banco temporário, sem modificar os dados locais.
const cwd = join(dirname(fileURLToPath(import.meta.url)), '..');
const bancoTeste = await fixture();
const reserva = createServer();
reserva.listen(0, '127.0.0.1');
await once(reserva, 'listening');
const port = reserva.address().port;
await new Promise(resolve => reserva.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), FRONTEND_ORIGIN: base, DATABASE_URL: bancoTeste.url };
const seed = spawnSync(process.execPath, ['dist/scripts/seed.js'], { cwd, env, encoding: 'utf8' });
assert.equal(seed.status, 0, seed.stderr);
const server = spawn(process.execPath, ['dist/src/main.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', b => { logs += b; });
server.stderr.on('data', b => { logs += b; });
async function req(path, method = 'GET', cookie = '', body, status = 200, origin = base) {
  const response = await fetch(`${base}/api/${path}`, { method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function login(email, perfil = 'Administrador') { return (await req('sessao', 'POST', '', { email, perfil, senha: 'NexoDemo@2026' })).cookie; }
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(logs);
    try { await fetch(`${base}/api/plataforma`); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(ready, logs);
  await req('gestao/clientes', 'GET', '', undefined, 401);
  const cadastro = { nome: 'Nova administradora', empresa: 'Nova empresa', email: 'nova@example.com', senha: 'NexoDemo@2026' };
  await req('cadastro', 'POST', '', cadastro, 401, 'https://outra.example');
  await req('cadastro', 'POST', '', { ...cadastro, senha: 'curta' }, 400);
  await req('cadastro', 'POST', '', { ...cadastro, email: 'invalido' }, 400);
  await req('cadastro', 'POST', '', { ...cadastro, empresa: ' ' }, 400);
  await req('cadastro', 'POST', '', { ...cadastro, email: ' NOVA@example.com ', tenantId: 'aurea', perfil: 'Gestor' }, 201);
  const nova = await login(cadastro.email);
  const painelNovo = (await req('plataforma', 'GET', nova)).data;
  assert.equal(painelNovo.sessao.perfil, 'Administrador');
  assert.equal(painelNovo.sessao.empresa, cadastro.empresa);
  assert.notEqual(painelNovo.sessao.tenantId, 'aurea');
  assert.deepEqual(painelNovo.rotas, []);
  assert.equal((await req('gestao/usuarios', 'GET', nova)).data.length, 1);
  await req('gestao/usuarios/aurea-admin', 'GET', nova, undefined, 404);
  const [antes] = await bancoTeste.db.pool.query('SELECT COUNT(*) AS total FROM empresas');
  await req('cadastro', 'POST', '', cadastro, 409);
  const [depois] = await bancoTeste.db.pool.query('SELECT COUNT(*) AS total FROM empresas');
  assert.equal(depois[0].total, antes[0].total, 'Cadastro duplicado não deixa empresa órfã');
  await req('sessao', 'DELETE', nova);
  const a = await login('admin@aurea.com');
  const b = await login('admin@vertex.com');
  const operador = await login('operador@aurea.com', 'Operador');
  const gestor = await login('gestor@aurea.com', 'Gestor');
  await req('gestao/usuarios', 'GET', operador, undefined, 403);
  await req('gestao/usuarios', 'GET', gestor, undefined, 403);
  const cliente = { nome: 'Cliente HTTP', email: 'http@example.com', telefone: '', documento: '', tenant_id: 'vertex' };
  await req('gestao/clientes', 'POST', operador, cliente, 403);
  await req('gestao/clientes', 'POST', a, cliente, 403, 'https://outra.example');
  const c = (await req('gestao/clientes', 'POST', gestor, cliente, 201)).data;
  await req(`gestao/clientes/${c.id}`, 'GET', b, undefined, 404);
  await req(`gestao/clientes/${c.id}`, 'PUT', b, cliente, 404);
  await req(`gestao/clientes/${c.id}`, 'DELETE', b, undefined, 404);
  assert.ok((await req('gestao/clientes?q=HTTP&tenant_id=vertex', 'GET', a)).data.some(r => r.id === c.id));
  const transportadora = { nome: 'Transportadora HTTP', email: 't@example.com', telefone: '', taxa_base: 20, valor_kg: 2, valor_km: 0.5 };
  const t = (await req('gestao/transportadoras', 'POST', gestor, transportadora, 201)).data;
  const entrada = { origem: 'São Paulo/SP', destino: 'Campinas/SP', peso: 10, comprimento: 60, largura: 40, altura: 50, distancia: 100, valorCarga: 1000, clienteId: c.id, transportadoraId: t.id };
  await req('simulacoes', 'POST', operador, { ...entrada, peso: -1 }, 400);
  await req('simulacoes', 'POST', operador, { ...entrada, clienteId: 'vertex-cliente' }, 404);
  await req('simulacoes', 'POST', operador, { ...entrada, transportadoraId: 'vertex-transportadora' }, 404);
  const s = (await req('simulacoes', 'POST', operador, entrada, 201)).data;
  assert.equal(s.total, 115);
  await req(`simulacoes/${s.id}`, 'GET', b, undefined, 404);
  assert.equal((await req('simulacoes', 'GET', b)).data.length, 0);
  await req(`gestao/transportadoras/${t.id}`, 'PUT', gestor, { ...transportadora, taxa_base: 100 });
  await req(`gestao/clientes/${c.id}`, 'PUT', gestor, { ...cliente, nome: 'Editado' });
  await req(`gestao/transportadoras/${t.id}`, 'DELETE', gestor);
  await req(`gestao/clientes/${c.id}`, 'DELETE', gestor);
  assert.deepEqual((await req(`simulacoes/${s.id}`, 'GET', a)).data, s);
  const novo = { nome: 'Usuário HTTP', email: 'usuariohttp@example.com', perfil: 'Operador', senha: 'NexoDemo@2026' };
  const u = (await req('gestao/usuarios', 'POST', a, novo, 201)).data;
  assert.equal(u.senha_hash, undefined);
  const token = await login(novo.email, 'Operador');
  await req(`gestao/usuarios/${u.id}`, 'PUT', a, { ...novo, perfil: 'Gestor', senha: '' });
  await req('plataforma', 'GET', token, undefined, 401);
  const token2 = await login(novo.email, 'Gestor');
  await req(`gestao/usuarios/${u.id}`, 'DELETE', a);
  await req('plataforma', 'GET', token2, undefined, 401);
  await req('gestao/usuarios/aurea-admin', 'DELETE', a, undefined, 409);
  await req('sessao', 'DELETE', a);
  await req('simulacoes', 'GET', a, undefined, 401);
  console.log('Integração NestJS aprovada: CRUD, perfis, isolamento, cálculo, histórico e revogação.');
} finally {
  const exit = once(server, 'exit');
  server.kill('SIGTERM');
  await exit;
  await bancoTeste.close();
}
