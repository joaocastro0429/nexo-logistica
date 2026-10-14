import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import type { Pool } from 'mysql2/promise';
import { resolve } from 'node:path';
import { schema } from './schema';
import { configuracaoMySql } from './mysql.config';

export type DrizzleDatabase = MySql2Database<typeof schema>;
export type Banco = {
  db: DrizzleDatabase;
  pool: Pool;
  transaction<T>(work: (database: DrizzleDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export async function abrirBanco(url = process.env.DATABASE_URL): Promise<Banco> {
  const serverless = process.env.VERCEL === '1';
  const pool = mysql.createPool({ ...configuracaoMySql(url), connectionLimit: serverless ? 2 : 10, maxIdle: serverless ? 2 : 10, idleTimeout: 5000, decimalNumbers: true, charset: 'utf8mb4' });
  const db = drizzle(pool, { schema, mode: 'default' });
  // Na Vercel, aplicar migrações separadamente antes do deploy.
  if (!serverless) {
    try { await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') }); }
    catch (error) { await pool.end(); throw error; }
  }
  return {
    db,
    pool,
    transaction: work => db.transaction(async transaction => work(transaction as DrizzleDatabase)),
    close: () => pool.end(),
  };
}
