# Nexo

Interface de logística com frontend Next.js e backend NestJS separados. O painel apresenta indicadores e insights calculados sobre o histórico de simulações.

## Uso de IA e contexto de desenvolvimento

O projeto foi desenvolvido em etapas com auxílio do Codex. O processo relatado
e os artefatos disponíveis estão documentados em [Uso de IA](docs/uso-de-ia.md).
As orientações para próximas alterações estão em [AGENTS.md](AGENTS.md).
Esses dois arquivos foram criados após a implementação para registrar o
contexto de desenvolvimento e orientar a continuidade do trabalho.

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
# Configure JWT_SECRET e MFA_ENCRYPTION_KEY conforme docs/seguranca.md antes de iniciar.
docker compose up -d --build
docker compose exec backend node dist/scripts/seed.js
```

Se você já tiver um `.env`, preserve-o e ajuste as variáveis conforme o exemplo. O seed é explícito: iniciar containers não cria contas públicas automaticamente. Abra `http://localhost:3000/login`. Use a senha `NexoDemo@2026` e o perfil correspondente:

| Empresa | Administrador | Gestor | Operador |
| --- | --- | --- | --- |
| Áurea | admin@aurea.com | gestor@aurea.com | operador@aurea.com |
| Vertex | admin@vertex.com | gestor@vertex.com | operador@vertex.com |

Essas são contas públicas de demonstração. O comando `seed` cria os registros sem sobrescrever os existentes. Os dados ficam no MySQL, no volume `mysql_data`. As famílias de sessão ficam no Redis, no volume `redis_data`, por até sete dias; o JWT de acesso dura 15 minutos e é renovado por refresh token. O backend usa Drizzle ORM para schema, migrações e acesso tipado aos dados.

## Como funciona o multi-tenant

**Tenant significa empresa.** Cada usuário pertence a uma empresa, e os dados possuem um campo `tenant_id` que identifica a empresa dona do registro.

O fluxo é:

1. O usuário faz login com uma conta cadastrada.
2. O servidor valida a sessão e identifica a empresa do usuário.
3. O servidor busca os registros apenas dessa empresa.

A regra principal está em [backend/src/app.controller.ts](backend/src/app.controller.ts):

```ts
const store = await this.store;
const sessao = await store.session(request.cookies?.['nexo-sessao']);
if (!sessao) throw new UnauthorizedException('Sessão inválida ou expirada.');
const dados = await store.buscarPainel(sessao.tenantId);
```

O `tenantId` da sessão é enviado aos métodos do serviço e dos repositórios Drizzle. O servidor não utiliza uma empresa enviada pelo navegador para autorizar acesso. Indicadores, gráfico e insights seguem a mesma regra. O perfil Administrador também fica restrito à própria empresa.

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

O fluxo principal é simples: `Controller -> Store/Service -> Repository -> MySQL`. O controller recebe a requisição, o store aplica as regras de negócio e o repository acessa o banco através do Drizzle. O Redis mantém sessões, rotação de refresh, desafios temporários e contadores de abuso de autenticação.

Autenticação e multi-tenant têm responsabilidades diferentes: a autenticação identifica quem está acessando; o filtro por empresa determina quais dados essa pessoa pode acessar. As senhas usam hash, e o navegador recebe um cookie `HttpOnly`. O JWT assinado identifica uma família de sessão no Redis. O refresh token é opaco, armazenado por hash, rotacionado a cada uso e limitado a sete dias desde o login. No logout, a família é revogada. A empresa e o perfil são consultados no MySQL a cada requisição. Editar um usuário incrementa `session_version` na mesma transação da edição, invalidando imediatamente suas sessões antigas, mesmo que as chaves ainda não tenham expirado no Redis.

## Como explicar na entrevista

> Usei um banco compartilhado. Cada usuário está vinculado a uma empresa, e cada registro tem um tenant_id. Após o login, o servidor identifica a empresa pela sessão e filtra as consultas por esse identificador. Assim, a Áurea só acessa dados da Áurea e a Vertex só acessa dados da Vertex. Escolhi essa abordagem pela simplicidade de implementação e manutenção no escopo do teste.

Para demonstrar, entre na Áurea e salve uma simulação. Depois entre na Vertex: o histórico e os indicadores dessa empresa não incluem a simulação da Áurea. Empresas sem simulações exibem indicadores zerados. Para comparar simultaneamente, use perfis separados do navegador, pois as abas compartilham a sessão.

## Testes e limites

```bash
npm test
npm run typecheck
npm run build
npm run docker:test
```

