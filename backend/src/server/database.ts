import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Um único banco atende todas as empresas.
export function abrirBanco(path = process.env.NEXO_DB_PATH || resolve('data/nexo.sqlite')) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS empresas (id TEXT PRIMARY KEY, nome TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES empresas(id),
      nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK(perfil IN ('Administrador', 'Gestor', 'Operador'))
    );
    CREATE INDEX IF NOT EXISTS usuarios_tenant ON usuarios(tenant_id);
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id), expira INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paineis (
      tenant_id TEXT PRIMARY KEY REFERENCES empresas(id), resumo TEXT NOT NULL, eficiencia TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rotas (
      id TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES empresas(id), nome TEXT NOT NULL,
      pedidos INTEGER NOT NULL, previsao TEXT NOT NULL, status TEXT NOT NULL,
      PRIMARY KEY(tenant_id, id)
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES empresas(id),
      nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT NOT NULL, documento TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS clientes_tenant ON clientes(tenant_id);
    CREATE TABLE IF NOT EXISTS transportadoras (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES empresas(id),
      nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT NOT NULL,
      taxa_base REAL NOT NULL, valor_kg REAL NOT NULL, valor_km REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transportadoras_tenant ON transportadoras(tenant_id);
    CREATE TABLE IF NOT EXISTS simulacoes (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES empresas(id),
      criada_em TEXT NOT NULL, dados TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS simulacoes_tenant ON simulacoes(tenant_id, criada_em);
  `);
  return db;
}
