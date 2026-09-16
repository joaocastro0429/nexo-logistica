import { abrirBanco } from '../src/server/database';
import { cadastrarDemonstracao } from '../src/server/demo';

const db = abrirBanco();
try {
  cadastrarDemonstracao(db);
  console.log('Empresas Áurea e Vertex cadastradas. Consulte os acessos no README.');
} finally { db.close(); }
