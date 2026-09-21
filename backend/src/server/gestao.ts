import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuditoriaRepository, GestaoRepository, Recurso } from '../domain/repositories';
import type { Sessao } from '../types';

type Dados = Record<string, unknown>;

function objeto(body: unknown): Dados {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Dados inválidos.');
  return body as Dados;
}

function texto(body: Dados, campo: string, max = 150, obrigatorio = true) {
  const value = body[campo] ?? '';
  if (typeof value !== 'string' || value.trim().length > max || (obrigatorio && !value.trim())) throw new BadRequestException(`Campo ${campo} inválido.`);
  return value.trim();
}

function numero(body: Dados, campo: string, min: number, max: number) {
  const value = body[campo];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new BadRequestException(`Campo ${campo} deve estar entre ${min} e ${max}.`);
  return value;
}

const dinheiro = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calcularFrete(peso: number, comprimento: number, largura: number, altura: number, distancia: number, valorCarga: number, tarifa: { taxa_base: number; valor_kg: number; valor_km: number }) {
  const pesoCubado = comprimento * largura * altura / 6000;
  const pesoCobrado = Math.max(peso, pesoCubado);
  const base = dinheiro(tarifa.taxa_base);
  const porPeso = dinheiro(pesoCobrado * tarifa.valor_kg);
  const porDistancia = dinheiro(distancia * tarifa.valor_km);
  const seguro = dinheiro(valorCarga * 0.005);
  return { pesoCubado, pesoCobrado, base, porPeso, porDistancia, seguro, total: dinheiro(base + porPeso + porDistancia + seguro) };
}

