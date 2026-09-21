import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException, BadGatewayException } from '@nestjs/common';
import { criarImportacoes, lerCsv } from '../src/server/importacoes';
import { criarIntegracoes } from '../src/server/integracoes';
import type { Sessao } from '../src/types';
import { criarImportacoesEmMemoria } from '../src/infrastructure/repositories/importacoes.repository';
import { DURACAO_IMPORTACAO_MS } from '../src/domain/importacoes';
const sessao: Sessao = { usuarioId: 'u1', nome: 'Gestor', perfil: 'Gestor', tenantId: 'empresa-a', empresa: 'A' };

test('CSV: BOM, CRLF, delimitadores, aspas escapadas e campos multilinha', () => {
  assert.deepEqual(lerCsv(Buffer.from('\uFEFFnome;email;telefone\r\n"Cliente; ""A""";a@example.com;123\r\n"Cliente\nB";b@example.com;\r\n')), [
    { nome: 'Cliente; "A"', email: 'a@example.com', telefone: '123' }, { nome: 'Cliente\nB', email: 'b@example.com', telefone: '' },
  ]);
});
test('CSV rejeita cabeçalhos arbitrários, formato incorreto, UTF-8 inválido e limites', () => {
  for (const texto of ['', 'nome,nome\nA,B', 'nome,email,tenantId\nA,a@b.com,outro', 'nome,email\nA', 'nome,email\n"A,a@b.com', 'nome,email\n"A"x,a@b.com', 'nome,email\n' + 'A,a@b.com\n'.repeat(501)]) assert.throws(() => lerCsv(Buffer.from(texto)), BadRequestException);
  assert.throws(() => lerCsv(Buffer.from([0xff])), BadRequestException);
  assert.throws(() => lerCsv(Buffer.alloc(256 * 1024 + 1, 65)), BadRequestException);
});
test('importação assíncrona aplica tenant, isola consultas e registra erros parciais', async () => {
  const gravados: unknown[] = [];
  const servico = criarImportacoes({ session: async () => sessao, salvar: async (s, tipo, dados) => {
    assert.equal(s.tenantId, 'empresa-a'); assert.equal(tipo, 'clientes');
    if ((dados as { nome: string }).nome === 'Inválido') throw new BadRequestException('E-mail inválido.');
    gravados.push(dados);
  } });
  const job = await servico.iniciar(sessao, 'token', Buffer.from('nome,email\nVálido,a@b.com\nInválido,erro'));
  assert.equal(job.estado, 'aguardando'); assert.equal(gravados.length, 0);
  await assert.rejects(servico.consultar({ ...sessao, tenantId: 'empresa-b' }, job.id), NotFoundException);
  await assert.rejects(servico.iniciar({ ...sessao, perfil: 'Operador' }, 'token', Buffer.from('nome,email\nA,a@b.com')), ForbiddenException);
  await assert.rejects(servico.iniciar(sessao, 'token', Buffer.from('nome,email\nA,a@b.com')), /Aguarde/);
  await servico.close();
  const final = await servico.consultar(sessao, job.id);
  assert.equal(final.estado, 'concluida'); assert.equal(final.importadas, 1); assert.equal(final.processadas, 2);
  assert.deepEqual(final.erros, [{ linha: 3, mensagem: 'E-mail inválido.' }]);
});
test('revogação da sessão e falha de infraestrutura interrompem o trabalho sem expor detalhes', async () => {
  for (const revogada of [true, false]) {
    const servico = criarImportacoes({ session: async () => revogada ? null : sessao, salvar: async () => { throw new Error('credencial-interna'); } });
    const job = await servico.iniciar(sessao, 'token', Buffer.from('nome,email\nA,a@b.com'));
    await servico.close();
    const final = await servico.consultar(sessao, job.id);
    assert.equal(final.estado, 'falhou'); assert.equal(final.importadas, 0);
    assert.ok(!JSON.stringify(final).includes('credencial-interna'));
  }
});
test('importação compartilha progresso entre instâncias e registra a tarefa no ciclo da requisição', async () => {
  const repository = criarImportacoesEmMemoria();
  let liberar!: () => void;
  const bloqueio = new Promise<void>(resolve => { liberar = resolve; });
  let tarefa: Promise<void> | undefined;
  const deps = { repository, session: async () => sessao, salvar: async () => { await bloqueio; } };
  const instanciaA = criarImportacoes({ ...deps, agendar: promessa => { tarefa = promessa; } });
  const instanciaB = criarImportacoes(deps);
  try {
    const job = await instanciaA.iniciar(sessao, 'token-secreto', Buffer.from('nome,email\nCliente,a@b.com'));
    assert.ok(tarefa, 'a plataforma precisa receber a promessa que mantém o trabalho vivo');
    assert.equal((await instanciaB.consultar(sessao, job.id)).total, 1);
    await assert.rejects(instanciaB.iniciar(sessao, 'token', Buffer.from('nome,email\nOutro,o@b.com')), /Aguarde/);
    await assert.rejects(instanciaB.consultar({ ...sessao, tenantId: 'outra' }, job.id), NotFoundException);
    assert.ok(!JSON.stringify(await repository.buscar(job.id)).includes('token-secreto'));
    liberar(); await tarefa;
    assert.equal((await instanciaB.consultar(sessao, job.id)).estado, 'concluida');
  } finally { liberar(); await instanciaA.close(); await instanciaB.close(); }
});
test('interrupção da instância não deixa o status ativo para sempre; prazo impede novas escritas', async () => {
  const repository = criarImportacoesEmMemoria();
  const agora = Date.now();
  await repository.criar({ tenantId: sessao.tenantId, criado: agora - DURACAO_IMPORTACAO_MS - 1, limiteExecucao: agora - 1, progresso: { id: 'interrompido', estado: 'processando', total: 2, processadas: 1, importadas: 1, erros: [] } });
  let escritas = 0;
  const servico = criarImportacoes({ repository, session: async () => sessao, salvar: async () => { escritas++; }, prazo: () => Date.now() - 1 });
  assert.equal((await servico.consultar(sessao, 'interrompido')).estado, 'falhou');
  const job = await servico.iniciar(sessao, 'token', Buffer.from('nome,email\nCliente,a@b.com'));
  await servico.close();
  assert.equal(escritas, 0);
  assert.equal((await servico.consultar(sessao, job.id)).estado, 'falhou');
});
test('integrações validam entradas antes da rede e normalizam respostas', async () => {
  const urls: string[] = [];
  const integracoes = criarIntegracoes(async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify(String(url).includes('viacep') ? { localidade: 'São Paulo', uf: 'SP', segredo: 'ignorar' } : [{ id: 1, nome: 'São Paulo' }]));
  });
  await assert.rejects(integracoes.cep('../etc'), BadRequestException);
  await assert.rejects(integracoes.municipios('XX'), BadRequestException);
  assert.equal(urls.length, 0);
  assert.deepEqual(await integracoes.cep('01001000'), { cidade: 'São Paulo', uf: 'SP', logradouro: '', bairro: '' });
  assert.deepEqual(await integracoes.municipios('SP'), [{ id: 1, nome: 'São Paulo' }]);
  assert.equal(urls.length, 2);
});
test('integrações tratam CEP inexistente, falha de rede e resposta inválida', async () => {
  await assert.rejects(criarIntegracoes(async () => new Response('{"erro":true}')).cep('99999999'), NotFoundException);
  await assert.rejects(criarIntegracoes(async () => { throw new Error('timeout'); }).cep('01001000'), BadGatewayException);
  await assert.rejects(criarIntegracoes(async () => new Response('{}')).municipios('SP'), BadGatewayException);
});
