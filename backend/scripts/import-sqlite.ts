import { DatabaseSync } from 'node:sqlite';
import { abrirBanco } from '../src/server/database';

// Importação explícita: o SQLite original é aberto somente para leitura.
async function main() {
  if (!process.env.SQLITE_PATH) throw new Error('Defina SQLITE_PATH com o caminho do banco antigo.');
  const antigo = new DatabaseSync(process.env.SQLITE_PATH, { readOnly: true });
  const db = await abrirBanco();
  const tabelas: Record<string, string[]> = {
    empresas: ['id', 'nome'],
    usuarios: ['id', 'tenant_id', 'nome', 'email', 'senha_hash', 'perfil'],
    paineis: ['tenant_id', 'resumo', 'eficiencia'],
    rotas: ['id', 'tenant_id', 'nome', 'pedidos', 'previsao', 'status'],
    clientes: ['id', 'tenant_id', 'nome', 'email', 'telefone', 'documento'],
    transportadoras: ['id', 'tenant_id', 'nome', 'email', 'telefone', 'taxa_base', 'valor_kg', 'valor_km'],
    simulacoes: ['id', 'tenant_id', 'criada_em', 'dados'],
  };
  try {
    await db.transaction(async () => {
      for (const tabela of Object.keys(tabelas)) {
        const total = await db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get();
        if (Number(total.total) !== 0) throw new Error('A importação exige um MySQL vazio. Nenhum dado foi sobrescrito.');
      }
      for (const [tabela, campos] of Object.entries(tabelas)) {
        const rows = antigo.prepare(`SELECT ${campos.join(', ')} FROM ${tabela}`).all();
        for (const row of rows) {
          const valores = campos.map(campo => {
            const value = row[campo];
            if (typeof value !== 'string' && typeof value !== 'number' && value !== null) throw new Error(`Valor incompatível em ${tabela}.${campo}`);
            return value;
          });
          await db.prepare(`INSERT INTO ${tabela} (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`).run(...valores);
        }
        console.log(`${tabela}: ${rows.length} registros importados.`);
      }
    });
    console.log('Importação concluída. Entre novamente para criar uma sessão no Redis.');
  } finally { antigo.close(); await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
