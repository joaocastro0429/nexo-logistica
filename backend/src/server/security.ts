import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpException } from '@nestjs/common';
import type { Redis } from './redis';

export const redisKey = (suffix: string) => `${process.env.AUTH_NAMESPACE || 'nexo'}:${suffix}`;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export function securityConfig() {
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) throw new Error('FRONTEND_ORIGIN deve ser uma origem HTTP(S) exata, sem barra final.');
  const jwt = process.env.JWT_SECRET || '';
  const encryption = process.env.MFA_ENCRYPTION_KEY || '';
  if (Buffer.byteLength(jwt) < 32 || !/^[a-f0-9]{64}$/i.test(encryption)) {
    throw new Error('Configure JWT_SECRET (mínimo 32 bytes) e MFA_ENCRYPTION_KEY (32 bytes em hexadecimal).');
  }
  return { jwt, encryption: Buffer.from(encryption, 'hex') };
}
export function encrypt(secret: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}
export function decrypt(value: string, key: Buffer) {
  const [iv, tag, data] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
const derive = promisify(scrypt);
export async function verifyPassword(password: string, encoded?: string) {
  if (typeof password !== 'string' || !password || password.length > 256) return false;
  const validHash = encoded && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded);
  const [salt, expected] = validHash ? encoded.split(':') : ['0'.repeat(32), '0'.repeat(128)];
  const actual = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && Boolean(validHash);
}
export function createLimiter(redis: Redis) {
  return async (scope: string, identifier: string, limit = 10, seconds = 900) => {
    const count = Number(await redis.eval(`local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n`, {
      keys: [redisKey(`limit:${scope}:${digest(identifier)}`)], arguments: [String(seconds)],
    }));
    if (count > limit) throw new HttpException('Muitas tentativas. Aguarde e tente novamente.', 429);
  };
}
