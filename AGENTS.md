# Orientações para alterações assistidas por IA

Este arquivo foi criado após a implementação inicial, na etapa de documentação
do uso de IA. Suas orientações se aplicam às próximas alterações; ele não é um
registro das instruções utilizadas desde o início do projeto.

## Contexto do projeto

- Leia o `README.md` e os arquivos envolvidos antes de alterar o código.
- O projeto usa npm workspaces, frontend Next.js/TypeScript em `frontend/` e
  backend NestJS/TypeScript em `backend/`, com MySQL, Drizzle e Redis.
- Preserve a separação entre interface, regras de negócio e persistência.
- Use os scripts existentes e mantenha o lockfile da raiz coerente quando
  alterar dependências.

## Regras de implementação

- Obtenha o tenant a partir da identidade autenticada no servidor. Não use um
  tenant enviado pelo navegador como autorização de acesso.
- Aplique isolamento por empresa nas consultas e operações de escrita e
  verifique permissões no backend.
- Valide entradas no servidor e preserve os controles de sessão e a proteção
  das senhas. Não exponha hashes, tokens ou credenciais em respostas e logs.
- Mantenha mudanças de schema acompanhadas das migrações correspondentes.
- Não sobrescreva alterações locais alheias à tarefa.
- Documente mudanças de comportamento, decisões relevantes e limitações no
  README ou em `docs/`. Diferencie requisitos desejados de recursos existentes.

## Fluxo de trabalho e validação

1. Identifique o requisito e inspecione a implementação relacionada.
2. Faça alterações com escopo definido, respeitando os padrões existentes.
3. Execute as verificações adequadas à mudança e informe os resultados reais.
4. Atualize a documentação quando houver mudanças de uso ou de arquitetura.

Comandos disponíveis na raiz:

- `npm test`: testes do backend definidos pelo projeto.
- `npm run typecheck`: build do backend e verificação de tipos do frontend.
- `npm run build`: build do backend e do frontend.
- `npm run docker:test`: testes em containers; exige Docker e utiliza serviços
  de teste conforme o Compose e as instruções do README.
- `npm run test:http`: verificação HTTP; exige aplicação e dados de demonstração
  disponíveis conforme o README.

Para alterações somente de documentação, confira links, caminhos e coerência
do conteúdo. Não é necessário executar toda a suíte da aplicação.
Nunca apresente um comando não executado como verificação aprovada. Se uma
verificação falhar ou não puder ser executada, informe a limitação.

## Registro de uso de IA

- Mantenha `docs/uso-de-ia.md` coerente com o processo efetivamente utilizado.
- Preserve os artefatos de apoio utilizados no projeto, sem incluir segredos.
- Identifique documentos retrospectivos e novas regras pela sua origem; não
  invente prompts, decisões, revisões ou resultados de testes passados.
