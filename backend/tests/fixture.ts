import { testKeys } from './auth-fixture';
import { createConnection } from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { abrirBanco } from '../src/server/database';
import { abrirRedis } from '../src/server/redis';

export async function fixture() {
  testKeys();
  const adminUrl = process.env.MYSQL_TEST_URL;
  if (!adminUrl) throw new Error('Defina MYSQL_TEST_URL para executar testes em bancos temporários.');
  const admin = await createConnection(adminUrl);
  const name = `nexo_test_${randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  process.env.AUTH_NAMESPACE = name;
  const db = await abrirBanco(url.toString());
  const redis = await abrirRedis();
  return { db, redis, url: url.toString(), close: async () => {
    await db.close();
    for await (const keys of redis.scanIterator({ MATCH: `${name}:*`, COUNT: 100 })) {
      if (keys.length) await redis.del(keys);
    }
    await redis.quit();
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  } };
}
