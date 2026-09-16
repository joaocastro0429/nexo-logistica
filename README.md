# Nexo

Interface de logística com frontend Next.js e backend NestJS separados. As páginas, os estilos e os dados existentes foram preservados.

## Estrutura

```text
frontend/
  app/                 # Telas Next.js
  lib/types.ts         # Tipos usados nas telas
  next.config.ts       # Encaminha /api ao NestJS
  package.json
backend/
  src/
    main.ts            # Inicialização do NestJS
    app.controller.ts  # Login, logout e painel
    gestao.controller.ts # Cadastros, simulação e histórico
    domain/             # Contratos de domínio e repositórios
    infrastructure/    # Drizzle, schema MySQL e repositórios
    server/             # Redis, autenticação e composição
  drizzle/              # Migrações versionadas do MySQL
  scripts/             # Cadastro dos dados de demonstração
  tests/               # Testes do isolamento e APIs
  Dockerfile           # Imagem do NestJS
  package.json
compose.yaml           # Frontend, backend, MySQL e Redis
.env.example           # Configuração de desenvolvimento
package.json           # Comandos para os dois projetos
```

A raiz utiliza npm workspaces: um `npm install` instala as dependências dos dois projetos, com um único lockfile. O frontend usa a porta 3000; o backend, 3001. O navegador chama `/api` no frontend, que encaminha ao backend. Não existe mais implementação de autenticação ou banco no Next.js.

