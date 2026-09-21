import { and, desc, eq, lt, like, ne, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '../database';
import { auditoria, clientes, empresas, identidadesOAuth, simulacoes, transportadoras, usuarios } from '../database/schema';
import type { AuditoriaRepository, AutenticacaoRepository, EventoAuditoria, GestaoRepository, Registro, Recurso, UsuarioPersistido } from '../../domain/repositories';
import type { Sessao } from '../../types';

type DatabaseLike = DrizzleDatabase;
const tables = { usuarios, clientes, transportadoras } as const;

function tableFor(tipo: Recurso) {
  return tables[tipo];
}

function publicFields(tipo: Recurso) {
  if (tipo === 'usuarios') return { id: usuarios.id, nome: usuarios.nome, email: usuarios.email, perfil: usuarios.perfil };
  if (tipo === 'clientes') return { id: clientes.id, nome: clientes.nome, email: clientes.email, telefone: clientes.telefone, documento: clientes.documento };
  return { id: transportadoras.id, nome: transportadoras.nome, email: transportadoras.email, telefone: transportadoras.telefone, taxa_base: transportadoras.taxaBase, valor_kg: transportadoras.valorKg, valor_km: transportadoras.valorKm };
}

export class MySqlAutenticacaoRepository implements AutenticacaoRepository {
  constructor(private readonly database: DatabaseLike) {}

  async buscarPorEmail(email: string): Promise<UsuarioPersistido | null> {
    const [row] = await this.database.select({
      id: usuarios.id, nome: usuarios.nome, perfil: usuarios.perfil, tenantId: usuarios.tenantId,
      senhaHash: usuarios.senhaHash, sessionVersion: usuarios.sessionVersion,
      mfaSecret: usuarios.mfaSecret, mfaLastStep: usuarios.mfaLastStep, recoveryHashes: usuarios.recoveryHashes,
    }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
    return row ? { ...row, perfil: row.perfil as UsuarioPersistido['perfil'] } : null;
  }

  async buscarUsuario(id: string): Promise<UsuarioPersistido | null> {
    const [row] = await this.database.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
    return row || null;
  }
  async salvarMfa(id: string, version: number, secret: string | null, hashes: string | null, step: number) {
    const [result] = await this.database.update(usuarios).set({ mfaSecret: secret, recoveryHashes: hashes, mfaLastStep: step, sessionVersion: sql`${usuarios.sessionVersion} + 1` })
      .where(and(eq(usuarios.id, id), eq(usuarios.sessionVersion, version)));
    return result.affectedRows === 1;
  }
  async consumirTotp(id: string, secret: string, step: number) {
    const [result] = await this.database.update(usuarios).set({ mfaLastStep: step })
      .where(and(eq(usuarios.id, id), eq(usuarios.mfaSecret, secret), lt(usuarios.mfaLastStep, step)));
    return result.affectedRows === 1;
  }
  async consumirRecovery(id: string, previous: string, next: string) {
    const [result] = await this.database.update(usuarios).set({ recoveryHashes: next })
      .where(and(eq(usuarios.id, id), eq(usuarios.recoveryHashes, previous)));
    return result.affectedRows === 1;
  }
  async buscarOAuth(provider: 'google' | 'github', subject: string) {
    const [row] = await this.database.select({ usuarioId: identidadesOAuth.usuarioId }).from(identidadesOAuth)
      .where(and(eq(identidadesOAuth.provider, provider), eq(identidadesOAuth.subject, subject))).limit(1);
    return row ? this.buscarUsuario(row.usuarioId) : null;
  }
  async vincularOAuth(id: string, provider: 'google' | 'github', subject: string) {
    await this.database.insert(identidadesOAuth).values({ usuarioId: id, provider, subject });
  }
  async listarOAuth(id: string) {
    const rows = await this.database.select({ provider: identidadesOAuth.provider }).from(identidadesOAuth).where(eq(identidadesOAuth.usuarioId, id));
    return rows.map(row => row.provider);
  }

  async buscarSessao(usuarioId: string, sessionVersion: number): Promise<Sessao | null> {
    const [row] = await this.database.select({
      usuarioId: usuarios.id, nome: usuarios.nome, perfil: usuarios.perfil,
      tenantId: usuarios.tenantId, empresa: empresas.nome,
    }).from(usuarios).innerJoin(empresas, eq(empresas.id, usuarios.tenantId))
      .where(and(eq(usuarios.id, usuarioId), eq(usuarios.sessionVersion, sessionVersion))).limit(1);
    return row ? { ...row, perfil: row.perfil as Sessao['perfil'] } : null;
  }

  async incrementarVersaoSessao(tenantId: string, usuarioId: string) {
    await this.database.update(usuarios).set({ sessionVersion: sql`${usuarios.sessionVersion} + 1` })
      .where(and(eq(usuarios.id, usuarioId), eq(usuarios.tenantId, tenantId)));
  }
}

export class MySqlAuditoriaRepository implements AuditoriaRepository {
  constructor(private readonly database: DatabaseLike) {}

  async registrar(evento: EventoAuditoria) {
    await this.database.insert(auditoria).values({
      id: randomUUID(), tenantId: evento.tenantId || null, usuarioId: evento.usuarioId || null,
      acao: evento.acao, recurso: evento.recurso || null, recursoId: evento.recursoId || null,
      ip: evento.ip || null, detalhes: evento.detalhes ? JSON.stringify(evento.detalhes) : null,
      criadaEm: new Date().toISOString(),
    });
  }
}

export class MySqlGestaoRepository implements GestaoRepository {
  constructor(private readonly database: DatabaseLike) {}

  async buscar(tenantId: string, tipo: Recurso, id: string): Promise<Registro | null> {
    const table = tableFor(tipo) as any;
    const [row] = await this.database.select(publicFields(tipo) as any).from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId))).limit(1);
    return row ? row as Registro : null;
  }

  async listar(tenantId: string, tipo: Recurso, busca: string): Promise<Registro[]> {
    const table = tableFor(tipo) as any;
    const fields = publicFields(tipo) as any;
    const rows = await this.database.select(fields).from(table)
      .where(and(eq(table.tenantId, tenantId), or(like(table.nome, `%${busca.slice(0, 150)}%`), like(table.email, `%${busca.slice(0, 150)}%`))))
      .orderBy(table.nome);
    return rows as Registro[];
  }

  async contarAdministradores(tenantId: string) {
    const [row] = await this.database.select({ total: sql<number>`count(*)` }).from(usuarios)
      .where(and(eq(usuarios.tenantId, tenantId), eq(usuarios.perfil, 'Administrador')));
    return Number(row?.total || 0);
  }

  async emailEmUso(email: string, id?: string) {
    const conditions = id ? and(eq(usuarios.email, email), ne(usuarios.id, id)) : eq(usuarios.email, email);
    const [row] = await this.database.select({ id: usuarios.id }).from(usuarios).where(conditions).limit(1);
    return Boolean(row);
  }

  async salvar(tenantId: string, tipo: Recurso, values: Registro, id?: string) {
    const table = tableFor(tipo) as any;
    const database = this.database as any;
    const data = { ...values, tenantId };
    if (id) {
      await database.update(table).set(data).where(and(eq(table.id, id), eq(table.tenantId, tenantId)));
      return (await this.buscar(tenantId, tipo, id))!;
    }
    const recordId = String(values.id || randomUUID());
    await database.insert(table).values({ ...data, id: recordId });
    return (await this.buscar(tenantId, tipo, recordId))!;
  }

  async remover(tenantId: string, tipo: Recurso, id: string) {
    const table = tableFor(tipo) as any;
    await (this.database as any).delete(table).where(and(eq(table.id, id), eq(table.tenantId, tenantId)));
  }

  async incrementarVersaoSessao(tenantId: string, usuarioId: string) {
    await this.database.update(usuarios).set({ sessionVersion: sql`${usuarios.sessionVersion} + 1` })
      .where(and(eq(usuarios.id, usuarioId), eq(usuarios.tenantId, tenantId)));
  }

  async salvarSimulacao(tenantId: string, id: string, criadaEm: string, dados: string) {
    await this.database.insert(simulacoes).values({ id, tenantId, criadaEm, dados });
  }

  async buscarSimulacao(tenantId: string, id: string) {
    const [row] = await this.database.select({ dados: simulacoes.dados }).from(simulacoes)
      .where(and(eq(simulacoes.id, id), eq(simulacoes.tenantId, tenantId))).limit(1);
    return row?.dados || null;
  }

  async listarSimulacoes(tenantId: string) {
    const rows = await this.database.select({ dados: simulacoes.dados }).from(simulacoes)
      .where(eq(simulacoes.tenantId, tenantId)).orderBy(desc(simulacoes.criadaEm), simulacoes.id);
    return rows.map(row => row.dados);
  }
}
