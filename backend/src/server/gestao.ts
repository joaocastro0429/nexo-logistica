import type { Banco } from './database';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Sessao } from '../types';

type Recurso = 'usuarios' | 'clientes' | 'transportadoras';
type Dados = Record<string, unknown>;
const campos = {
  usuarios: 'id, nome, email, perfil',
  clientes: 'id, nome, email, telefone, documento',
  transportadoras: 'id, nome, email, telefone, taxa_base, valor_kg, valor_km',
};
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

export function criarGestao(db: Banco) {
  // Só nomes desta lista entram no SQL; os valores sempre são parametrizados.
  function recurso(tipo: string): Recurso {
    if (!Object.hasOwn(campos, tipo)) throw new NotFoundException('Cadastro inexistente.');
    return tipo as Recurso;
  }
  function permitir(sessao: Sessao, tipo: Recurso, escrita = false) {
    if (tipo === 'usuarios' && sessao.perfil !== 'Administrador') throw new ForbiddenException('Somente administradores gerenciam usuários.');
    if (escrita && sessao.perfil === 'Operador') throw new ForbiddenException('Seu perfil permite apenas consultar este cadastro.');
  }
  async function consultar(sessao: Sessao, tipo: string, id: string) {
    const tabela = recurso(tipo);
    permitir(sessao, tabela);
    const row = await db.prepare(`SELECT ${campos[tabela]} FROM ${tabela} WHERE id = ? AND tenant_id = ?`).get(id, sessao.tenantId);
    if (!row) throw new NotFoundException('Registro não encontrado.');
    return { ...row };
  }
  async function listar(sessao: Sessao, tipo: string, busca = '') {
    const tabela = recurso(tipo);
    permitir(sessao, tabela);
    return await db.prepare(`SELECT ${campos[tabela]} FROM ${tabela} WHERE tenant_id = ? AND (nome LIKE ? OR email LIKE ?) ORDER BY nome`).all(sessao.tenantId, `%${busca.slice(0, 150)}%`, `%${busca.slice(0, 150)}%`);
  }
  function validar(tipo: Recurso, body: unknown, edicao: boolean) {
    const dados = objeto(body);
    const nome = texto(dados, 'nome');
    const email = texto(dados, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail inválido.');
    if (tipo === 'usuarios') {
      const perfil = texto(dados, 'perfil');
      if (!['Administrador', 'Gestor', 'Operador'].includes(perfil)) throw new BadRequestException('Perfil inválido.');
      const senha = dados.senha;
      if ((!edicao || (senha !== undefined && senha !== '')) && (typeof senha !== 'string' || senha.length < 8 || senha.length > 256)) throw new BadRequestException('A senha deve ter entre 8 e 256 caracteres.');
      const result: Record<string, string | number> = { nome, email, perfil };
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
  async function salvar(sessao: Sessao, tipo: string, body: unknown, id?: string) {
    const tabela = recurso(tipo);
    permitir(sessao, tabela, true);
    const values = validar(tabela, body, Boolean(id));
    return db.transaction(async () => {
      // Serializa alterações da mesma empresa para preservar o último administrador.
      await db.prepare('SELECT id FROM empresas WHERE id = ? FOR UPDATE').get(sessao.tenantId);
      const atual = id ? await consultar(sessao, tabela, id) : null;
      if (tabela === 'usuarios') {
        if (atual?.perfil === 'Administrador' && values.perfil !== 'Administrador') await protegerAdministrador(sessao);
        if (await db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(values.email!, id || '')) throw new ConflictException('E-mail indisponível.');
      }
      const registroId = id || randomUUID();
      const chaves = Object.keys(values);
      if (id) await db.prepare(`UPDATE ${tabela} SET ${chaves.map(c => `${c} = ?`).join(', ')} WHERE id = ? AND tenant_id = ?`).run(...Object.values(values), id, sessao.tenantId);
      else await db.prepare(`INSERT INTO ${tabela} (id, tenant_id, ${chaves.join(', ')}) VALUES (?, ?, ${chaves.map(() => '?').join(', ')})`).run(registroId, sessao.tenantId, ...Object.values(values));
      // Qualquer edição de usuário revoga sessões antigas, inclusive após mudar perfil/senha.
      if (tabela === 'usuarios' && id) await db.prepare('UPDATE usuarios SET session_version = session_version + 1 WHERE id = ? AND tenant_id = ?').run(id, sessao.tenantId);
      const result = await consultar(sessao, tabela, registroId);
      return result;
    }).catch(error => {
      if (error.code === 'ER_DUP_ENTRY') throw new ConflictException('E-mail indisponível.');
      throw error;
    });
  }
  async function protegerAdministrador(sessao: Sessao) {
    const total = await db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE tenant_id = ? AND perfil = 'Administrador'").get(sessao.tenantId)!;
    if (Number(total.total) <= 1) throw new ConflictException('A empresa precisa manter pelo menos um administrador.');
  }
  async function remover(sessao: Sessao, tipo: string, id: string) {
    const tabela = recurso(tipo);
    permitir(sessao, tabela, true);
    return db.transaction(async () => {
      // Serializa alterações da mesma empresa para preservar o último administrador.
      await db.prepare('SELECT id FROM empresas WHERE id = ? FOR UPDATE').get(sessao.tenantId);
      const atual = await consultar(sessao, tabela, id);
      if (tabela === 'usuarios') {
        if (atual.perfil === 'Administrador') await protegerAdministrador(sessao);
      }
      await db.prepare(`DELETE FROM ${tabela} WHERE id = ? AND tenant_id = ?`).run(id, sessao.tenantId);
      return { ok: true };
    });
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
    const result = {
      id: randomUUID(), criada_em: new Date().toISOString(), usuario: sessao.nome,
      origem, destino, peso, comprimento, largura, altura, distancia, valorCarga,
      cliente, transportadora, formula: 'v1', ...calcularFrete(peso, comprimento, largura, altura, distancia, valorCarga, tarifas),
    };
    // Snapshot: mudanças ou exclusões de cadastros não alteram uma simulação passada.
    await db.prepare('INSERT INTO simulacoes VALUES (?, ?, ?, ?)').run(result.id, sessao.tenantId, result.criada_em, JSON.stringify(result));
    return result;
  }
  async function historico(sessao: Sessao, id?: string) {
    if (id) {
      const row = await db.prepare('SELECT dados FROM simulacoes WHERE id = ? AND tenant_id = ?').get(id, sessao.tenantId);
      if (!row) throw new NotFoundException('Simulação não encontrada.');
      return JSON.parse(String(row.dados));
    }
    return (await db.prepare('SELECT dados FROM simulacoes WHERE tenant_id = ? ORDER BY criada_em DESC, id').all(sessao.tenantId)).map(row => JSON.parse(String(row.dados)));
  }
  return { listar, consultar, salvar, remover, simular, historico };
}
