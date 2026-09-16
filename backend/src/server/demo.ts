import type { Banco } from './database';
import { randomBytes, scryptSync } from 'node:crypto';
import type { Perfil } from '../types';

  // Provisionamento explícito para desenvolvimento; nunca executado pelo login.
export async function cadastrarDemonstracao(db: Banco) {
    const empresas = [
      { id: 'aurea', nome: 'Áurea Logística', valores: ['1.284', '96,2%', 'R$ 18,40'], eficiencia: [42, 65, 54, 78, 68, 88, 100], rotas: ['Centro expandido', 'Zona sul', 'Guarulhos'] },
      { id: 'vertex', nome: 'Vertex Transportes', valores: ['746', '91,5%', 'R$ 22,70'], eficiencia: [35, 48, 62, 57, 81, 73, 90], rotas: ['Campinas', 'Sorocaba', 'Jundiaí'] },
    ];
    const perfis: Array<[string, Perfil]> = [['admin', 'Administrador'], ['gestor', 'Gestor'], ['operador', 'Operador']];
    await db.transaction(async () => {
      for (const [index, empresa] of empresas.entries()) {
        await db.prepare('INSERT IGNORE INTO empresas VALUES (?, ?)').run(empresa.id, empresa.nome);
        for (const [loginName, perfil] of perfis) {
          const salt = randomBytes(16).toString('hex');
          const hash = scryptSync('NexoDemo@2026', salt, 64).toString('hex');
          await db.prepare('INSERT IGNORE INTO usuarios (id, tenant_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, ?, ?)').run(
            `${empresa.id}-${loginName}`, empresa.id, `${perfil} ${empresa.nome}`, `${loginName}@${empresa.id}.com`, `${salt}:${hash}`, perfil);
        }
        await db.prepare('INSERT IGNORE INTO clientes VALUES (?, ?, ?, ?, ?, ?)').run(
          `${empresa.id}-cliente`, empresa.id, `Cliente ${empresa.nome}`, `cliente@${empresa.id}.com`, '11999990000', '');
        await db.prepare('INSERT IGNORE INTO transportadoras VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          `${empresa.id}-transportadora`, empresa.id, `Transportadora ${empresa.nome}`, `transporte@${empresa.id}.com`, '1133330000', 20 + index * 10, 2 + index, 0.5 + index * 0.1);
        const resumo = ['Pedidos em andamento', 'Entregas no prazo', 'Custo médio por pedido'].map((titulo, i) => ({
          titulo, valor: empresa.valores[i], variacao: (index ? ['+7,2%', '+2,1%', '-3,4%'] : ['+12,8%', '+4,6%', '-8,2%'])[i],
        }));
        await db.prepare('INSERT IGNORE INTO paineis VALUES (?, ?, ?)').run(empresa.id, JSON.stringify(resumo), JSON.stringify(empresa.eficiencia));
        for (const [i, nome] of empresa.rotas.entries()) await db.prepare('INSERT IGNORE INTO rotas VALUES (?, ?, ?, ?, ?, ?)').run(
          `rota-${i + 1}`, empresa.id, `Rota ${i + 1} · ${nome}`, 18 + index * 10 + i * 4, ['14:40', '16:20', '15:10'][i], i === 1 ? 'Aguardando' : 'Em rota');
      }
    });
  }
