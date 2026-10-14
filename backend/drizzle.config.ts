import { defineConfig } from 'drizzle-kit';
import { configuracaoMySql } from './src/infrastructure/database/mysql.config';

export default defineConfig({
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: configuracaoMySql(),
});