Esse encaminhamento usa [rewrites do Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites). As rotas do backend usam [controllers do NestJS](https://docs.nestjs.com/controllers).

## Como executar

A execução recomendada usa Docker e Docker Compose:

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend node dist/scripts/seed.js
```

Se você já tiver um `.env`, preserve-o e ajuste as variáveis conforme o exemplo. O seed é explícito: iniciar containers não cria contas públicas automaticamente. Abra `http://localhost:3000/login`. Use a senha `NexoDemo@2026` e o perfil correspondente:

| Empresa | Administrador | Gestor | Operador |
| --- | --- | --- | --- |
| Áurea | admin@aurea.com | gestor@aurea.com | operador@aurea.com |
| Vertex | admin@vertex.com | gestor@vertex.com | operador@vertex.com |

Essas são contas públicas de demonstração. O comando `seed` cria os registros sem sobrescrever os existentes. Os dados ficam no MySQL, no volume `mysql_data`. As sessões ficam no Redis, no volume `redis_data`, com expiração de oito horas. O backend usa Drizzle ORM para schema, migrações e acesso tipado aos dados.

## Como funciona o multi-tenant

**Tenant significa empresa.** Cada usuário pertence a uma empresa, e os dados possuem um campo `tenant_id` que identifica a empresa dona do registro.

O fluxo é:

1. O usuário faz login com uma conta cadastrada.
2. O servidor valida a sessão e identifica a empresa do usuário.
3. O servidor busca os registros apenas dessa empresa.

A regra principal está em [backend/src/app.controller.ts](backend/src/app.controller.ts):

```ts
const sessao = this.store.session(request.cookies?.['nexo-sessao']);
if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
const dados = this.store.buscarPainel(sessao.tenantId);
```

O `tenantId` da sessão é enviado aos métodos do serviço e dos repositórios Drizzle. O servidor não utiliza uma empresa enviada pelo navegador para autorizar acesso. Indicadores e gráfico seguem a mesma regra. O perfil Administrador também fica restrito à própria empresa.

## Justificativa da escolha

Foi escolhido **um banco compartilhado com isolamento por `tenant_id`** porque é uma estratégia simples para o escopo do teste: todas as empresas usam as mesmas tabelas e aplicação. Não é necessário manter um banco ou uma aplicação por empresa.

O MySQL usa tabelas compartilhadas com índices por empresa e transações InnoDB. O Redis armazena sessões com TTL. A responsabilidade dessa escolha é aplicar o filtro de empresa em toda consulta. As operações de cadastro, alteração e exclusão usam a empresa da sessão. Clientes e transportadoras de outra empresa não podem ser associados a uma simulação.

## Onde está cada parte

| Arquivo | Responsabilidade |
| --- | --- |
| `backend/src/app.controller.ts` | Valida a sessão e pede os dados da empresa |
| `backend/src/server/store.ts` | Serviço principal: autenticação, gestão e composição dos repositórios |
| `backend/src/gestao.controller.ts` | Endpoints autenticados dos cadastros e simulações |
| `backend/src/server/gestao.ts` | CRUD, permissões, cálculo e persistência do histórico |
| `frontend/app/plataforma/gestao.tsx` | Formulários, consultas e histórico no frontend |
| `backend/src/server/auth.ts` | Verifica senha, cria sessão e encerra o acesso |
| `backend/src/infrastructure/database/` | Conexão Drizzle, schema e migrações |
| `backend/src/server/demo.ts` | Cadastra os dados fictícios, somente pelo comando `seed` |

O fluxo principal é simples: `Controller -> Store/Service -> Repository -> MySQL`. O controller recebe a requisição, o store aplica as regras de negócio e o repository acessa o banco através do Drizzle. O Redis fica responsável somente pelas sessões.

Autenticação e multi-tenant têm responsabilidades diferentes: a autenticação identifica quem está acessando; o filtro por empresa determina quais dados essa pessoa pode acessar. As senhas usam hash, e o navegador recebe um cookie `HttpOnly`. O hash do token identifica uma sessão no Redis, com TTL de oito horas. No logout, a chave é removida. A empresa e o perfil são consultados no MySQL a cada requisição. Editar um usuário incrementa `session_version` na mesma transação da edição, invalidando imediatamente suas sessões antigas, mesmo que as chaves ainda não tenham expirado no Redis.

## Como explicar na entrevista

> Usei um banco compartilhado. Cada usuário está vinculado a uma empresa, e cada registro tem um tenant_id. Após o login, o servidor identifica a empresa pela sessão e filtra as consultas por esse identificador. Assim, a Áurea só acessa dados da Áurea e a Vertex só acessa dados da Vertex. Escolhi essa abordagem pela simplicidade de implementação e manutenção no escopo do teste.

Para demonstrar, entre na Áurea, observe suas rotas, saia e entre na Vertex. O nome da empresa, as rotas, os indicadores e o gráfico mudam. Para comparar simultaneamente, use perfis separados do navegador, pois as abas compartilham a sessão.

## Testes e limites

```bash
npm test
npm run typecheck
npm run build
npm run docker:test
```

`npm test` executa os testes de cálculo sem precisar de serviços. `npm run docker:test` constrói a imagem de testes e executa os testes de MySQL, Redis e da API NestJS real. Eles criam bancos MySQL temporários com prefixo `nexo_test_`, removidos ao final, e usam o banco lógico 1 do Redis; a aplicação usa o banco lógico 0. A suíte cobre CRUD, permissões, isolamento, histórico, persistência e expiração das sessões.

Para verificar o caminho completo pelo frontend, mantenha a aplicação e o seed em execução e rode `npm run test:http` na raiz (requer Node e `npm install` no host).
O escopo implementado inclui login, painel, gestão de usuários, clientes, transportadoras, simulação de frete e histórico. Os indicadores da visão geral ainda são demonstrativos; não são métricas calculadas das simulações. Não há cadastro público de empresas: os usuários são cadastrados pelo administrador da empresa autenticada. Listagens não têm paginação neste escopo.

O backend está no NestJS e valida a autenticação antes de passar a empresa às consultas. A execução atual pressupõe um servidor com disco persistente. Produção exige substituir as contas de demonstração, proteção contra tentativas repetidas de login e revisão da persistência para a hospedagem escolhida.


## Docker, persistência e configuração

- MySQL: imagem `mysql:8.4`, volume persistente, usuário próprio da aplicação.
- Redis: imagem `redis:7.4-alpine`, AOF habilitado, usado efetivamente para sessões.
- Backend: NestJS em Node 22, usuário não root, conexão interna com `mysql:3306` e `redis:6379`.
- Frontend: Next.js em modo standalone, encaminha `/api` ao backend.

Somente o frontend publica uma porta no host, restrita a `127.0.0.1`. MySQL, Redis e backend ficam na rede interna do Compose. Os serviços aguardam healthchecks das dependências; `/api/health` verifica MySQL e Redis. O Redis é obrigatório para autenticar: indisponibilidade não libera acesso sem sessão.

```bash
docker compose ps
docker compose logs -f backend
docker compose down
```

`down` encerra containers e mantém os volumes. `down -v` também apaga os volumes e os dados, portanto não o utilize para apenas reiniciar.

Variáveis de `.env` (o arquivo não é versionado):

| Variável | Uso |
| --- | --- |
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Banco e credenciais da aplicação |
| `MYSQL_ROOT_PASSWORD` | Inicialização do MySQL e criação dos bancos temporários nos testes |
| `FRONTEND_PORT` | Porta local do frontend, padrão 3000 |
| `FRONTEND_ORIGIN` | Origem exata autorizada para escritas, padrão `http://localhost:3000` |

O `.env.example` contém valores de desenvolvimento. Use senhas alfanuméricas nesse exemplo de URLs. Se mudar a porta, ajuste também `FRONTEND_ORIGIN`. Alterar senhas no `.env` não troca credenciais de um volume MySQL já inicializado.

O Nest recebe `DATABASE_URL` e `REDIS_URL` do Compose. O Next recebe `BACKEND_URL` durante o build. As tabelas são inicializadas pelas migrações versionadas em `backend/drizzle`, aplicadas automaticamente na inicialização. Mudanças futuras exigem atualizar o schema e executar `npm run db:generate`.

### Desenvolvimento sem container para o código

Requer Node.js 22.13 ou superior. Inicie apenas a infraestrutura com portas locais:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d mysql redis
npm install
export DATABASE_URL='mysql://nexo:nexoDev2026@127.0.0.1:3307/nexo'
export REDIS_URL='redis://127.0.0.1:6380'
npm run dev:backend
```

Ajuste as credenciais de acordo com seu `.env`. Em outro terminal, execute `npm run dev:frontend`. Pare antes o frontend/backend do Compose se for usar as mesmas portas. O backend compila ao iniciar; reinicie o comando após editar TypeScript. Os arquivos `.env` não são carregados automaticamente nos comandos locais: exporte as variáveis no terminal.

Referências: [Drizzle ORM](https://orm.drizzle.team/docs/overview), [MySQL2](https://sidorares.github.io/node-mysql2/docs), [cliente Redis para Node](https://redis.io/docs/latest/develop/clients/nodejs/) e [ordem de inicialização no Compose](https://docs.docker.com/compose/how-tos/startup-order/).

## Funcionalidades e permissões

| Ação | Administrador | Gestor | Operador |
| --- | --- | --- | --- |
| Cadastrar, consultar, editar e remover usuários | Sim | Não | Não |
| Cadastrar, editar e remover clientes e transportadoras | Sim | Sim | Não |
| Consultar clientes e transportadoras | Sim | Sim | Sim |
| Simular frete e consultar histórico da empresa | Sim | Sim | Sim |

As restrições são verificadas no backend em cada requisição. Alterar o menu ou enviar outro perfil/tenant no corpo não concede acesso. Usuários novos recebem o tenant da sessão do administrador. O e-mail de login é único em todo o sistema. Senhas novas exigem entre 8 e 256 caracteres e são armazenadas com hash e salt.

Editar um usuário revoga suas sessões; ele precisa entrar novamente. Uma senha vazia na edição mantém a anterior. Não é permitido remover ou rebaixar o último administrador da empresa. As consultas nunca retornam hashes de senha.

No menu lateral estão **Usuários**, **Clientes**, **Transportadoras**, **Simulação de frete** e **Histórico**. As tabelas permitem busca, e a remoção exige confirmação. O seed também cadastra um cliente e uma transportadora por empresa para facilitar a demonstração.

## Fórmula da simulação

A origem e o destino são textos de cidade/UF. A distância em quilômetros é informada pelo usuário; não há integração com mapas ou cálculo automático de trajetos. As dimensões são de um único volume, em centímetros, e o peso é em quilogramas.

```text
peso cubado = comprimento × largura × altura / 6000
peso cobrado = maior entre peso real e peso cubado
parcela por peso = peso cobrado × preço por kg da transportadora
parcela por distância = distância × preço por km da transportadora
seguro = valor da carga × 0,005
frete = taxa base + parcela por peso + parcela por distância + seguro
```

Cada parcela monetária é arredondada para centavos antes da soma. O fator de cubagem 6000 e o seguro de 0,5% são escolhas para o teste técnico, sem pretensão de reproduzir uma tabela comercial. Base e preços por kg/km são configurados no cadastro da transportadora. Origem e destino identificam o trajeto; seu impacto no preço é representado pela distância informada.

Exemplo: 10 kg, 60 × 40 × 50 cm, 100 km, carga de R$ 1.000, base de R$ 20, preço de R$ 2/kg e R$ 0,50/km. O peso cubado é 20 kg; o frete é `20 + 40 + 50 + 5 = R$ 115`.

A API rejeita números não finitos, pesos ou dimensões não positivos e valores negativos de carga, distância ou tarifas. Limites: peso de até 100.000 kg, cada dimensão até 1.000 cm, distância até 20.000 km e carga até R$ 100 milhões. São limites explícitos da demonstração.

Cada simulação concluída é salva automaticamente com data, usuário, cliente opcional, transportadora, entradas, tarifas e detalhamento do cálculo. O histórico guarda uma cópia desses dados; editar ou remover um cadastro não altera os resultados antigos. Não há endpoint de edição ou exclusão do histórico.

## Endpoints do NestJS

Todos os endpoints abaixo exigem sessão. Escritas exigem também origem autorizada. O prefixo é `/api`.

| Método | Caminho | Ação |
| --- | --- | --- |
| GET | `/gestao/:tipo?q=busca` | Listar/buscar cadastros |
| GET | `/gestao/:tipo/:id` | Consultar um cadastro |
| POST | `/gestao/:tipo` | Cadastrar |
| PUT | `/gestao/:tipo/:id` | Atualizar os campos do cadastro |
| DELETE | `/gestao/:tipo/:id` | Remover |
| POST | `/simulacoes` | Calcular e salvar uma simulação |
| GET | `/simulacoes` | Histórico da empresa |
| GET | `/simulacoes/:id` | Detalhes de uma simulação |

`:tipo` aceita apenas `usuarios`, `clientes` e `transportadoras`. Dados inexistentes ou de outra empresa retornam `404`; sessão inválida, `401`; perfil sem permissão, `403`; entrada inválida, `400`; e-mail indisponível ou tentativa de remover/rebaixar o último administrador, `409`.

Campos dos cadastros:

- Usuário: `nome`, `email`, `perfil`, `senha` (opcional na edição).
- Cliente: `nome`, `email`, `telefone` e `documento` (os dois últimos opcionais; documento é informativo, sem validação fiscal).
- Transportadora: `nome`, `email`, `telefone` opcional, `taxa_base`, `valor_kg`, `valor_km`.

Exemplo de corpo para simulação (os IDs devem pertencer à empresa autenticada):

```json
{
  "origem": "São Paulo/SP",
  "destino": "Campinas/SP",
  "peso": 10,
  "comprimento": 60,
  "largura": 40,
  "altura": 50,
  "distancia": 100,
  "valorCarga": 1000,
  "transportadoraId": "aurea-transportadora",
  "clienteId": "aurea-cliente"
}
```
