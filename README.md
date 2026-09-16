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
    server/            # Autenticação e consultas por empresa
  scripts/             # Cadastro dos dados de demonstração
  tests/               # Testes do isolamento e APIs
  data/                # Banco SQLite existente
  package.json
package.json           # Comandos para os dois projetos
```

A raiz utiliza npm workspaces: um `npm install` instala as dependências dos dois projetos, com um único lockfile. O frontend usa a porta 3000; o backend, 3001. O navegador chama `/api` no frontend, que encaminha ao backend. Não existe mais implementação de autenticação ou banco no Next.js.

Esse encaminhamento usa [rewrites do Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites). As rotas do backend usam [controllers do NestJS](https://docs.nestjs.com/controllers).

## Como executar

Requer Node.js 22.13 ou superior, com suporte a SQLite nativo.

```bash
npm install
npm run seed
npm run dev:backend
```

Em outro terminal, na raiz, execute `npm run dev:frontend`. Abra `http://localhost:3000/login`. Use a senha `NexoDemo@2026` e o perfil correspondente:

| Empresa | Administrador | Gestor | Operador |
| --- | --- | --- | --- |
| Áurea | admin@aurea.com | gestor@aurea.com | operador@aurea.com |
| Vertex | admin@vertex.com | gestor@vertex.com | operador@vertex.com |

Essas são contas públicas de demonstração. O comando `seed` cria os registros sem sobrescrever os existentes. O banco fica em `backend/data/nexo.sqlite`; é possível mudar o caminho com `NEXO_DB_PATH`.

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

Em [backend/src/server/store.ts](backend/src/server/store.ts), as consultas aplicam o filtro:

```sql
SELECT id, nome, pedidos, previsao, status
FROM rotas WHERE tenant_id = ? ORDER BY id
```

O `?` recebe o identificador da empresa da sessão. O servidor não utiliza uma empresa enviada pelo navegador para autorizar acesso. Indicadores e gráfico seguem a mesma regra. O perfil Administrador também fica restrito à própria empresa.

## Justificativa da escolha

Foi escolhido **um banco compartilhado com isolamento por `tenant_id`** porque é uma estratégia simples para o escopo do teste: todas as empresas usam as mesmas tabelas e aplicação. Não é necessário manter um banco ou uma aplicação por empresa.

O SQLite permite executar o projeto localmente sem instalar um serviço de banco. A responsabilidade dessa escolha é aplicar o filtro de empresa em toda consulta. As operações de cadastro, alteração e exclusão usam a empresa da sessão. Clientes e transportadoras de outra empresa não podem ser associados a uma simulação.

## Onde está cada parte

| Arquivo | Responsabilidade |
| --- | --- |
| `backend/src/app.controller.ts` | Valida a sessão e pede os dados da empresa |
| `backend/src/server/store.ts` | Consulta os dados do painel com o filtro `tenant_id` |
| `backend/src/gestao.controller.ts` | Endpoints autenticados dos cadastros e simulações |
| `backend/src/server/gestao.ts` | CRUD, permissões, cálculo e persistência do histórico |
| `frontend/app/plataforma/gestao.tsx` | Formulários, consultas e histórico no frontend |
| `backend/src/server/auth.ts` | Verifica senha, cria sessão e encerra o acesso |
| `backend/src/server/database.ts` | Abre o banco e cria as tabelas |
| `backend/src/server/demo.ts` | Cadastra os dados fictícios, somente pelo comando `seed` |

Autenticação e multi-tenant têm responsabilidades diferentes: a autenticação identifica quem está acessando; o filtro por empresa determina quais dados essa pessoa pode acessar. As senhas usam hash, e as sessões usam um cookie `HttpOnly`, expiram após oito horas e são revogadas no logout.

## Como explicar na entrevista

> Usei um banco compartilhado. Cada usuário está vinculado a uma empresa, e cada registro tem um tenant_id. Após o login, o servidor identifica a empresa pela sessão e filtra as consultas por esse identificador. Assim, a Áurea só acessa dados da Áurea e a Vertex só acessa dados da Vertex. Escolhi essa abordagem pela simplicidade de implementação e manutenção no escopo do teste.

Para demonstrar, entre na Áurea, observe suas rotas, saia e entre na Vertex. O nome da empresa, as rotas, os indicadores e o gráfico mudam. Para comparar simultaneamente, use perfis separados do navegador, pois as abas compartilham a sessão.

## Testes e limites

```bash
npm test
npm run typecheck
npm run build
npm run test:integration
```

Os testes verificam isolamento, credenciais, permissões, CRUD, validação, cálculo, histórico, persistência, expiração e logout. `test:integration` inicia uma API NestJS real com banco e porta temporários e encerra o processo ao terminar; não modifica os dados de desenvolvimento. Para testar as APIs, mantenha frontend e backend em execução e execute `npm run test:http` em outro terminal, usando o banco de demonstração.

O escopo implementado inclui login, painel, gestão de usuários, clientes, transportadoras, simulação de frete e histórico. Os indicadores da visão geral ainda são demonstrativos; não são métricas calculadas das simulações. Não há cadastro público de empresas: os usuários são cadastrados pelo administrador da empresa autenticada. Listagens não têm paginação neste escopo.

O backend está no NestJS e valida a autenticação antes de passar a empresa às consultas. A execução atual pressupõe um servidor com disco persistente. Produção exige substituir as contas de demonstração, proteção contra tentativas repetidas de login e revisão da persistência para a hospedagem escolhida.


## Configuração e execução separada

Os comandos de cada projeto também podem ser executados dentro de sua pasta: `npm run dev`, `npm run build` e `npm start`.

- `BACKEND_URL`: endereço interno do Nest usado pelo Next, padrão `http://127.0.0.1:3001`. Defina antes do build do frontend se mudar o endereço.
- `FRONTEND_ORIGIN`: origem autorizada nas operações de escrita, incluindo login/logout pelo Nest, padrão `http://localhost:3000`. Em HTTPS, os cookies recebem `Secure`.
- `PORT`: porta do backend, padrão `3001`.
- `NEXO_DB_PATH`: caminho opcional do SQLite, relativo ao diretório do backend. Use o mesmo caminho no seed e na aplicação.

Exporte as variáveis no terminal antes de executar os comandos. O backend escuta em `127.0.0.1`, adequado à execução local com os dois processos na mesma máquina. Para outra infraestrutura, ajuste a interface de rede e os endereços.

O comando de desenvolvimento do backend compila o TypeScript antes de iniciar. Após editar arquivos TypeScript do backend, reinicie esse comando para recompilar. Para produção local, execute `npm run build` na raiz e depois `npm start --workspace backend` e `npm start --workspace frontend` em terminais separados.


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
