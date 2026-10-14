# Correção MySQL na Vercel — 14/10/2026

O deployment de produção baseado em f862602 passava DATABASE_URL diretamente
ao MySQL2, que ignora ssl-mode. As variáveis MYSQL_SSL e MYSQL_SSL_CA existentes
no projeto não eram usadas. A inicialização também executava migrações em cada
instância. Capturas mostraram o aviso de ssl-mode e HTTP 500; o MySQL foi religado
pelo usuário e a falha continuou. Não foi possível ler os logs de execução pelo
plugin, pois a consulta retornou 403.

A aplicação e o comando de migração agora usam a mesma configuração MySQL:
URL decomposta em campos, credenciais decodificadas e TLS com validação do CA e
do hostname. MYSQL_SSL_CA aceita PEM com quebras reais ou com caracteres \\n.
O parâmetro ssl-mode=REQUIRED é interpretado antes de chamar o driver.
Na Vercel, o pool fica limitado a duas conexões por instância; isso não limita
o total de conexões de todas as instâncias.

As migrações permanecem automáticas fora da Vercel, mas devem ser aplicadas
separadamente antes de publicar na Vercel. Este ajuste não acrescenta migrações
nem altera o schema. Configure DATABASE_URL, MYSQL_SSL=true e MYSQL_SSL_CA no
ambiente do comando e execute npm run migrate --workspace backend a partir
da raiz, se houver migrações pendentes. Não executar seed em produção.

Falhas de inicialização registram startup_failed com etapa, código permitido
e nomes de variáveis ausentes. Não registram URLs, mensagens de drivers ou
segredos. REDIS_URL, JWT_SECRET e MFA_ENCRYPTION_KEY continuam obrigatórios.
FRONTEND_ORIGIN deve coincidir com o domínio acessado, sem barra final.

Validação local: npm test compilou o backend e aprovou 30 testes, incluindo
configuração TLS e diagnóstico sem exposição de segredos. As dependências
vieram do ZIP fornecido pelo usuário; não houve instalação limpa pelo lockfile.
Nenhuma conexão autenticada ao banco, migração, seed ou login real foi executado.
O build do deployment e o acesso ao banco em produção precisam ser verificados.

Depois de publicar, verificar /api/health na API e pelo frontend, carregar
/api/oauth/providers e testar login/logout. Sucesso no build não comprova que
as credenciais, certificado ou serviços remotos estejam disponíveis.
