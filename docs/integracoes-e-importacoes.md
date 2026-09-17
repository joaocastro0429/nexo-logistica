# Integrações, importação assíncrona e tempo real

## O que foi implementado

| Requisito | Implementação | Onde usar |
| --- | --- | --- |
| Duas APIs externas | ViaCEP para cidade/endereço por CEP; IBGE para municípios por UF | Simulação de frete → Buscar cidade por CEP ou UF |
| Upload de arquivos | CSV de clientes, enviado como multipart/form-data | Menu Importações, disponível para Administrador e Gestor |
| Processamento assíncrono | Cadastro dos registros em segundo plano após resposta HTTP 202 | Importação de clientes |
| Comunicação em tempo real | Server-Sent Events (SSE) envia estado, contagens e erros | Acompanhamento da importação |

## Integrações externas

O navegador consulta endpoints autenticados do NestJS. O backend chama apenas
URLs fixas de [ViaCEP](https://viacep.com.br/) e
[IBGE Localidades](https://servicodados.ibge.gov.br/api/docs/localidades).
Não são necessárias chaves de API ou dependências novas. O servidor precisa
conseguir acessar esses dois domínios por HTTPS.

A consulta de CEP exige oito dígitos; o formulário remove a máscara. Uma UF deve
estar na lista das 27 siglas brasileiras. Cada chamada tem timeout de oito
segundos, não segue redirecionamentos e valida a estrutura da resposta.
CEP inexistente retorna 404; entrada inválida, 400; falha do provedor, 502.
O backend retorna somente os campos necessários. Não há cache ou retentativas
automáticas das APIs externas nesta versão.

Escolha Origem ou Destino e consulte um CEP ou carregue os municípios de uma UF.
A cidade selecionada preenche o campo correspondente como `cidade/UF`.
O endereço do ViaCEP é exibido para conferência, mas não é persistido como
endereço do cliente. A distância permanece manual: não foi implementado cálculo
de rotas. Se o provedor estiver indisponível, o preenchimento manual continua
possível. Essas APIs não recebem a sessão, credenciais ou o CSV da empresa.

## Arquivo aceito e importação

Use o [modelo CSV](../frontend/public/modelo-clientes.csv), também disponível
para download na tela. O Dockerfile do frontend copia a pasta `public` para
que o download funcione na imagem de produção.

```csv
nome,email,telefone,documento
Cliente Exemplo,cliente@example.com,11999990000,12345678000100
```

- Formato implementado: CSV UTF-8, com ou sem BOM. XLSX não foi implementado.
- Separador: vírgula ou ponto e vírgula, identificado pelo cabeçalho.
- `nome` e `email` são obrigatórios; `telefone` e `documento` são opcionais.
- Cabeçalhos devem ter esses nomes exatos, sem repetição; colunas extras são rejeitadas.
- Suporta CRLF/LF, campos entre aspas, aspas escapadas (`""`) e campos multilinha.
- Limites: um arquivo de até 256 KiB (262.144 bytes), com até 500 registros.
- Linhas vazias são ignoradas. O número exibido nos erros é a posição lógica
  do registro contando o cabeçalho como 1; campos multilinha não alteram essa contagem.
- O conteúdo é validado, independentemente do MIME declarado pelo navegador.
  Arquivos com extensão diferente de `.csv`, bytes UTF-8 inválidos, bytes NUL,
  aspas malformadas ou quantidade incorreta de colunas são rejeitados.

Após validar a estrutura, o servidor devolve `202 Accepted` com um ID e o estado
`aguardando`. Uma tarefa agendada com `setImmediate` passa a `processando` e usa
o serviço de cadastros existente para validar e salvar cada cliente no MySQL.
O processamento de cada registro usa operações assíncronas de sessão e banco;
o cliente HTTP não precisa aguardar todos os inserts. O parsing limitado do
arquivo ocorre antes da resposta, no mesmo processo Node.

Erros de validação de negócio são registrados por linha e o processamento
continua. `concluida` significa que todas as linhas foram avaliadas, podendo
haver rejeições. Falhas de infraestrutura ou sessão revogada mudam o estado para
`falhou` e interrompem as linhas restantes. Detalhes internos de exceções não
são enviados ao navegador.

Cada cadastro válido é persistido individualmente. Não existe transação para
todo o arquivo, deduplicação nem retentativa automática. Reenviar um CSV cria
novos cadastros, inclusive quando há e-mails repetidos, seguindo o comportamento
atual do cadastro de clientes. Confira os clientes e os erros antes de reenviar.

## Segurança e isolamento

O tenant vem exclusivamente da sessão autenticada no servidor. O upload exige
origem autorizada e perfil Administrador ou Gestor. Campos de tenant ou perfil
não são aceitos no CSV. A sessão e o perfil são revalidados antes de cada linha.
Revogar a sessão impede a continuação; um insert já iniciado pode terminar.

Status e SSE exigem sessão válida e empresa correspondente ao trabalho.
Uma empresa diferente recebe 404 mesmo que conheça o ID. Todos os perfis da
mesma empresa podem consultar um ID autorizado, mas o menu de upload fica
restrito a quem pode cadastrar clientes. A conexão SSE revalida a sessão antes
de cada envio e encerra quando ela deixa de ser válida.

## Atualização em tempo real

O frontend abre uma conexão `EventSource` autenticada pelo cookie HttpOnly.
O backend envia imediatamente o estado atual e, enquanto o trabalho está ativo,
envia uma nova fotografia a cada 500 ms pela mesma conexão HTTP. Não se trata
de novas consultas HTTP periódicas feitas pelo navegador. Importações pequenas
podem terminar antes da conexão abrir; nesse caso ela recebe o resultado final.

O evento padrão contém o mesmo JSON do endpoint de status. A conexão termina
quando a tarefa conclui ou falha. O evento `encerrado` indica que o acesso não
pode continuar. O frontend mostra perda de conexão, permite reconexão automática
pelo EventSource e oferece consulta manual de status. A conexão é fechada ao
sair da tela. O proxy deve permitir streaming sem buffering; o servidor envia
`X-Accel-Buffering: no` e `Cache-Control: private, no-store`.

## Decisão arquitetural e limites

Foi escolhido um executor em memória no próprio backend para o escopo limitado
de 500 clientes por arquivo. SSE atende ao fluxo unidirecional de progresso sem
adicionar infraestrutura de WebSocket. Os serviços e controllers novos mantêm
a persistência de clientes no repositório MySQL existente. Não houve alteração
de schema, dependências ou necessidade de migração.

Há no máximo uma tarefa ativa por empresa e 100 tarefas retidas por processo.
Trabalhos finalizados com mais de uma hora são removidos ao receber um novo
upload; capacidade esgotada ou tarefa ativa retorna 429. Encerramento normal
aguarda tarefas pendentes antes de fechar o banco.

**O executor não é uma fila durável.** Reinício forçado perde os trabalhos e
seus relatórios em memória, preservando os clientes já gravados. Não há retomada
automática nem histórico persistente de importações. A tela mantém o ID somente
enquanto montada: sair ou recarregar perde o acompanhamento, embora a tarefa
continue enquanto a sessão for válida. Para outra consulta via API, guarde o ID
retornado pelo upload.

A versão pressupõe uma única instância do backend. Múltiplas réplicas exigiriam
fila compartilhada, persistência de status e mecanismo de idempotência, por
exemplo com Redis e workers. Esses itens são evolução desejada, não recursos
já implementados. Os arquivos originais não são arquivados no disco.

## Endpoints

Prefixo `/api`. Todos exigem sessão; o POST também exige origem autorizada.

| Método | Caminho | Resultado |
| --- | --- | --- |
| GET | `/integracoes/cep/:cep` | Cidade, UF, logradouro e bairro |
| GET | `/integracoes/municipios/:uf` | Lista de IDs e nomes de municípios |
| POST | `/importacoes/clientes` | Multipart, campo `arquivo`; retorna 202 e progresso |
| GET | `/importacoes/:id` | Fotografia atual da tarefa da empresa |
| GET | `/importacoes/:id/eventos` | Stream SSE de progresso |

## Como demonstrar

1. Inicie a aplicação conforme o README e entre como Administrador ou Gestor.
2. Na Simulação de frete, abra a busca de cidade, consulte `01001-000` e aplique
   na origem. Carregue municípios de SP e selecione o destino.
3. Em Importações, baixe o modelo, preencha os clientes e envie o arquivo.
4. Acompanhe contagens e erros; abra Clientes para conferir os cadastros salvos.
5. Para demonstrar rejeição parcial, inclua uma linha com e-mail inválido.
6. Para testar isolamento, consulte o ID da tarefa com uma sessão de outra
   empresa: o resultado deve ser 404.

## Verificações automatizadas

`npm test` inclui parsing CSV, limites, isolamento, permissões, processamento
parcial, revogação de sessão e tratamento de falhas das APIs externas. As APIs
externas usam respostas simuladas nos testes para não depender da internet.
O teste HTTP inicializa um NestJS real com serviços de sessão e persistência
substituídos em memória; cobre multipart, origem, permissões, isolamento e SSE.
Ele exige permissão para abrir uma porta temporária de loopback. Essa verificação
não substitui testes contra MySQL/Redis reais nem validação visual no navegador.
