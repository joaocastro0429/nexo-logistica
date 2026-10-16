export type TipoNotificacao = 'frete_criado' | 'frete_excluido' | 'importacao_concluida' | 'importacao_falhou';
export type EventoNotificacao = { id: string; tipo: TipoNotificacao; criadaEm: string };
export interface NotificacoesRepository {
  publicar(tenantId: string, tipo: TipoNotificacao): Promise<void>;
  listar(tenantId: string): Promise<EventoNotificacao[]>;
  ultimaLida(tenantId: string, usuarioId: string): Promise<string>;
  marcarLidas(tenantId: string, usuarioId: string, ate: string): Promise<boolean>;
}
export const RETENCAO_NOTIFICACOES_SEGUNDOS = 7 * 24 * 60 * 60;