type AuditContext = { ip?: string };
export function criarGestao(repository: GestaoRepository, auditoria?: AuditoriaRepository) {
  const registrar = (evento: Parameters<AuditoriaRepository['registrar']>[0]) => auditoria?.registrar(evento) || Promise.resolve();
  function recurso(tipo: string): Recurso {
    if (!['usuarios', 'clientes', 'transportadoras'].includes(tipo)) throw new NotFoundException('Cadastro inexistente.');
    return tipo as Recurso;
  }

  function permitir(sessao: Sessao, tipo: Recurso, escrita = false) {
    if (tipo === 'usuarios' && sessao.perfil !== 'Administrador') throw new ForbiddenException('Somente administradores gerenciam usuários.');
    if (escrita && sessao.perfil === 'Operador') throw new ForbiddenException('Seu perfil permite apenas consultar este cadastro.');
  }

  async function consultar(sessao: Sessao, tipo: string, id: string) {
    const tabela = recurso(tipo);
    permitir(sessao, tabela);
    const row = await repository.buscar(sessao.tenantId, tabela, id);
    if (!row) throw new NotFoundException('Registro não encontrado.');
    return row;
  }

  async function listar(sessao: Sessao, tipo: string, busca = '') {
    const tabela = recurso(tipo);
    permitir(sessao, tabela);
    return repository.listar(sessao.tenantId, tabela, busca);
  }

  function validar(tipo: Recurso, body: unknown, edicao: boolean): Dados {
    const dados = objeto(body);
    const nome = texto(dados, 'nome');
    const email = texto(dados, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail inválido.');
    if (tipo === 'usuarios') {
      const perfil = texto(dados, 'perfil');
      if (!['Administrador', 'Gestor', 'Operador'].includes(perfil)) throw new BadRequestException('Perfil inválido.');
      const senha = dados.senha;
      if ((!edicao || (senha !== undefined && senha !== '')) && (typeof senha !== 'string' || senha.length < 8 || senha.length > 256)) throw new BadRequestException('A senha deve ter entre 8 e 256 caracteres.');
      const result: Dados = { nome, email, perfil };
      if (typeof senha === 'string' && senha) {
        const salt = randomBytes(16).toString('hex');
        result.senha_hash = `${salt}:${scryptSync(senha, salt, 64).toString('hex')}`;
      }
      return result;
    }
    const telefone = texto(dados, 'telefone', 30, false);
    if (tipo === 'clientes') return { nome, email, telefone, documento: texto(dados, 'documento', 30, false) };
    return { nome, email, telefone, taxa_base: numero(dados, 'taxa_base', 0, 100000), valor_kg: numero(dados, 'valor_kg', 0, 10000), valor_km: numero(dados, 'valor_km', 0, 10000) };
  }

  async function salvar(sessao: Sessao, tipo: string, body: unknown, id?: string, context?: AuditContext) {
    const tabela = recurso(tipo);
    permitir(sessao, tabela, true);
    const values = validar(tabela, body, Boolean(id));
    const atual = id ? await consultar(sessao, tabela, id) : null;
    if (tabela === 'usuarios') {
      if (atual?.perfil === 'Administrador' && values.perfil !== 'Administrador' && await repository.contarAdministradores(sessao.tenantId) <= 1) throw new ConflictException('A empresa precisa manter pelo menos um administrador.');
      if (await repository.emailEmUso(String(values.email), id)) throw new ConflictException('Este e-mail já está cadastrado no Nexo (em qualquer empresa). Use outro e-mail para criar o usuário.');
    }
    const fieldMap: Record<string, string> = { senha_hash: 'senhaHash', taxa_base: 'taxaBase', valor_kg: 'valorKg', valor_km: 'valorKm' };
    const persistValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [fieldMap[key] || key, value]));
    const result = await repository.salvar(sessao.tenantId, tabela, persistValues, id);
    if (tabela === 'usuarios' && id) await repository.incrementarVersaoSessao(sessao.tenantId, id);
    const acao = tabela === 'usuarios' && id && atual?.perfil !== values.perfil ? 'PERMISSAO_ALTERADA' : id ? 'OPERACAO_ADMINISTRATIVA' : tabela === 'usuarios' ? 'USUARIO_CRIADO' : 'OPERACAO_ADMINISTRATIVA';
    await registrar({ tenantId: sessao.tenantId, usuarioId: sessao.usuarioId, acao, recurso: tabela, recursoId: String(result.id), ip: context?.ip, detalhes: tabela === 'usuarios' && id && atual?.perfil !== values.perfil ? { perfilAnterior: atual?.perfil, perfilNovo: values.perfil } : { operacao: id ? 'alteracao' : 'criacao' } });
    return result;
  }

  async function remover(sessao: Sessao, tipo: string, id: string, context?: AuditContext) {
    const tabela = recurso(tipo);
    permitir(sessao, tabela, true);
    const atual = await consultar(sessao, tabela, id);
    if (tabela === 'usuarios' && atual.perfil === 'Administrador' && await repository.contarAdministradores(sessao.tenantId) <= 1) throw new ConflictException('A empresa precisa manter pelo menos um administrador.');
    await repository.remover(sessao.tenantId, tabela, id);
    await registrar({ tenantId: sessao.tenantId, usuarioId: sessao.usuarioId, acao: tabela === 'usuarios' ? 'USUARIO_REMOVIDO' : 'OPERACAO_ADMINISTRATIVA', recurso: tabela, recursoId: id, ip: context?.ip, detalhes: { operacao: 'remocao' } });
    return { ok: true };
  }

  async function simular(sessao: Sessao, body: unknown) {
    const dados = objeto(body);
    const origem = texto(dados, 'origem');
    const destino = texto(dados, 'destino');
    const peso = numero(dados, 'peso', 0.01, 100000);
    const comprimento = numero(dados, 'comprimento', 0.01, 1000);
    const largura = numero(dados, 'largura', 0.01, 1000);
    const altura = numero(dados, 'altura', 0.01, 1000);
    const distancia = numero(dados, 'distancia', 0, 20000);
    const valorCarga = numero(dados, 'valorCarga', 0, 100000000);
    const transportadora = await consultar(sessao, 'transportadoras', texto(dados, 'transportadoraId'));
    const clienteId = texto(dados, 'clienteId', 150, false);
    const cliente = clienteId ? await consultar(sessao, 'clientes', clienteId) : null;
    const tarifas = { taxa_base: Number(transportadora.taxa_base), valor_kg: Number(transportadora.valor_kg), valor_km: Number(transportadora.valor_km) };
    const result = { id: randomUUID(), criada_em: new Date().toISOString(), usuario: sessao.nome, origem, destino, peso, comprimento, largura, altura, distancia, valorCarga, cliente, transportadora, formula: 'v1', ...calcularFrete(peso, comprimento, largura, altura, distancia, valorCarga, tarifas) };
    await repository.salvarSimulacao(sessao.tenantId, result.id, result.criada_em, JSON.stringify(result));
    return result;
  }

  async function historico(sessao: Sessao, id?: string) {
    if (id) {
      const dados = await repository.buscarSimulacao(sessao.tenantId, id);
      if (!dados) throw new NotFoundException('Simulação não encontrada.');
      return JSON.parse(dados);
    }
    return (await repository.listarSimulacoes(sessao.tenantId)).map(dados => JSON.parse(dados));
  }

  return { listar, consultar, salvar, remover, simular, historico };
}
