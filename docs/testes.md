# Estratégia de testes

Os testes automatizados são escritos com `node:test` e `node:assert/strict`,
compilados pelo TypeScript antes da execução. A organização acompanha as
responsabilidades do backend:

| Grupo | Cobertura | Dependências |
| --- | --- | --- |
| Unitários | Fórmulas, painel, DTOs, presenters, autenticação, MFA, OAuth e regras de serviços | Node.js e dependências npm |
| HTTP | Cookies, CSRF/origem, status, permissões, isolamento, refresh, MFA, upload e SSE | Node.js; Nest em memória |
| Serviços com persistência | CRUD, auditoria, migrações, multi-tenant e concorrência | MySQL e Redis; `MYSQL_TEST_URL` |
| Integração | Fluxos completos contra o processo NestJS real | Aplicação e infraestrutura de teste |

## Comandos

Na raiz do projeto:

```bash
npm test
npm run typecheck
npm run build
```

O comando `npm test` executa a suíte principal do backend e inclui
`backend/tests/application.test.ts`, que cobre os DTOs e o presenter adicionados
na organização arquitetural.

Para ampliar a execução dos testes TypeScript compilados:

```bash
npm run test:services --workspace backend
npm run test:integration --workspace backend
npm run docker:test
```

Os testes que usam persistência criam bancos temporários com prefixo
`nexo_test_`, aplicam as migrações atuais e removem os bancos ao finalizar.
Eles exigem `MYSQL_TEST_URL` com permissão para criar bancos e um Redis de teste.
Sem essa variável, os testes de persistência não devem ser considerados
executados.

## Critérios de qualidade

- Testes unitários verificam entradas válidas, entradas inválidas e contratos de
  saída sem depender de banco.
- Testes HTTP validam comportamento observável, incluindo códigos de status,
  cookies HttpOnly, isolamento por empresa e ausência de acesso antes do MFA.
- Testes de serviço verificam autorização e persistência, não apenas respostas
  simuladas.
- Dados sensíveis não aparecem nas asserções de resposta; os presenters são
  testados explicitamente para não expor refresh tokens.
- Cada alteração de schema deve manter uma migração e uma cobertura de
  persistência correspondente.