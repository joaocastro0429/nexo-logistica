# Deploy público

## Recursos configurados em 21/09/2026

| Componente | Recurso | Estado verificado |
| --- | --- | --- |
| Frontend | [Vercel: nexo-logistica](https://vercel.com/joaocastro125/nexo-logistica) | Configurado; publicação aguardando backend saudável |
| Backend | [Render: nexo-logistica-backend](https://dashboard.render.com/web/srv-daol5gid0e5s738o0pqg) | Build remoto aprovado; inicialização falhou sem `DATABASE_URL` |
| Redis | Render: `nexo-logistica-redis` (`red-daol4b6gekts73cnca6g`) | Plano gratuito, disponível, somente rede privada |
| MySQL | Aiven Free, opção prevista | Ainda não criado; falta autenticação na Aiven |

A Vercel reservou `https://nexo-logistica-eight.vercel.app`. A variável
`BACKEND_URL` de Production aponta para
`https://nexo-logistica-backend.onrender.com`, e o backend já usa a origem exata
do frontend. **Esses endereços ainda não representam uma aplicação funcional.**

Chaves novas de JWT e MFA, namespace e conexão interna do Redis foram configurados
no backend. A cópia local está em `.env.production`, ignorada pelo Git e pelos
uploads Vercel, com permissão `600`. `DATABASE_URL` está vazia enquanto o MySQL
não for provisionado. Não substitua essas chaves a cada deploy.

Para permitir a criação do MySQL gratuito pela API, crie ou acesse sua conta
[Aiven](https://console.aiven.io/), gere um
[token temporário](https://aiven.io/docs/platform/howto/create_authentication_token)
e preencha `AIVEN_TOKEN` no arquivo local `.env.aiven`, também ignorado e com
permissão `600`. Não envie o token em mensagens nem o inclua em commits.
Depois de provisionar o banco, configure sua URL com TLS no backend, faça um
novo deploy, confirme `/api/health` e só então publique o frontend.

## Vercel: frontend Next.js

O frontend está preparado para a Vercel com
[`frontend/vercel.json`](../frontend/vercel.json). Isso não publica o backend,
o MySQL ou o Redis. Login, cadastro, painel e demais operações dependem de uma
API NestJS acessível por HTTPS com essas dependências configuradas.

A Vercel também [suporta NestJS](https://vercel.com/docs/frameworks/backend/nestjs),
mas este backend mantém a fila e o progresso de importação em memória e executa
trabalhos depois de responder ao upload. Instâncias de Functions podem ser
interrompidas e requisições diferentes podem atingir processos diferentes.
O SSE também está sujeito aos
[limites de duração](https://vercel.com/docs/functions/limitations).
Por isso, a configuração atual usa **frontend na Vercel e backend em um serviço
Node/Docker contínuo, com uma única instância**. Hospedar todo o backend em
Functions exige antes adaptar a fila e o estado compartilhado; não foi
implementada essa migração. Reinícios do backend ainda perdem trabalhos em memória.

### Configuração do projeto

1. Importe o repositório `joaocastro0429/nexo-logistica` na Vercel.
2. Selecione **Root Directory: `frontend`** e **Framework Preset: Next.js**.
   Habilite a inclusão de arquivos fora da Root Directory para usar os workspaces
   e o `package-lock.json` da raiz. Consulte
   [monorepos na Vercel](https://vercel.com/docs/monorepos).
3. Use `npm run build` como Build Command e mantenha o Output Directory padrão
   do Next.js. Para a instalação, use `npm ci` com as dependências de desenvolvimento.
   O projeto requer Node.js 22.13 ou superior.
4. Configure `BACKEND_URL` no ambiente **Production** com a origem pública real
   do backend, por exemplo `https://api.seu-dominio.com`, sem `/api`.
   O build na Vercel rejeita variável ausente, HTTP, localhost e URLs com caminho.
5. No backend, defina `FRONTEND_ORIGIN` como o domínio de produção da Vercel,
   por exemplo `https://seu-projeto.vercel.app`, sem barra final. Configure
   `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` e `MFA_ENCRYPTION_KEY` somente no backend,
   conforme [Segurança](seguranca.md#configuração). URLs locais não são acessíveis
   pela hospedagem. Aplique as migrações ao iniciar o backend.
6. Confirme `https://HOST_BACKEND/api/health` antes de publicar o frontend.
7. Faça o deploy e valide `/login`, `/api/health`, login, cadastro e importação
   pelo domínio público do frontend. Os cookies permanecem no domínio do frontend.

O rewrite `/api/:path*` usa `BACKEND_URL` durante o build. Alterar essa variável
exige um novo deploy. URLs de Preview da Vercel não são automaticamente
autorizadas pelo backend: para testar escritas em Preview, use um backend e
bancos separados, com `FRONTEND_ORIGIN` correspondente à origem desse ambiente.

### Publicação pelo terminal

Execute a partir da **raiz do repositório**, após configurar o projeto acima:

```bash
npx vercel login
npx vercel link
npx vercel env add BACKEND_URL production
npx vercel --prod
```

No `link`, selecione o projeto configurado com Root Directory `frontend`.
O arquivo `.vercel/project.json` é local e ignorado pelo Git. O
[`.vercelignore`](../.vercelignore) exclui arquivos `.env`, dependências e builds
locais dos uploads pelo CLI. As configurações presentes neste repositório não
atestam que exista um deploy público saudável.

## Backend e Redis no Render

O serviço criado usa o runtime Node nativo, com o lockfile da raiz. Não depende
do Blueprint para iniciar:

| Configuração | Valor |
| --- | --- |
| Repositório | `https://github.com/joaocastro0429/nexo-logistica` |
| Branch | `test` |
| Root Directory | raiz do repositório |
| Runtime / versão | Node / `NODE_VERSION=22.22.2` |
| Build | `npm ci --include=dev && npm run build --workspace backend` |
| Start | `cd backend && node dist/src/main.js` |
| Healthcheck | `/api/health` |
| Plano / região / instâncias | Free / Oregon / 1 |
| Auto-deploy | Desativado; deploys manuais enquanto a infraestrutura é configurada |

O `cd backend` é necessário porque as migrações usam a pasta `drizzle` relativa
ao diretório de execução. A inicialização aplica as migrações automaticamente.
Não foi configurado seed automático: `/cadastro` permite criar a primeira empresa
e seu administrador depois que o banco estiver disponível.

O Key Value está na mesma região, usa `noeviction`, persistência `off` e lista
de IPs externos vazia. A conexão do NestJS usa a URL **interna**, que só funciona
dentro do Render. Não use essa URL para testes a partir do computador local.
O [plano gratuito](https://render.com/docs/free) perde sessões ao reiniciar o
Redis, e o backend pode dormir após inatividade. Uma demonstração pode usar esse
plano; disponibilidade contínua e persistência do Redis exigem outra configuração.

O MySQL precisa de um serviço externo com TLS. A opção prevista é o
[MySQL gratuito da Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier).
Com MySQL2, configure a opção `ssl` com a CA do provedor e validação de
certificado/identidade habilitada. Não desative a validação para contornar erros
de conexão. PostgreSQL não substitui este MySQL sem alterar schema e persistência.

O arquivo [`render.yaml`](../render.yaml) mantém a configuração Docker anterior,
com frontend próprio e nomes diferentes; ele **não foi aplicado** aos recursos
acima. Suas alterações locais foram preservadas. Antes de usar essa alternativa,
revise o `preDeployCommand`: esse recurso
[exige um plano pago](https://render.com/blog/build-pipelines) e não é utilizado
no backend gratuito configurado nesta etapa.

## OAuth e cookies

Depois de conhecer o domínio público do frontend, atualize as credenciais do
backend e cadastre exatamente estes callbacks:

```text
https://HOST_FRONTEND/api/oauth/google/callback
https://HOST_FRONTEND/api/oauth/github/callback
```

O navegador acessa `/api` no domínio do frontend; o rewrite do Next encaminha
as chamadas para `BACKEND_URL`. Por isso, `BACKEND_URL` precisa ser alterado e
o frontend precisa ser reconstruído quando o host do backend mudar.

Use HTTPS. `FRONTEND_ORIGIN` precisa ser exatamente igual à origem usada pelo
navegador, pois o backend rejeita origens diferentes nas operações de escrita.
Os cookies de sessão são HttpOnly e Secure quando a origem é HTTPS.

## Operação e manutenção

- O healthcheck do backend é `/api/health`.
- As migrações Drizzle são aplicadas na inicialização do backend.
- O seed é idempotente e pode ser executado novamente, mas não apaga dados.
- Preserve `JWT_SECRET`, `MFA_ENCRYPTION_KEY` e `AUTH_NAMESPACE` entre deploys.
- Faça backup do MySQL e trate o Redis como armazenamento de sessões efêmeras.
   Para produção, use um Redis persistente e privado.
- Não coloque `.env`, URLs com senha, chaves OAuth ou credenciais no Git.
- Para atualizar o backend, publique o código na branch `test` e dispare um
  deploy manual no serviço Render. O primeiro build usou o commit `a02e298`.
- Para atualizar o frontend, execute o CLI Vercel conforme descrito acima;
  vincular o diretório pelo CLI não configura automaticamente o deploy por Git.

## Limitações conhecidas

O MySQL ainda não foi criado. A disponibilidade pública depende da rede, TLS,
firewall e plano dos provedores externos escolhidos. Sessões e rate limits
precisam de uma instância Redis compartilhada entre réplicas; a fila de importação
atual exige uma única instância do backend.

Para uma demonstração descartável, use uma base MySQL separada e dados de
seed. Para produção, substitua a senha demonstrativa, configure domínio
próprio, backups, retenção da auditoria, alertas e rotação planejada de chaves.
