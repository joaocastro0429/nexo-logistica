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

## Excluir simulação e atualizar o dashboard

Administradores e Gestores podem abrir um resultado no Histórico, clicar em
**Excluir simulação** e confirmar. A exclusão é permanente. Cancelar mantém o
registro; falhas exibem mensagem e não removem o item localmente. Operadores
continuam com permissão de consulta e simulação, sem permissão para excluir.

`DELETE /api/simulacoes/:id` exige sessão, origem autorizada e perfil permitido.
O repositório exclui usando simultaneamente o ID da simulação e a empresa da
sessão. IDs inexistentes ou de outra empresa retornam 404. Não há mudança de
schema. A exclusão funciona mesmo quando a transportadora já foi removida.

Ao retornar à Visão geral, os indicadores são consultados novamente e calculados
sobre o histórico restante. Excluir uma transportadora continua preservando
simulações; a remoção de um cadastro não apaga automaticamente seu histórico.

Validação: `npm test` passou (31 testes), `npm run typecheck` e `npm run build`
passaram. O teste novo cobre Operador bloqueado, empresa isolada, ID inválido,
404, exclusão por Administrador/Gestor e painel vazio após excluir. Após reforçar
a asserção do painel anterior, os dois testes de frete foram executados novamente
e passaram. Playwright/Chrome com APIs simuladas verificou cancelamento,
falha sem exclusão, confirmação, painel recarregado e ausência de botão para
Operador. Não foi excluída nenhuma simulação real de produção nos testes.

## Aparência do botão de exclusão

Em 16/10/2026, o botão Excluir simulação recebeu ícone de lixeira, borda e
fundo vermelho suave, cantos arredondados e estados de hover/foco/desabilitado.
Tem altura mínima de 44 px e largura total em telas até 480 px. A confirmação
e as permissões permanecem as mesmas. O build completo passou. O botão foi
inspecionado em capturas desktop e 390 px; o fluxo com APIs simuladas passou.
A primeira captura móvel pegou a transição do menu lateral após redimensionar;
o roteiro foi ajustado para aguardar a transição e restaurar a largura desktop
antes de continuar a navegação. Não houve exclusão real em produção.

Em novo ajuste visual de 16/10/2026, Atualizar histórico recebeu fundo verde
escuro e ícone de atualização; Limpar busca recebeu fundo verde claro e ícone X.
Ambos possuem cantos arredondados, área mínima de 44 px, foco visível e largura
total no celular. O build passou e as capturas desktop/390 px foram conferidas.
A busca e Limpar busca passaram no navegador com APIs simuladas.
