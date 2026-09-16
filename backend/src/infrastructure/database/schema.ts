import { index, int, mysqlEnum, mysqlTable, primaryKey, text, uniqueIndex, varchar, decimal } from 'drizzle-orm/mysql-core';

export const empresas = mysqlTable('empresas', {
  id: varchar('id', { length: 64 }).primaryKey(),
  nome: varchar('nome', { length: 150 }).notNull(),
});

export const usuarios = mysqlTable('usuarios', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 150 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  senhaHash: varchar('senha_hash', { length: 256 }).notNull(),
  perfil: mysqlEnum('perfil', ['Administrador', 'Gestor', 'Operador']).notNull(),
  sessionVersion: int('session_version').notNull().default(0),
}, table => ({
  emailUnique: uniqueIndex('usuarios_email_unique').on(table.email),
  tenantIndex: index('usuarios_tenant_idx').on(table.tenantId),
}));

export const paineis = mysqlTable('paineis', {
  tenantId: varchar('tenant_id', { length: 64 }).primaryKey().references(() => empresas.id),
  resumo: text('resumo').notNull(),
  eficiencia: text('eficiencia').notNull(),
});

export const rotas = mysqlTable('rotas', {
  id: varchar('id', { length: 64 }).notNull(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 150 }).notNull(),
  pedidos: int('pedidos').notNull(),
  previsao: varchar('previsao', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull(),
}, table => ({
  pk: primaryKey({ columns: [table.tenantId, table.id] }),
}));

export const clientes = mysqlTable('clientes', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 150 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  telefone: varchar('telefone', { length: 30 }).notNull(),
  documento: varchar('documento', { length: 30 }).notNull(),
}, table => ({ tenantIndex: index('clientes_tenant_idx').on(table.tenantId) }));

export const transportadoras = mysqlTable('transportadoras', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 150 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  telefone: varchar('telefone', { length: 30 }).notNull(),
  taxaBase: decimal('taxa_base', { precision: 16, scale: 4, mode: 'number' }).notNull(),
  valorKg: decimal('valor_kg', { precision: 16, scale: 4, mode: 'number' }).notNull(),
  valorKm: decimal('valor_km', { precision: 16, scale: 4, mode: 'number' }).notNull(),
}, table => ({ tenantIndex: index('transportadoras_tenant_idx').on(table.tenantId) }));

export const simulacoes = mysqlTable('simulacoes', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => empresas.id),
  criadaEm: varchar('criada_em', { length: 30 }).notNull(),
  dados: text('dados').notNull(),
}, table => ({ tenantIndex: index('simulacoes_tenant_criada_idx').on(table.tenantId, table.criadaEm) }));

export const schema = { empresas, usuarios, paineis, rotas, clientes, transportadoras, simulacoes };
