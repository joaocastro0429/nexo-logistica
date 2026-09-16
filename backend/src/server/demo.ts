import { randomBytes, scryptSync } from 'node:crypto';
import type { Banco } from './database';
import { clientes, empresas, paineis, rotas, transportadoras, usuarios } from '../infrastructure/database/schema';
import type { Perfil } from '../types';

async function ignorarDuplicata(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error;
  }
}

export async function cadastrarDemonstracao(db: Banco) {
  const empresasDemo = [
    { id: 'aurea', nome: 'Áurea Logística', valores: ['1.284', '96,2%', 'R$ 18,40'], eficiencia: [42, 65, 54, 78, 68, 88, 100], rotas: ['Centro expandido', 'Zona sul', 'Guarulhos'] },
    { id: 'vertex', nome: 'Vertex Transportes', valores: ['746', '91,5%', 'R$ 22,70'], eficiencia: [35, 48, 62, 57, 81, 73, 90], rotas: ['Campinas', 'Sorocaba', 'Jundiaí'] },
  ];
  const perfis: Array<[string, Perfil]> = [['admin', 'Administrador'], ['gestor', 'Gestor'], ['operador', 'Operador']];

  await db.transaction(async database => {
    for (const [index, empresa] of empresasDemo.entries()) {
      await ignorarDuplicata(database.insert(empresas).values({ id: empresa.id, nome: empresa.nome }));
      for (const [loginName, perfil] of perfis) {
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync('NexoDemo@2026', salt, 64).toString('hex');
        await ignorarDuplicata(database.insert(usuarios).values({
          id: `${empresa.id}-${loginName}`, tenantId: empresa.id, nome: `${perfil} ${empresa.nome}`,
          email: `${loginName}@${empresa.id}.com`, senhaHash: `${salt}:${hash}`, perfil,
        }));
      }
      await ignorarDuplicata(database.insert(clientes).values({
        id: `${empresa.id}-cliente`, tenantId: empresa.id, nome: `Cliente ${empresa.nome}`,
        email: `cliente@${empresa.id}.com`, telefone: '11999990000', documento: '',
      }));
      await ignorarDuplicata(database.insert(transportadoras).values({
        id: `${empresa.id}-transportadora`, tenantId: empresa.id, nome: `Transportadora ${empresa.nome}`,
        email: `transporte@${empresa.id}.com`, telefone: '1133330000', taxaBase: 20 + index * 10,
        valorKg: 2 + index, valorKm: 0.5 + index * 0.1,
      }));
      const resumo = ['Pedidos em andamento', 'Entregas no prazo', 'Custo médio por pedido'].map((titulo, itemIndex) => ({
        titulo, valor: empresa.valores[itemIndex], variacao: (index ? ['+7,2%', '+2,1%', '-3,4%'] : ['+12,8%', '+4,6%', '-8,2%'])[itemIndex],
      }));
      await ignorarDuplicata(database.insert(paineis).values({ tenantId: empresa.id, resumo: JSON.stringify(resumo), eficiencia: JSON.stringify(empresa.eficiencia) }));
      for (const [routeIndex, nome] of empresa.rotas.entries()) {
        await ignorarDuplicata(database.insert(rotas).values({
          id: `rota-${routeIndex + 1}`, tenantId: empresa.id, nome: `Rota ${routeIndex + 1} - ${nome}`,
          pedidos: 18 + index * 10 + routeIndex * 4, previsao: ['14:40', '16:20', '15:10'][routeIndex], status: routeIndex === 1 ? 'Aguardando' : 'Em rota',
        }));
      }
    }
  });
}
