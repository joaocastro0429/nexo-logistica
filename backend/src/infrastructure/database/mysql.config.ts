import type { SslOptions } from 'mysql2';

// Compartilhada pelo pool da aplicação e pelas migrações Drizzle.
export function configuracaoMySql(url = process.env.DATABASE_URL, env: NodeJS.ProcessEnv = process.env) {
  if (!url) throw new Error('Defina DATABASE_URL para conectar ao MySQL.');
  let connection: URL;
  let credentials: { host: string; port: number; user: string; password: string; database: string };
  try {
    connection = new URL(url);
    credentials = {
      host: connection.hostname.replace(/^\[|\]$/g, ''),
      port: Number(connection.port || 3306),
      user: decodeURIComponent(connection.username),
      password: decodeURIComponent(connection.password),
      database: decodeURIComponent(connection.pathname.slice(1)),
    };
    if (connection.protocol !== 'mysql:' || !credentials.host || !credentials.user ||
        !credentials.database || credentials.database.includes('/') || connection.hash ||
        credentials.port < 1 || credentials.port > 65535) throw new Error();
  } catch {
    // A mensagem nunca inclui a URL, que contém a senha do banco.
    throw new Error('DATABASE_URL deve usar mysql://usuario:senha@host:porta/banco.');
  }

  for (const key of connection.searchParams.keys()) {
    if (key !== 'ssl-mode') throw new Error('Parâmetro não suportado em DATABASE_URL. Configure TLS com MYSQL_SSL e MYSQL_SSL_CA.');
  }
  const mode = connection.searchParams.get('ssl-mode')?.toUpperCase();
  if (mode !== undefined && !['REQUIRED', 'VERIFY_CA', 'VERIFY_IDENTITY', 'DISABLED'].includes(mode)) {
    throw new Error('ssl-mode inválido em DATABASE_URL.');
  }
  const flag = env.MYSQL_SSL?.trim().toLowerCase();
  if (flag && flag !== 'true' && flag !== 'false') throw new Error('MYSQL_SSL deve ser true ou false.');
  const ca = env.MYSQL_SSL_CA?.replace(/\\n/g, '\n').trim() || undefined;
  const required = env.VERCEL === '1' || Boolean(ca) || flag === 'true' || Boolean(mode && mode !== 'DISABLED');
  if (required && (flag === 'false' || mode === 'DISABLED')) {
    throw new Error('TLS é obrigatório na Vercel ou quando solicitado pela configuração do MySQL.');
  }
  const ssl: SslOptions | undefined = required
    ? { ca, rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' }
    : undefined;
  return { ...credentials, ssl };
}
