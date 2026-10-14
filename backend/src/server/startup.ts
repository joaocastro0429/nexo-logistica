export type StartupStage = 'configuracao' | 'mysql' | 'redis';

export class StartupError extends Error {
  constructor(readonly stage: StartupStage, cause: unknown) {
    super('Falha ao inicializar dependência.', { cause });
  }
}

// Somente códigos conhecidos são registrados. Mensagens de drivers podem
// conter credenciais, URLs, SQL ou valores enviados pelo usuário.
const safeCodes = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'EADDRINUSE',
]);

export function startupDiagnostic(error: unknown) {
  let current = error;
  let code = 'UNKNOWN';
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === 'string' && safeCodes.has(value.code)) {
      code = value.code;
      break;
    }
    current = value.cause;
  }
  const required = ['JWT_SECRET', 'MFA_ENCRYPTION_KEY', 'DATABASE_URL', 'REDIS_URL'];
  return {
    event: 'startup_failed',
    stage: error instanceof StartupError ? error.stage : 'aplicacao',
    code,
    missingVariables: required.filter(name => !process.env[name]?.trim()),
  };
}
