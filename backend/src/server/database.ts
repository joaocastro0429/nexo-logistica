import { createPool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Valor = string | number | null;
export async function abrirBanco(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('Defina DATABASE_URL para conectar ao MySQL.');
  const pool = createPool({ uri: url, connectionLimit: 10, decimalNumbers: true, charset: 'utf8mb4' });
  // Cada transação usa sua própria conexão, inclusive com requisições simultâneas.
  const contexto = new AsyncLocalStorage<PoolConnection>();
  function prepare(sql: string) {
    const executar = async (values: Valor[]) => (await (contexto.getStore() || pool).execute(sql, values))[0];
    return {
      get: async (...values: Valor[]) => (await executar(values) as RowDataPacket[])[0],
      all: async (...values: Valor[]) => await executar(values) as RowDataPacket[],
      run: async (...values: Valor[]) => { await executar(values); },
    };
  }
  async function transaction<T>(work: () => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await contexto.run(connection, work);
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  try {
    const schema = await readFile(resolve(__dirname, '../../../migrations/001_initial.sql'), 'utf8');
    for (const sql of schema.split(';').filter(sql => sql.trim())) await pool.query(sql);
  } catch (error) { await pool.end(); throw error; }
  return { prepare, transaction, close: () => pool.end() };
}
export type Banco = Awaited<ReturnType<typeof abrirBanco>>;
