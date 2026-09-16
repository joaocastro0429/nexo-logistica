export type Perfil = 'Administrador' | 'Gestor' | 'Operador';
export type Sessao = { usuarioId: string; nome: string; perfil: Perfil; tenantId: string; empresa: string };
export type Painel = {
  sessao: Sessao;
  resumo: Array<{ titulo: string; valor: string; variacao: string }>;
  rotas: Array<{ id: string; nome: string; pedidos: number; previsao: string; status: string }>;
  eficiencia: number[];
};
