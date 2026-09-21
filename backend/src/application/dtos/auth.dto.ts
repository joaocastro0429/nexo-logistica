import { BadRequestException } from '@nestjs/common';

export type LoginDto = { email: string; senha: string; perfil?: string };
export type PasswordDto = { senha: string };
export type CodeDto = { codigo: string };
export type OAuthLinkDto = { senha: string; codigo?: string };

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Dados inválidos.');
  return body as Record<string, unknown>;
}

function text(data: Record<string, unknown>, name: string, max: number, optional = false) {
  const value = data[name];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value || value.length > max) throw new BadRequestException('Dados inválidos.');
  return value;
}

export function parseLoginDto(body: unknown): LoginDto {
  const data = objectBody(body);
  return { email: text(data, 'email', 254)!, senha: text(data, 'senha', 256)!, perfil: text(data, 'perfil', 30, true) };
}

export function parsePasswordDto(body: unknown): PasswordDto {
  return { senha: text(objectBody(body), 'senha', 256)! };
}

export function parseCodeDto(body: unknown): CodeDto {
  return { codigo: text(objectBody(body), 'codigo', 32)! };
}

export function parseOAuthLinkDto(body: unknown): OAuthLinkDto {
  const data = objectBody(body);
  return { senha: text(data, 'senha', 256)!, codigo: text(data, 'codigo', 32, true) };
}