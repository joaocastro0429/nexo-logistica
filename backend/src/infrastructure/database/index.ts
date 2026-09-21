import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import type { Pool } from 'mysql2/promise';
import { resolve } from 'node:path';
import { schema } from './schema';
import { attachDatabasePool } from '@vercel/functions';

export type DrizzleDatabase = MySql2Database<typeof schema>;
export type Banco = {
  db: DrizzleDatabase;
  pool: Pool;
  transaction<T>(work: (database: DrizzleDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export async function abrirBanco(url = process.env.DATABASE_URL): Promise<Banco> {
  if (!url) throw new Error('Defina DATABASE_URL para conectar ao MySQL.');
  const serverless = process.env.VERCEL === '1';
  const pool = mysql.createPool({ uri: url, connectionLimit: serverless ? 2 : 10, maxIdle: serverless ? 2 : 10, idleTimeout: 5000, decimalNumbers: true, charset: 'utf8mb4' });
  if (serverless) attachDatabasePool(pool);
  const db = drizzle(pool, { schema, mode: 'default' });
  // Migrações em Functions são executadas separadamente antes do deploy,
  // evitando DDL concorrente a cada cold start.
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
