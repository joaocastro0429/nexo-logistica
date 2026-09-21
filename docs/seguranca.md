# Segurança e autenticação

Implementação acrescentada em setembro de 2026. Os controles abaixo descrevem
recursos existentes, com os limites e a configuração necessários para utilizá-los.

## Recursos implementados

| Requisito | Implementação |
| --- | --- |
| Login por e-mail e senha | E-mail normalizado, senha verificada com scrypt e salt, erro genérico, verificação assíncrona para não bloquear o event loop |
| OAuth Google | Authorization Code + PKCE S256; ID token validado com JWKS, RS256, issuer, audience, expiração, idade e nonce |
| OAuth GitHub | Authorization Code + PKCE S256; identidade consultada no `/user`, e-mail primário verificado no `/user/emails` |
| MFA/TOTP | Ativação com confirmação do código; TOTP SHA-1, seis dígitos, 30 segundos, janela de ±1 passo; rejeição de reutilização |
| JWT | Access token HS256 de 15 minutos, issuer `nexo`, audience `nexo-api`, subject e identificador de sessão |
| Refresh token | Token opaco aleatório de 256 bits, rotação atômica, validade absoluta de sete dias, detecção de reuso |
| Perfis | Administrador, Gestor e Operador; autorização e isolamento por empresa mantidos no backend |
| Proteção contra abuso | Contadores Redis atômicos por endereço de conexão, e-mail e conta; limites também para MFA, cadastro e vinculação |

## Configuração

Copie `.env.example` somente se ainda não tiver `.env`. Gere **dois valores
independentes** executando o comando abaixo duas vezes, e configure `JWT_SECRET`
e `MFA_ENCRYPTION_KEY` no ambiente do backend:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O backend recusa inicialização sem JWT_SECRET de pelo menos 32 bytes e
MFA_ENCRYPTION_KEY de exatamente 64 caracteres hexadecimais. Nenhuma chave de
produção é gerada silenciosamente ou versionada. O Compose repassa as variáveis
do `.env`; na execução local elas precisam estar no ambiente do processo.

| Variável | Finalidade |
| --- | --- |
| `JWT_SECRET` | Assinatura e verificação do JWT; deve ser aleatória e igual entre réplicas |
| `MFA_ENCRYPTION_KEY` | Chave AES-256-GCM para os segredos TOTP; igual entre réplicas e preservada nos backups seguros |
| `FRONTEND_ORIGIN` | Origem pública exata, sem barra final; usada em CSRF, callbacks e redirecionamentos |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Aplicativo OAuth Google |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth App GitHub |
| `AUTH_NAMESPACE` | Prefixo Redis opcional, padrão `nexo`; use um prefixo diferente por ambiente e o mesmo entre réplicas |

Sem as credenciais de um provedor, ele aparece como não configurado em Segurança
e seu botão de login permanece visível e clicável, exibindo uma explicação em vez
de iniciar um fluxo OAuth inválido. Os botões ficam acima do formulário de senha.
Falhas ao consultar os provedores são informadas na tela. Senha, MFA e refresh
continuam disponíveis.
Em produção configure `FRONTEND_ORIGIN` com HTTPS; isso ativa `Secure` nos cookies.
Mantenha backend, MySQL e Redis em rede privada conforme o Compose.

### Google

1. Crie um cliente OAuth do tipo aplicação Web no Google Cloud e configure a tela
   de consentimento e os usuários de teste, caso o aplicativo esteja em teste.
2. Cadastre exatamente `${FRONTEND_ORIGIN}/api/oauth/google/callback` como URI de
   redirecionamento, substituindo a variável pelo valor real. Em desenvolvimento:
   `http://localhost:3000/api/oauth/google/callback`.
3. Configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no backend e reinicie-o.

