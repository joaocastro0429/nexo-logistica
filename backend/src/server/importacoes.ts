import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import type { Sessao } from '../types';
import { DURACAO_IMPORTACAO_MS, type ImportacoesRepository, type Progresso, type TrabalhoImportacao } from '../domain/importacoes';
import { criarImportacoesEmMemoria } from '../infrastructure/repositories/importacoes.repository';
export type { Progresso } from '../domain/importacoes';

// CSV com vírgula ou ponto e vírgula, aspas escapadas e campos multilinha.
export function lerCsv(buffer: Buffer): Record<string, string>[] {
  let texto: string;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, ''); }
  catch { throw new BadRequestException('O CSV deve usar codificação UTF-8.'); }
  if (!buffer.length || buffer.length > 256 * 1024 || texto.includes('\0')) throw new BadRequestException('Envie um CSV de até 256 KB.');
  const separador = texto.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [], campo = '', aspas = false, fechou = false;
  const finalizarCampo = () => { linha.push(campo.trim()); campo = ''; fechou = false; };
  const finalizarLinha = () => { finalizarCampo(); if (linha.some(Boolean)) linhas.push(linha); linha = []; if (linhas.length > 501) throw new BadRequestException('Limite de 500 registros por arquivo.'); };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') { aspas = false; fechou = true; }
      else campo += c;
    } else if (c === separador) finalizarCampo();
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; finalizarLinha(); }
    else if (c === '"' && !campo && !fechou) aspas = true;
    else if (c === '"' || fechou) throw new BadRequestException('Aspas inválidas no CSV.');
    else campo += c;
  }
  if (aspas) throw new BadRequestException('Campo com aspas não fechado.');
  if (campo || linha.length || fechou) finalizarLinha();
  const cabecalho = linhas.shift();
  if (!cabecalho || !cabecalho.includes('nome') || !cabecalho.includes('email') || new Set(cabecalho).size !== cabecalho.length || cabecalho.some(c => !['nome', 'email', 'telefone', 'documento'].includes(c))) throw new BadRequestException('Cabeçalho: nome,email,telefone,documento. Nome e email são obrigatórios.');
  if (!linhas.length) throw new BadRequestException('O CSV não contém registros.');
  return linhas.map((valores, index) => {
    if (valores.length !== cabecalho.length) throw new BadRequestException(`Registro ${index + 2}: quantidade de colunas inválida.`);
    return Object.fromEntries(cabecalho.map((chave, i) => [chave, valores[i]]));
  });
}

export function criarImportacoes(deps: {
  session: (token: string | undefined) => Promise<Sessao | null>;
  salvar: (sessao: Sessao, tipo: string, body: unknown) => Promise<unknown>;
  repository?: ImportacoesRepository;
  agendar?: (tarefa: Promise<void>) => void;
  prazo?: () => number;
}) {
  const repository = deps.repository ?? criarImportacoesEmMemoria();
  const pendentes = new Set<Promise<void>>();
  let encerrando = false;
  const interromper = (p: Progresso) => {
    p.estado = 'falhou';
    p.erros.push({ linha: p.processadas + 2, mensagem: 'Processamento interrompido. Verifique sua sessão e os cadastros já importados antes de reenviar.' });
  };
  async function consultar(sessao: Sessao, id: string): Promise<Progresso> {
    const job = await repository.buscar(id);
    if (!job || job.tenantId !== sessao.tenantId) throw new NotFoundException('Importação não encontrada.');
    if (Date.now() >= job.limiteExecucao && ['aguardando', 'processando'].includes(job.progresso.estado)) interromper(job.progresso);
    return structuredClone(job.progresso);
  }
  async function iniciar(sessao: Sessao, token: string, buffer: Buffer) {
    if (sessao.perfil === 'Operador') throw new ForbiddenException('Somente administradores e gestores importam clientes.');
    if (encerrando) throw new HttpException('Servidor encerrando. Tente novamente.', 503);
    const linhas = lerCsv(buffer);
    const p: Progresso = { id: randomUUID(), estado: 'aguardando', total: linhas.length, processadas: 0, importadas: 0, erros: [] };
    const criado = Date.now();
    const job: TrabalhoImportacao = { tenantId: sessao.tenantId, criado, limiteExecucao: criado + DURACAO_IMPORTACAO_MS, progresso: p };
    const prazo = Math.min(job.limiteExecucao - 30000, deps.prazo?.() ?? Infinity);
    if (!await repository.criar(job)) throw new HttpException('Aguarde a importação atual ou tente mais tarde.', 429);
    const inicial = structuredClone(p);
    const executar = async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
      p.estado = 'processando';
      try {
        await repository.salvar(job);
        for (const [index, dados] of linhas.entries()) {
          if (Date.now() >= prazo) throw new Error('Tempo de execução esgotado');
          const atual = await deps.session(token);
          if (!atual || atual.tenantId !== sessao.tenantId || atual.perfil === 'Operador') throw new Error('Sessão revogada');
          try { await deps.salvar(atual, 'clientes', dados); p.importadas++; }
          catch (error) {
            if (!(error instanceof BadRequestException)) throw error;
            p.erros.push({ linha: index + 2, mensagem: error.message });
          }
          p.processadas++;
          await repository.salvar(job);
        }
        p.estado = 'concluida';
      } catch { interromper(p); }
      await repository.salvar(job);
    };
    const tarefa = executar().catch(() => { console.error('Não foi possível registrar o resultado da importação.'); });
    pendentes.add(tarefa);
    void tarefa.then(() => pendentes.delete(tarefa));
    deps.agendar?.(tarefa);
    return inicial;
  }
  return { iniciar, consultar, close: async () => { encerrando = true; await Promise.all(pendentes); } };
}
