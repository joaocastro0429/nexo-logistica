import { abrirBanco } from '../src/server/database';
import { cadastrarDemonstracao } from '../src/server/demo';

async function main() {
  const db = await abrirBanco();
  try { await cadastrarDemonstracao(db); console.log('Dados de demonstração cadastrados no MySQL.'); }
  finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