São solicitados os escopos `openid email`. O ID token exige e-mail verificado,
nonce correspondente e identidade estável (`sub`). A implementação segue o
[fluxo de servidor OpenID Connect do Google](https://developers.google.com/identity/openid-connect/openid-connect).

### GitHub

1. Crie uma **OAuth App** nas configurações de desenvolvedor do GitHub.
2. Use a URL pública da aplicação como Homepage URL e
   `${FRONTEND_ORIGIN}/api/oauth/github/callback` como Authorization callback URL.
   Em desenvolvimento: `http://localhost:3000/api/oauth/github/callback`.
3. Configure `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` e reinicie o backend.

São solicitados `read:user user:email`. A identidade é o ID numérico imutável,
e não o nome de usuário. A implementação usa o
[fluxo Web OAuth com PKCE do GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

### Vincular e entrar

Entre inicialmente com e-mail e senha. Abra **Segurança da conta** no menu da
plataforma (`/seguranca`), informe a senha e, se o MFA estiver ativo, um código
TOTP ou de recuperação. Clique em **Vincular** e autorize o provedor.

A vinculação requer a mesma conta ainda autenticada no callback e a mesma
`session_version` de quando o fluxo começou. A tabela `identidades_oauth` permite
um vínculo por provedor/usuário e um único dono para cada identidade externa.
Não há criação de usuário/empresa nem associação automática por e-mail no OAuth:
as contas locais não possuem um fluxo de verificação de propriedade do e-mail,
e associá-las por coincidência de endereço permitiria apropriação de contas.

Depois do vínculo, use **Entrar com Google/GitHub** na tela de login. Se MFA estiver
ativo, o provedor comprova o primeiro fator e o sistema ainda solicita TOTP ou
recuperação. O provedor não escolhe o tenant nem o perfil.

Cada fluxo usa `state` aleatório, cookie HttpOnly de correlação do navegador,
PKCE e armazenamento Redis por cinco minutos. O callback consome o estado uma
única vez, valida o provedor e usa URLs fixas; não aceita redirecionamento externo
arbitrário. A chamada ao provedor tem timeout de dez segundos. Tokens externos
não são persistidos, enviados ao frontend ou incluídos em logs.

## MFA e recuperação

1. Em `/seguranca`, confirme a senha e escolha **Configurar MFA**.
2. Cadastre a chave manual no aplicativo autenticador (TOTP, seis dígitos,
   30 segundos) ou use o link para abrir um aplicativo no próprio dispositivo.
3. Confirme um código em até cinco minutos. O MFA só fica ativo após a confirmação.
4. Guarde os oito códigos de recuperação exibidos uma única vez. Cada um tem
   80 bits aleatórios; o banco armazena apenas SHA-256, com consumo atômico.
5. Entre novamente. Ativar ou desativar MFA incrementa `session_version` e revoga
   todas as sessões anteriores, inclusive refresh tokens.

O segredo pendente fica criptografado no Redis e expira em cinco minutos. O
segredo ativo fica criptografado no MySQL com AES-256-GCM e IV aleatório.
A chave manual/URI é retornada intencionalmente apenas durante a configuração
reatenticada; códigos de recuperação são retornados somente na ativação. Não
há endpoint para consultar esses segredos posteriormente. As respostas da API
usam `Cache-Control: private, no-store`.

No login com MFA, o primeiro fator cria apenas um desafio HttpOnly com TTL de
cinco minutos; ele não é aceito nas APIs de negócio. TOTP e recuperação são
validados no servidor. Um passo TOTP já utilizado não pode ser reutilizado,
inclusive entre réplicas; aguarde o próximo código para uma nova ação sensível.

Desativar MFA exige senha e um segundo fator válido. Ao perder o autenticador,
use um código de recuperação para entrar e outro para desativar o MFA. Não há
reset de MFA por administrador, recuperação de senha por e-mail, regeneração
isolada de códigos ou remoção de vínculos OAuth nesta entrega. Sem autenticador
e sem códigos, não há recuperação autônoma implementada.

## Sessões, JWT e renovação

O navegador recebe `nexo-sessao` (JWT) e `nexo-refresh` em cookies HttpOnly,
SameSite=Lax, Path=/ e Secure em HTTPS. Eles não são armazenados no localStorage
nem retornados em JSON. Os endpoints implementados autenticam por esses cookies;
não foi acrescentado um modo de autenticação por cabeçalho Bearer.

O JWT é verificado com algoritmo fixo, assinatura, issuer, audience, expiração e
tipo. Em cada requisição o backend também verifica a família de sessão no Redis
e busca usuário, empresa, perfil e versão no MySQL. Portanto, JWT não torna a
autorização independente do servidor: logout, remoção e alteração de usuário
revogam acesso imediatamente. Indisponibilidade de Redis/MySQL não libera acesso.

O refresh é armazenado apenas por hash como chave Redis. Cada rotação troca o
hash atual da família e mantém o hash anterior até sua expiração para detectar
reuso. Um script Lua torna a comparação e a troca atômicas. Reusar um token
antigo revoga toda a família, incluindo o JWT mais recente. As famílias de
outros dispositivos permanecem válidas, exceto na revogação global por versão.
A validade absoluta da família é sete dias desde o login; renovar não a estende.

O cliente `frontend/lib/api.ts` tenta uma renovação ao receber 401 e repete a
requisição uma única vez. Compartilha a renovação entre chamadas da mesma aba e
usa Web Locks para serializar abas quando disponível. Sem suporte a Web Locks,
renovações simultâneas entre abas podem ser tratadas como reuso e exigir novo
login. SSE e trabalhos já iniciados continuam limitados pelo JWT que os iniciou;
expiração pode encerrar o acompanhamento ou interromper uma importação, mantendo
os registros já persistidos. A consulta de status permite renovar e reconectar.

Logout revoga a família pelo JWT, mesmo expirado, ou pelo refresh e remove o
desafio MFA apresentado. Os cookies são apagados. Cookies legados de sessão opaca
não são aceitos após esta alteração: usuários precisam entrar novamente.

## Abuso, CSRF e permissões

Contadores Redis usam janela fixa iniciada na primeira tentativa. Tentativas
bem-sucedidas também contam; os limites não são zerados pelo login.

| Escopo | Limite |
| --- | --- |
| Login por e-mail normalizado e por ID da conta | 10 tentativas / 15 minutos em cada contador |
| Login, conclusão MFA e ações de segurança, por endereço e categoria | 60 / 15 minutos |
| Cadastro, por endereço | 10 / 15 minutos |
| Refresh, por endereço | 120 / 15 minutos |
| Início OAuth / callback OAuth, por endereço | 30 / 60 respectivamente, em 15 minutos |
| Segundo fator e reautenticação, por conta e categoria | 8 / 5 minutos |

Exceder o limite retorna 429; o callback OAuth redireciona para erro genérico no
login. Identificadores dos contadores são hashes. O limite por ID também cobre
variações de e-mail equivalentes na collation do MySQL. A verificação de senha
faz scrypt mesmo para conta inexistente. Credenciais inválidas não distinguem
conta inexistente, senha incorreta ou perfil divergente.

O servidor usa o endereço da conexão, sem confiar em `X-Forwarded-For` fornecido
pelo cliente. Atrás do rewrite do Next, esse limite de endereço é compartilhado
pelos usuários atendidos pelo mesmo proxy; os limites de e-mail/conta continuam
individuais. Para maior escala, acrescente limitação no proxy de borda e configure
uma cadeia de proxies confiáveis antes de usar IP encaminhado. CAPTCHA e defesa
contra DDoS volumétrico não foram implementados.

Todas as escritas de autenticação exigem `Origin` exatamente igual a
`FRONTEND_ORIGIN`, inclusive refresh e vinculação. Callbacks OAuth são GET e usam
state/PKCE/correlação. Não há CORS aberto. O filtro global evita registrar objetos
brutos de erros de drivers, que podem conter SQL e segredos. A API também envia
`Referrer-Policy: no-referrer` e `X-Content-Type-Options: nosniff`.

As permissões de Administrador/Gestor/Operador estão na tabela do
[README](../README.md#funcionalidades-e-permissões) e continuam verificadas nos
serviços. Nenhum perfil, inclusive Administrador, ultrapassa a própria empresa.

## Endpoints

Prefixo `/api`. Senha, código e dados de cadastro são recebidos em JSON.

| Método | Rota | Contrato principal |
| --- | --- | --- |
| POST | `/sessao` | `{email, senha, perfil?}`; retorna sessão ou `{mfaRequired:true}` |
| POST | `/sessao/mfa` | `{codigo}` e cookie do desafio; emite sessão após o segundo fator |
| POST | `/sessao/refresh` | Cookie de refresh; retorna `{ok:true}` e troca cookies |
| DELETE | `/sessao` | Revoga a família e apaga cookies |
| POST | `/cadastro` | Cadastro de empresa/administrador com limite por endereço |
| GET | `/seguranca` | Sessão completa; retorna estado MFA e nomes dos provedores vinculados |
| POST | `/seguranca/mfa/configurar` | `{senha}`; retorna chave manual e URI temporárias |
| POST | `/seguranca/mfa/ativar` | `{codigo}`; retorna códigos de recuperação, revoga sessões |
| DELETE | `/seguranca/mfa` | `{senha,codigo}`; desativa e revoga sessões |
| GET | `/oauth/providers` | Disponibilidade de Google/GitHub, sem credenciais |
| GET | `/oauth/:provider` | Inicia login com redirecionamento ao provedor |
| POST | `/oauth/:provider/vincular` | `{senha,codigo?}` e sessão; retorna URL de autorização |
| GET | `/oauth/:provider/callback` | Consome state/code, vincula ou inicia sessão/desafio MFA |

## Persistência e manutenção

A migração `backend/drizzle/0001_chemical_red_wolf.sql` adiciona `mfa_secret`,
`mfa_last_step`, `recovery_hashes` a usuários e cria `identidades_oauth`, com
unicidade e exclusão em cascata ao remover o usuário. Snapshot e journal Drizzle
foram atualizados. As migrações são aplicadas ao iniciar o backend.

Rotacionar JWT_SECRET invalida os JWTs existentes; refresh tokens continuam
podendo emitir novos JWTs. Para revogar todas as sessões de uma conta,
incremente sua versão pela operação de gestão existente. Trocar AUTH_NAMESPACE
abandona as sessões e contadores do prefixo anterior. Perder/trocar
MFA_ENCRYPTION_KEY sem recriptografar os segredos impede a validação TOTP existente;
não há rotação de chave com múltiplas versões implementada.

Arquivos principais: `server/auth.ts` (sessões/MFA), `server/oauth.ts` (provedores),
`server/security.ts` (criptografia/limites), `app.controller.ts` (HTTP/cookies),
`security.filter.ts` (erros), repositório MySQL e telas de login/segurança.
As dependências JWT/TOTP/OIDC são `jsonwebtoken`, `otpauth` e `jose`.

## Validação executada em 21/09/2026

- `npm test`: 19 testes aprovados, incluindo autenticação HTTP com NestJS,
  JWT, refresh, TOTP, recuperação e OAuth com provedores simulados.
- `npm run typecheck` e `npm run build`: aprovados, incluindo a nova rota
  `/seguranca` no build Next.js.
- `npm run test:services --workspace backend`: 22 testes aprovados com MySQL e
  Redis reais. Abrange migração, persistência, isolamento, papéis, consumo
  concorrente de recuperação, antirreplay TOTP e rotação concorrente de refresh.
- `npm run test:integration --workspace backend`: aprovado com processo NestJS
  real, incluindo MFA, renovação, reuso/revogação, CRUD e isolamento por empresa.
- `git diff --check` e conferência dos links locais: aprovados.
- `npm audit --omit=dev`: nenhuma vulnerabilidade reportada. O `npm audit`
  completo ainda reporta quatro alertas moderados na cadeia de desenvolvimento
  `drizzle-kit` / `@esbuild-kit` / `esbuild`; não foi aplicado o downgrade
  incompatível sugerido automaticamente pelo npm.

A auditoria inicial identificou versões vulneráveis de Drizzle ORM, Multer e
PostCSS. O backend foi alinhado ao Drizzle ORM 0.45.2 já usado na raiz; overrides
compatíveis selecionam Multer 2.4.0 e PostCSS 8.5.28. Os overrides existem na raiz
e nos respectivos workspaces para cobrir também os builds Docker independentes.
O lockfile da raiz foi atualizado e as suítes foram repetidas após as correções.

Os testes de serviços e integração foram executados pelo host, conectando-se aos
containers existentes em portas locais, com bancos MySQL temporários
`nexo_test_*` e Redis lógico 1. Cada fixture usa um prefixo Redis próprio, removido
no encerramento; não limpa chaves de outros ambientes nem altera os dados da
aplicação. Para repetir, configure `MYSQL_TEST_URL` com uma conta capaz de criar
bancos de teste e `REDIS_URL` apontando para a instância/banco de testes, e execute
os scripts acima. As fixtures fornecem chaves exclusivas de teste se ausentes.

Não foram executados nesta etapa o comando `npm run docker:test`, o teste
`npm run test:http` pelo frontend ou validação visual no navegador. Os containers
da aplicação não foram reconstruídos. Não houve login real no Google/GitHub:
os testes exercitam os protocolos com respostas simuladas e assinaturas de
chaves de teste. Credenciais reais, consentimento e callbacks registrados devem
ser configurados para a validação ponta a ponta com esses provedores.
