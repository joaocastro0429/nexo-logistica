export type Progresso = {
  id: string;
  estado: 'aguardando' | 'processando' | 'concluida' | 'falhou';
  total: number;
  processadas: number;
  importadas: number;
  erros: { linha: number; mensagem: string }[];
};

export type TrabalhoImportacao = {
  tenantId: string;
  criado: number;
  limiteExecucao: number;
  progresso: Progresso;
};

export interface ImportacoesRepository {
  criar(trabalho: TrabalhoImportacao): Promise<boolean>;
  buscar(id: string): Promise<TrabalhoImportacao | undefined>;
  salvar(trabalho: TrabalhoImportacao): Promise<void>;
}

export const RETENCAO_IMPORTACAO_MS = 60 * 60 * 1000;
export const DURACAO_IMPORTACAO_MS = 5 * 60 * 1000;
