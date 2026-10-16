# Preenchimento automático por CEP

Correção de 16/10/2026: na Simulação de frete, abra **Buscar cidade por CEP
ou UF**, escolha Origem ou Destino e informe oito dígitos, com ou sem hífen.
Após 350 ms sem edição, a consulta autenticada ao backend aplica cidade/UF
ao campo escolhido e sincroniza o município e a UF exibidos. A distância
continua manual. Endereços não encontrados ou serviços indisponíveis exibem
mensagem e permitem tentar novamente.

As expressões regulares de normalização e validação do frontend tinham barras
invertidas duplicadas, impedindo a consulta. Elas foram corrigidas. A versão
Git publicada também passa a incluir o componente de consulta automática que
já estava presente na cópia local. Consultas anteriores são canceladas ao
editar o CEP ou mudar o campo; erros de CEP e IBGE têm estados independentes.

Validação: `npm test` (29 testes) e `npm run typecheck` passaram na cópia de
trabalho. Playwright/Chrome, com APIs simuladas, verificou CEP incompleto sem
consulta, CEP com e sem hífen e preenchimento de Origem e Destino, sem erros
JavaScript. O primeiro roteiro usou o nome incompleto do campo Destino e
expirou; foi corrigido para o rótulo real antes de passar. Não foi exercitada
uma consulta autenticada real ao ViaCEP.

`npm run build` passou também na worktree isolada de publicação, com avisos
preexistentes do Autoprefixer sobre `start`/`end` no CSS.