`npm test` executa testes de JWT, refresh, MFA, OAuth e autenticação HTTP com dependências simuladas, além dos testes de cálculo de frete, indicadores, insights, importação e integrações sem precisar de MySQL/Redis. O teste HTTP de upload/SSE usa uma porta temporária local e persistência simulada. `npm run docker:test` constrói a imagem de testes e executa os testes de MySQL, Redis e da API NestJS real. Eles criam bancos MySQL temporários com prefixo `nexo_test_`, removidos ao final, e usam o banco lógico 1 do Redis; a aplicação usa o banco lógico 0. A suíte cobre CRUD, permissões, isolamento, histórico, persistência e expiração das sessões.

Para verificar o caminho completo pelo frontend, mantenha a aplicação e o seed em execução e rode `npm run test:http` na raiz (requer Node e `npm install` no host).
O escopo implementado inclui login, painel, gestão de usuários, clientes, transportadoras, simulação de frete e histórico. Os indicadores e insights da visão geral são calculados a partir das simulações persistidas da empresa. A tela `/cadastro` cria uma nova empresa e sua primeira conta de Administrador. Para ingressar em uma empresa existente, gestores e operadores devem ser cadastrados pelo administrador autenticado. Listagens não têm paginação neste escopo.

O backend está no NestJS e valida a autenticação antes de passar a empresa às consultas. A execução atual pressupõe um servidor com disco persistente. Produção exige substituir as contas de demonstração, configurar chaves próprias e HTTPS, credenciais OAuth e revisar a persistência para a hospedagem escolhida. A proteção contra tentativas repetidas está implementada; seus limites e comportamento atrás do proxy estão em [Segurança](docs/seguranca.md).


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
| `FRONTEND_ORIGIN` | Origem exata autorizada para escritas e callbacks, padrão `http://localhost:3000` |
| `JWT_SECRET`, `MFA_ENCRYPTION_KEY` | Chaves obrigatórias de assinatura e criptografia, conforme [Segurança](docs/seguranca.md#configuração) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Credenciais para habilitar os provedores OAuth |

O `.env.example` contém valores de desenvolvimento. Use senhas alfanuméricas nesse exemplo de URLs. Se mudar a porta, ajuste também `FRONTEND_ORIGIN`. Alterar senhas no `.env` não troca credenciais de um volume MySQL já inicializado.

O Nest recebe `DATABASE_URL` e `REDIS_URL` do Compose. O Next recebe `BACKEND_URL` durante o build. As tabelas são inicializadas pelas migrações versionadas em `backend/drizzle`, aplicadas automaticamente na inicialização. Mudanças futuras exigem atualizar o schema e executar `npx drizzle-kit generate` dentro de `backend/`.

### Desenvolvimento sem container para o código

Requer Node.js 22.13 ou superior. Inicie apenas a infraestrutura com portas locais:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d mysql redis
npm install
export DATABASE_URL='mysql://nexo:nexoDev2026@127.0.0.1:3307/nexo'
export REDIS_URL='redis://127.0.0.1:6380'
export FRONTEND_ORIGIN='http://localhost:3000'
export GOOGLE_CLIENT_ID='seu-client-id'
export GOOGLE_CLIENT_SECRET='seu-client-secret'
export GITHUB_CLIENT_ID='seu-client-id'
export GITHUB_CLIENT_SECRET='seu-client-secret'
npm run dev:backend
```

Ajuste as credenciais de acordo com seu `.env`. Em outro terminal, execute `npm run dev:frontend`. Pare antes o frontend/backend do Compose se for usar as mesmas portas. O backend compila ao iniciar; reinicie o comando após editar TypeScript. Os arquivos `.env` não são carregados automaticamente nos comandos locais: exporte as variáveis no terminal.

Use a mesma origem em `FRONTEND_ORIGIN` e no endereço em que o Next.js estiver
aberto. Na tela de login, os botões Google e GitHub permanecem clicáveis mesmo
sem configuração e informam quando o provedor ainda não foi habilitado. Para
Google e GitHub, cadastre exatamente os callbacks descritos em
[Segurança](docs/seguranca.md#google) e [Segurança](docs/seguranca.md#github),
e defina as quatro credenciais no ambiente do backend. Sem elas, os botões OAuth
não iniciam o fluxo externo; isso não é uma falha do login local.

Se aparecer `EADDRINUSE` na porta 3001, já existe um backend em execução. Pare
o processo anterior antes de iniciar outro, ou use `PORT=3011` e ajuste também o
destino `BACKEND_URL` do frontend.

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

Com exceção de `/cadastro`, os endpoints abaixo exigem sessão. Escritas exigem também origem autorizada. O prefixo é `/api`.

| Método | Caminho | Ação |
| --- | --- | --- |
| POST | `/cadastro` | Criar empresa e primeiro administrador (público, origem validada) |
| GET | `/gestao/:tipo?q=busca` | Listar/buscar cadastros |
| GET | `/gestao/:tipo/:id` | Consultar um cadastro |
| POST | `/gestao/:tipo` | Cadastrar |
| PUT | `/gestao/:tipo/:id` | Atualizar os campos do cadastro |
| DELETE | `/gestao/:tipo/:id` | Remover |
| POST | `/simulacoes` | Calcular e salvar uma simulação |
| GET | `/plataforma` | Sessão, indicadores, evolução diária, trajetos e insights da empresa |
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

## Dashboard e insights das simulações

A Visão geral usa os snapshots do histórico e é recarregada ao retornar a essa
seção. Todos os perfis autenticados podem consultar o painel da própria empresa.
As antigas tabelas demonstrativas de painéis e rotas são preservadas, mas não
alimentam mais o dashboard. Não houve alteração de schema.

- **Simulações realizadas:** quantidade de registros de todo o histórico.
- **Valor total estimado:** soma dos fretes simulados, com acumulação em centavos.
- **Frete médio estimado:** total dividido pelo número de simulações.
- **Trajetos mais simulados:** cinco pares origem/destino com maior quantidade,
  acompanhados do frete médio; espaços nas extremidades e diferenças entre
  maiúsculas/minúsculas são ignorados no agrupamento. O sentido é preservado.
- **Simulações por dia:** contagens dos últimos sete dias, incluindo hoje, em UTC.

Esses indicadores permitem avaliar demanda por cotações e distribuição dos
valores estimados. Cada simulação conta uma vez, inclusive cotações repetidas;
eles não representam pedidos, entregas, despesas ou economia realizada.
Sem registros, o painel mostra zeros e uma orientação para iniciar o histórico.

Os insights são regras determinísticas executadas no backend, sem serviço de IA:

- Cubagem: quando o peso cubado supera o real, informa a quantidade afetada e a
  diferença da parcela por peso em relação ao peso real, usando a tarifa salva.
- Concentração: com pelo menos três simulações, sinaliza transportadora com 70%
  ou mais das cotações e sugere comparar alternativas com os mesmos parâmetros.
- Variação: compara o frete médio dos últimos sete dias com os sete anteriores,
  em UTC, exigindo três registros em cada janela, média anterior positiva e
  variação absoluta de pelo menos 10%. O texto ressalta diferenças de carga e
  trajeto; não atribui causalidade nem promete economia.

As regras se baseiam nos dados históricos, mesmo após alterações ou remoções de
cadastros. O histórico permite buscar por origem, destino, transportadora,
cliente ou responsável e expandir os detalhes de cada simulação.
Neste escopo, a agregação e a busca carregam o histórico completo, sem paginação;
um volume maior exigirá agregações no banco e consultas paginadas.

O seed reconhece erros de duplicidade tanto do driver quanto encapsulados pelo
Drizzle, mantendo a execução repetida sem sobrescrever os registros existentes.

## Integrações, upload, processamento assíncrono e tempo real

A Simulação de frete permite preencher cidades consultando **ViaCEP** e
**IBGE**. Administradores e gestores encontram o menu **Importações**, com
upload de clientes por CSV (até 256 KiB e 500 registros), processamento em
segundo plano e acompanhamento em tempo real por **SSE**.

O executor roda em memória no backend: clientes ficam no MySQL, mas trabalhos
não são retomados após reinício. CSV é o formato implementado; XLSX não está
incluído. Reenvios podem duplicar clientes. Não houve alteração de schema.

Consulte [a documentação completa](docs/integracoes-e-importacoes.md) para
formato, exemplo, permissões, endpoints, arquitetura, demonstração e limites.

## Segurança

Login por e-mail/senha, OAuth Google e GitHub, MFA/TOTP, JWT, refresh token com
rotação e detecção de reuso, controle de acesso por perfil e limitação de abuso
estão implementados. A tela **Segurança da conta** (`/seguranca`) permite ativar
MFA e vincular provedores após reautenticação. MFA é opcional por conta; quando
ativado, é exigido tanto no login por senha quanto por OAuth.

Consulte [Segurança e autenticação](docs/seguranca.md) para configuração das
chaves e provedores, callbacks, fluxos, endpoints, migração, recuperação,
limites e validações. As credenciais reais dos provedores precisam ser fornecidas
no ambiente para habilitar seus botões. A configuração inicial OAuth parte de
uma conta local; não há associação automática por e-mail.
