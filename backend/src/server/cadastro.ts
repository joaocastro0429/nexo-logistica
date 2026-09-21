import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Banco } from './database';
import { empresas, usuarios } from '../infrastructure/database/schema';
import type { AuditoriaRepository } from '../domain/repositories';

export function criarCadastro(db: Banco, auditoria?: AuditoriaRepository) {
  return async function cadastrar(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Dados inválidos.');
    const dados = body as Record<string, unknown>;
    function texto(campo: string, max: number) {
      const valor = dados[campo];
      if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > max) throw new BadRequestException(`Campo ${campo} inválido.`);
      return valor.trim();
    }
    const nome = texto('nome', 150);
    const empresa = texto('empresa', 150);
    const email = texto('email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail inválido.');
    const senha = dados.senha;
    if (typeof senha !== 'string' || senha.length < 8 || senha.length > 256) throw new BadRequestException('A senha deve ter entre 8 e 256 caracteres.');
    const salt = randomBytes(16).toString('hex');
    const senhaHash = `${salt}:${scryptSync(senha, salt, 64).toString('hex')}`;
    let tenantId = '';
    let usuarioId = '';
    try {
      await db.transaction(async database => {
        tenantId = randomUUID();
        usuarioId = randomUUID();
        await database.insert(empresas).values({ id: tenantId, nome: empresa });
        await database.insert(usuarios).values({ id: usuarioId, tenantId, nome, email, senhaHash, perfil: 'Administrador' });
      });
    } catch (error) {
      const erro = error as { code?: string; cause?: { code?: string } };
      if (erro.code === 'ER_DUP_ENTRY' || erro.cause?.code === 'ER_DUP_ENTRY') throw new ConflictException('Este e-mail já está cadastrado. Entre com sua conta ou utilize outro e-mail.');
      throw error;
    }
    if (auditoria) await auditoria.registrar({ tenantId, usuarioId, acao: 'USUARIO_CRIADO', recurso: 'usuarios', recursoId: usuarioId, detalhes: { origem: 'cadastro_empresa', perfil: 'Administrador' } });
    return { ok: true };
  };
}
