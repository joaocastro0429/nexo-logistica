import type { Perfil, Sessao } from '../types';

export type UsuarioPersistido = {
  id: string;
  nome: string;
  perfil: Perfil;
  tenantId: string;
  empresa?: string;
  senhaHash?: string;
  sessionVersion: number;
};

export type Registro = Record<string, unknown>;
export type Recurso = 'usuarios' | 'clientes' | 'transportadoras';

export interface AutenticacaoRepository {
  buscarPorEmail(email: string): Promise<UsuarioPersistido | null>;
  buscarSessao(usuarioId: string, sessionVersion: number): Promise<Sessao | null>;
}

export interface GestaoRepository {
  buscar(tenantId: string, tipo: Recurso, id: string): Promise<Registro | null>;
  listar(tenantId: string, tipo: Recurso, busca: string): Promise<Registro[]>;
  contarAdministradores(tenantId: string): Promise<number>;
  emailEmUso(email: string, id?: string): Promise<boolean>;
  incrementarVersaoSessao(tenantId: string, usuarioId: string): Promise<void>;
  salvar(tenantId: string, tipo: Recurso, values: Registro, id?: string): Promise<Registro>;
  remover(tenantId: string, tipo: Recurso, id: string): Promise<void>;
  salvarSimulacao(tenantId: string, id: string, criadaEm: string, dados: string): Promise<void>;
  buscarSimulacao(tenantId: string, id: string): Promise<string | null>;
  listarSimulacoes(tenantId: string): Promise<string[]>;
}
