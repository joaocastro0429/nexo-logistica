import { createClient } from 'redis';
export async function abrirRedis(url = process.env.REDIS_URL) {
  if (!url) throw new Error('Defina REDIS_URL para armazenar as sessões.');
  const client = createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 5000, reconnectStrategy: retries => Math.min(retries * 200, 3000) } });
  client.on('error', () => console.error('Redis indisponível. Verifique o serviço de sessões.'));
  await client.connect();
  return client;
}
export type Redis = Awaited<ReturnType<typeof abrirRedis>>;
