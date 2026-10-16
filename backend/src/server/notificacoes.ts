import { BadRequestException } from '@nestjs/common';
import type { NotificacoesRepository, TipoNotificacao } from '../domain/notificacoes';
import type { Sessao } from '../types';
const textos: Record<TipoNotificacao, { titulo: string; descricao: string }> = {
  frete_criado: { titulo: 'Nova simulação de frete', descricao: 'Uma simulação foi salva no histórico da sua empresa.' },
  frete_excluido: { titulo: 'Simulação excluída', descricao: 'Um frete foi removido do histórico. Os indicadores foram atualizados.' },
  importacao_concluida: { titulo: 'Importação concluída', descricao: 'O processamento do CSV terminou. Confira o resultado e os clientes importados.' },
  importacao_falhou: { titulo: 'Importação interrompida', descricao: 'Não foi possível concluir a importação. Confira o resultado antes de reenviar.' },
};
function posterior(a: string, b: string) {
  const [am, as] = a.split('-').map(BigInt), [bm, bs] = b.split('-').map(BigInt);
  return am > bm || (am === bm && as > bs);
}
export function criarNotificacoes(repository: NotificacoesRepository) {
  return {
    // A operação de negócio já foi confirmada no MySQL. Falha de aviso não a desfaz.
    async publicar(tenantId: string, tipo: TipoNotificacao) {
      try { await repository.publicar(tenantId, tipo); }
      catch { console.error('Não foi possível publicar uma notificação.'); }
    },
    async listar(sessao: Sessao) {
      const [eventos, ultimaLida] = await Promise.all([repository.listar(sessao.tenantId), repository.ultimaLida(sessao.tenantId, sessao.usuarioId)]);
      const itens = eventos.filter(e => Object.hasOwn(textos, e.tipo)).map(e => ({ ...e, ...textos[e.tipo], lida: !posterior(e.id, ultimaLida) }));
      return { itens, naoLidas: itens.filter(e => !e.lida).length, ultimaId: itens[0]?.id || null };
    },
    async marcarLidas(sessao: Sessao, body: unknown) {
      const ate = body && typeof body === 'object' && !Array.isArray(body) ? (body as { ate?: unknown }).ate : undefined;
      if (typeof ate !== 'string' || !/^(0|[1-9]\d{0,19})-(0|[1-9]\d{0,19})$/.test(ate)) throw new BadRequestException('Identificador de notificação inválido.');
      if (ate.split('-').some(parte => BigInt(parte) > 18446744073709551615n)) throw new BadRequestException('Identificador de notificação inválido.');
      if (!await repository.marcarLidas(sessao.tenantId, sessao.usuarioId, ate)) throw new BadRequestException('Notificação indisponível. Atualize a lista.');
      return { ok: true };
    },
  };
}
