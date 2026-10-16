# Notificações no sino com Redis Streams

Implementado em 16/10/2026, após o usuário esclarecer que desejava os avisos
no sino do dashboard. A escolha foi Redis Streams, aproveitando o Redis já
utilizado pelo backend. Não foi necessário hospedar Kafka nem um worker novo.

## Fluxo implementado

Após salvar ou excluir uma simulação, o controller publica um evento interno.
O processamento de CSV publica sua conclusão ou falha. O serviço gera títulos
e descrições fixos, sem incluir dados do CSV, credenciais, cookies ou tokens.
O repositório usa XADD para publicar em um Stream separado por empresa.
A publicação, o limite de tamanho e a expiração são aplicados em Lua.

GET /api/notificacoes consome os eventos recentes da empresa da sessão.
POST /api/notificacoes/lidas recebe apenas o ID limite de leitura. O backend
identifica empresa e usuário pela sessão e verifica a origem nas escritas.
Cada usuário possui seu próprio cursor: ler um aviso não o marca para colegas.
Uma confirmação antiga não faz o cursor retroceder. IDs de outra empresa ou
não presentes no Stream são rejeitados. Todos os perfis autenticados podem
consultar e marcar os próprios avisos como lidos.

O frontend mostra contador de não lidas, painel com data e descrição, estados
vazio/erro, atualização manual e ação Marcar como lidas. Atualiza ao abrir o
sino e a cada 20 segundos enquanto a aba está visível. Escape e clique externo
fecham o painel. O layout foi conferido em desktop e 390 px.

## Retenção e limites

São mantidos até 100 eventos por empresa. Eventos com mais de sete dias não
são exibidos e são removidos do Stream na próxima publicação; chaves inativas
expiram. O cursor de leitura expira após sete dias. AUTH_NAMESPACE separa os
ambientes, com hash tags para manter operações Lua compatíveis com Cluster.
A persistência após falha do servidor Redis depende da configuração do provedor;
o Compose já usa AOF. Redis Streams armazena os avisos, mas não substitui MySQL.

Este é um fluxo de eventos de notificação, com consumo pelo painel e cursor
individual. Não é uma fila de tarefas com workers, tentativas ou processamento
exatamente uma vez. A importação de CSV mantém o executor existente; waitUntil
preserva sua execução após a resposta na Vercel, dentro dos limites da Function.
Os jobs CSV não foram migrados para uma fila durável nesta alteração.

A transação MySQL e a publicação Redis não são atômicas. Se o processo parar
entre elas ou o Redis rejeitar a publicação, o aviso pode não ser gravado.
Uma falha no aviso não desfaz o frete já salvo/excluído nem faz a API retornar
uma falha que poderia levar à repetição da operação. É registrado apenas um
erro genérico. Garantia de entrega entre os dois bancos exigiria um outbox
transacional e um mecanismo de reentrega, fora do escopo desta implementação.
Notificações anteriores à publicação não são geradas retroativamente.

## Verificação

`npm test` aprovou 34 testes, incluindo os novos testes de serviço e HTTP:
autenticação, origem, validação, isolamento por empresa, leitura individual e
publicação somente após sucesso no frete ou conclusão/falha da importação.
`npm run typecheck` passou na cópia de trabalho e na versão preparada.
`npm run build` passou; uma tentativa intermediária falhou por ausência de
@vercel/functions na base publicada, resolvida adicionando a dependência e
atualizando o lockfile. Não houve mudança de schema.

Teste com Redis 7.4 real em container isolado aprovou publicação/consumo entre
adaptadores, leitura individual, cursor monotônico, limite de 100 e expiração.
Para repeti-lo com Redis de teste (nunca use um namespace de produção):

```bash
npm run build --workspace backend
REDIS_TEST_URL=redis://127.0.0.1:6379 node --test backend/dist/tests/notificacoes-redis.test.js
```

O teste gera um namespace aleatório e remove apenas suas chaves. Sem
REDIS_TEST_URL, esse teste é explicitamente ignorado.

Um roteiro Playwright também validou navegador → API NestJS → Redis real,
com painel e autenticação simulados: badge, abertura, leitura persistida por
usuário, nova mensagem, segunda empresa sem acesso e painel móvel. As capturas
foram inspecionadas. Não foi criada nem excluída simulação real para testar.

Referências: [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
e [mensageria com Redis](https://redis.io/docs/latest/develop/use-cases/streaming/).

O roteiro de apoio está em [notificacoes-browser.cjs](evidencias/notificacoes-browser.cjs).
Ele requer Playwright disponível (ou PLAYWRIGHT_MODULE apontando para o módulo),
Redis de teste em REDIS_TEST_URL e frontend local em BASE_URL. As capturas de
[desktop](evidencias/notificacoes-desktop.png) e
[celular](evidencias/notificacoes-mobile.png) usam dados fictícios.
Também foram validados publicação, leitura e cursor no provedor Redis remoto,
usando namespace temporário exclusivo e removendo suas chaves ao final.
A cópia de trabalho passou em seus 33 testes; a base de publicação passou em 34
por incluir também testes de startup que diferem entre as branches.
