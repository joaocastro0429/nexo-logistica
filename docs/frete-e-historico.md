# Transportadora no frete e histórico

Ajuste de 16/10/2026 solicitado pelo usuário.

Na Simulação de frete, **Buscar transportadora por nome** filtra as
transportadoras cadastradas na empresa autenticada. O nome completo, quando
identifica um único cadastro, seleciona-o automaticamente, ignorando acentos,
maiúsculas e espaços nas extremidades. Para nomes parciais ou duplicados,
selecione a opção desejada na lista. O formulário mostra e-mail, telefone,
taxa base, preço por kg e preço por km do cadastro. Editar a busca limpa uma
seleção anterior e seu resultado. Nenhuma tarifa é enviada para substituir
os valores do servidor: o backend continua consultando o cadastro pelo ID
e pela empresa da sessão para calcular o frete.

O histórico lista simulações já salvas; não é preenchido manualmente.
Após clicar em **Simular e salvar no histórico** e receber a confirmação,
acesse Histórico. **Atualizar histórico** permite recarregar e tentar novamente
após uma falha. Os estados sem simulações, sem resultados de busca e falha
na consulta agora possuem mensagens distintas.

Uma consulta somente de leitura ao banco indicado pela configuração local de
produção encontrou zero simulações nesta etapa. Não foram alterados dados
reais nem criados registros de demonstração para preencher a lista.

Validação: `npm run typecheck` e `npm run build` passaram na worktree isolada.
Playwright com Chrome e APIs simuladas validou histórico vazio, seleção por
nome sem acento, exibição dos dados cadastrados, envio apenas do ID da
transportadora, gravação simulada, exibição do resultado no histórico, erro
de consulta e recuperação pelo botão de atualização. Não houve erro JavaScript.
O primeiro roteiro expirou ao buscar o select pelo rótulo exato; o seletor foi
corrigido antes da execução aprovada. Não foi criada simulação real em produção.

## Busca no histórico — 16/10/2026

Após novo relato do usuário, uma consulta somente de leitura confirmou uma
simulação salva e o nome da transportadora presente no snapshot, igual ao
cadastro atual. O texto exato digitado pelo usuário não foi fornecido; não
foi possível reproduzir sua consulta autenticada.

Foram corrigidas limitações identificadas no filtro: agora ignora acentos,
maiúsculas, espaços repetidos e separadores, e aceita palavras em qualquer
ordem. Também pesquisa data local no formato brasileiro e código da simulação.
O nome da transportadora aparece diretamente no resumo de cada resultado.
Uma busca sem correspondências oferece **Limpar busca** para voltar à lista.
Nenhuma consulta ou permissão de empresa foi alterada.

Validação desta correção: `npm run typecheck` e `npm run build` aprovados.
O build foi repetido após incluir o nome no resumo. Playwright/Chrome com APIs
simuladas aprovou busca por transportadora sem acentos, espaços extras,
termos em outra ordem, data, código e recuperação da lista por Limpar busca.
O primeiro roteiro tinha snapshot fictício incompleto e foi corrigido para
incluir os valores exigidos por Resultado antes da execução aprovada.
Não foi exercitada a sessão autenticada real do usuário.
