# Deploy público

## Escolha

O projeto usa **Render** como plataforma principal porque os Dockerfiles já
existem para o frontend Next.js e o backend NestJS. O Blueprint em
[`render.yaml`](../render.yaml) cria:

- `desafio-logistica1-frontend`: serviço web público Next.js.
- `desafio-logistica1-backend`: serviço web NestJS com healthcheck e seed idempotente.
- Redis externo: necessário para sessões, refresh tokens e limites; a URL é
   configurada secretamente em `REDIS_URL`.

O MySQL continua externo. O Render não oferece um MySQL gerenciado compatível
com este projeto. Use um MySQL gerenciado com TLS, como Aiven, Railway,
DigitalOcean ou outro provedor confiável, e informe sua URL em `DATABASE_URL`.
Não substitua o MySQL por PostgreSQL sem uma migração de banco e de Drizzle.

## Pré-requisitos

1. Repositório publicado no GitHub.
2. Conta Render com permissão para criar um Blueprint.
3. MySQL gerenciado acessível pela internet, com banco e usuário próprios.
4. Domínio público do frontend definido antes de configurar OAuth.

## Publicação

1. No Render, escolha **New > Blueprint** e conecte o repositório.
2. Selecione a branch que contém `render.yaml`, atualmente `test`.
3. Crie um Redis externo gratuito, por exemplo no Upstash, e copie sua URL
   `redis://` ou `rediss://` privada.
4. Crie o Blueprint. O Render exibirá os hosts dos serviços web.
5. No serviço `desafio-logistica1-backend`, configure os valores secretos:

   - `DATABASE_URL`: URL completa do MySQL externo.
   - `REDIS_URL`: URL completa do Redis externo.
   - `FRONTEND_ORIGIN`: URL pública exata do frontend, sem barra final.
   - `JWT_SECRET`: pelo menos 32 bytes aleatórios.
   - `MFA_ENCRYPTION_KEY`: 64 caracteres hexadecimais aleatórios.

6. Faça um deploy do backend e confirme `https://HOST_BACKEND/api/health`.
7. No serviço `desafio-logistica1-frontend`, defina `BACKEND_URL` como a URL pública do
   backend, incluindo `https://` e sem `/api` no final.
8. Faça um deploy do frontend e abra `https://HOST_FRONTEND/login`.
9. Após o primeiro deploy, o `preDeployCommand` executa
   `node dist/scripts/seed.js`. As contas públicas de demonstração são:

   | Empresa | Administrador | Gestor | Operador |
   | --- | --- | --- | --- |
   | Áurea | `admin@aurea.com` | `gestor@aurea.com` | `operador@aurea.com` |
   | Vertex | `admin@vertex.com` | `gestor@vertex.com` | `operador@vertex.com` |

   A senha de demonstração é `NexoDemo@2026`. Troque ou remova essas contas
   antes de divulgar o ambiente para usuários reais.

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
- Para atualizar o app, faça push na branch conectada ao Blueprint e acompanhe
  os logs de build, pre-deploy e healthcheck no Render.

## Limitações conhecidas

O Blueprint não cria o MySQL nem o Redis. A disponibilidade pública depende da
rede, TLS, firewall e plano dos provedores externos escolhidos. Sessões e rate
limits precisam de uma instância Redis compartilhada entre réplicas.

Para uma demonstração descartável, use uma base MySQL separada e dados de
seed. Para produção, substitua a senha demonstrativa, configure domínio
próprio, backups, retenção da auditoria, alertas e rotação planejada de chaves.