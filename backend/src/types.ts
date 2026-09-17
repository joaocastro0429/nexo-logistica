export type Perfil = 'Administrador' | 'Gestor' | 'Operador';
export type Sessao = { usuarioId: string; nome: string; perfil: Perfil; tenantId: string; empresa: string };
export type Painel = {
  sessao: Sessao;
  resumo: Array<{ titulo: string; valor: string; variacao: string }>;
  rotas: Array<{ id: string; nome: string; quantidade: number; media: number }>;
  evolucao: Array<{ data: string; quantidade: number }>;
  insights: Array<{ titulo: string; descricao: string }>;
};
