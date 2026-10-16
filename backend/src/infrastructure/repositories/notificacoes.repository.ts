import { createHash } from 'node:crypto';
import type { Redis } from '../../server/redis';
import { RETENCAO_NOTIFICACOES_SEGUNDOS, type EventoNotificacao, type NotificacoesRepository } from '../../domain/notificacoes';

// Cada empresa tem seu Stream; a hash tag permite operações atômicas em Cluster.
export function criarNotificacoesRedis(redis: Pick<Redis, 'eval' | 'get' | 'xRevRange'>, namespace: string): NotificacoesRepository {
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const stream = (tenant: string) => `${namespace}:notificacoes:{${hash(tenant)}}:eventos`;
  const leitura = (tenant: string, usuario: string) => `${namespace}:notificacoes:{${hash(tenant)}}:lidas:${hash(usuario)}`;
  return {
    async publicar(tenantId, tipo) {
      await redis.eval(`
        redis.call('XTRIM', KEYS[1], 'MINID', ARGV[4])
        redis.call('XADD', KEYS[1], 'MAXLEN', '100', '*', 'tipo', ARGV[1], 'criadaEm', ARGV[2])
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        return 1
      `, { keys: [stream(tenantId)], arguments: [tipo, new Date().toISOString(), String(RETENCAO_NOTIFICACOES_SEGUNDOS), `${Math.max(0, Date.now() - RETENCAO_NOTIFICACOES_SEGUNDOS * 1000)}-0`] });
    },
    async listar(tenantId) {
      const eventos = await redis.xRevRange(stream(tenantId), '+', '-', { COUNT: 100 });
      return eventos.filter(e => Number(e.id.split('-')[0]) >= Date.now() - RETENCAO_NOTIFICACOES_SEGUNDOS * 1000).map(e => ({ id: e.id, tipo: e.message.tipo as EventoNotificacao['tipo'], criadaEm: e.message.criadaEm }));
    },
    async ultimaLida(tenantId, usuarioId) { return await redis.get(leitura(tenantId, usuarioId)) || '0-0'; },
    async marcarLidas(tenantId, usuarioId, ate) {
      const result = await redis.eval(`
        if #redis.call('XRANGE', KEYS[1], ARGV[1], ARGV[1], 'COUNT', '1') == 0 then return 0 end
        local atual = redis.call('GET', KEYS[2]) or '0-0'
        local a, b = string.match(ARGV[1], '^(%d+)%-(%d+)$')
        local c, d = string.match(atual, '^(%d+)%-(%d+)$')
        local function maior(x, y) return #x > #y or (#x == #y and x > y) end
        if maior(a, c) or (a == c and (b == d or maior(b, d))) then
          redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
        end
        return 1
      `, { keys: [stream(tenantId), leitura(tenantId, usuarioId)], arguments: [ate, String(RETENCAO_NOTIFICACOES_SEGUNDOS)] });
      return Number(result) === 1;
    },
  };
}
