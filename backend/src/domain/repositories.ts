import type { Perfil, Sessao } from '../types';

export type UsuarioPersistido = {
  id: string;
  nome: string;
  perfil: Perfil;
  tenantId: string;
  empresa?: string;
  senhaHash?: string;
  sessionVersion: number;
  mfaSecret?: string | null;
  mfaLastStep?: number;
  recoveryHashes?: string | null;
};

export type Registro = Record<string, unknown>;
export type Recurso = 'usuarios' | 'clientes' | 'transportadoras';

export interface AutenticacaoRepository {
  buscarUsuario(id: string): Promise<UsuarioPersistido | null>;
  salvarMfa(id: string, version: number, secret: string | null, hashes: string | null, step: number): Promise<boolean>;
  consumirTotp(id: string, secret: string, step: number): Promise<boolean>;
  consumirRecovery(id: string, previous: string, next: string): Promise<boolean>;
  buscarOAuth(provider: 'google' | 'github', subject: string): Promise<UsuarioPersistido | null>;
  vincularOAuth(id: string, provider: 'google' | 'github', subject: string): Promise<void>;
  listarOAuth(id: string): Promise<string[]>;
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
