# Uso de IA e contexto de desenvolvimento

## Processo utilizado

O projeto foi desenvolvido com auxílio do Codex, utilizando como referência
o documento `desafio_tecnico_logistica.pdf`. Conforme o relato do autor, ele
selecionava partes dos requisitos desse documento e solicitava auxílio ao
Codex para implementá-las no projeto `desafio_logistica1`. O desenvolvimento
avançou dessa forma, por etapas, trabalhando cada parte do desafio.

Este relato está registrado na pasta `docs/`; a implementação da aplicação
fica nas pastas `frontend/` e `backend/`.

Este documento foi elaborado com auxílio do Codex após a implementação, para
registrar esse processo e organizar os artefatos de apoio disponíveis no
repositório. Não constitui uma transcrição das conversas nem uma reconstrução
completa do histórico de desenvolvimento.

O relato disponível não detalha quais sugestões foram aceitas ou modificadas,
nem quais verificações foram executadas em cada etapa. Por isso, não são
atribuídas decisões específicas ao autor ou à ferramenta sem esse registro.
As decisões técnicas e os limites descritos atualmente estão no
[README](../README.md).

## Artefatos disponíveis

| Artefato | Finalidade e origem |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Regras de projeto e fluxo de trabalho para próximas alterações assistidas por IA. Criado nesta etapa de documentação, após a implementação. |
| [README.md](../README.md) | Documentação técnica já existente, com execução, arquitetura, decisões, testes e limites. Recebeu um link para este registro. |
| Este documento | Registro retrospectivo do uso de IA, baseado no relato do autor e na inspeção local. |

Na inspeção realizada para preparar este registro, as pastas `.agents/` e
`.codex/` estavam vazias e ignoradas pelo `.gitignore`. Não havia artefatos
nessas pastas para incluir. Não foi encontrada uma pasta `.cloud/` na raiz do
projeto. Essas observações descrevem o estado local inspecionado; não comprovam
quais configurações ou ferramentas foram utilizadas em sessões anteriores.

Não foram identificadas skills personalizadas ou configurações de agentes
dentro dessas pastas. Recursos globais da instalação do Codex não foram
copiados para o repositório. Durante esta etapa de documentação, foi consultada
a skill `openai-docs` disponível no ambiente e a
[documentação oficial de AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
Isso não implica que essa skill tenha sido utilizada na implementação anterior.

## Manutenção dos artefatos

Nas próximas alterações, preserve as instruções, skills, workflows e
configurações de projeto que forem efetivamente utilizados. Caso sejam
adicionados em `.agents/` ou `.codex/`, ajuste o `.gitignore` para permitir
o versionamento dos arquivos relevantes, revisando seu conteúdo antes de
incluí-los. Se uma pasta `.cloud/` passar a ser utilizada no desenvolvimento,
preserve seus artefatos no repositório conforme solicitado pelo desafio.

Não inclua senhas, tokens, arquivos de autenticação ou o `.env` local nesses
registros. Exemplos de configuração devem usar valores de demonstração.

## Verificação e limites deste registro

Os comandos de teste estão documentados no README e definidos nos arquivos
`package.json`. A existência desses comandos não é evidência de que tenham
sido executados em todas as etapas anteriores.

A preparação destes artefatos altera apenas a documentação e as instruções de
trabalho. Ela não representa uma auditoria completa dos requisitos do desafio,
nem uma declaração de que todas as funcionalidades exigidas estão concluídas.

## Continuidade: histórico, dashboard e insights

Nesta alteração, solicitada após o registro retrospectivo acima, o Codex
inspecionou o README e a implementação existente. O histórico já persistia
snapshots das simulações; sua busca foi ampliada para cliente e responsável.
O painel demonstrativo foi substituído por indicadores calculados do histórico,
e foram implementadas regras automáticas de cubagem, concentração e variação.
As regras, os indicadores e os limites estão descritos no README.

Foram acrescentados testes unitários de indicadores e insights e ajustadas as
verificações existentes para o novo painel. `npm test`, `npm run typecheck` e `npm run build` foram executados com
sucesso. Os links locais do README e deste documento foram conferidos.
Este registro descreve esta etapa, sem atribuir essas ações ao desenvolvimento
anterior. Os insights do produto usam regras determinísticas, sem chamadas a IA.

A suíte Docker foi concluída com seis testes aprovados e integração NestJS
aprovada, usando `docker compose -f compose.yaml -f compose.build-host.yaml
--profile test run --build --rm tests`. A tentativa padrão foi interrompida
porque a instalação de dependências não avançava. A validação revelou também
que o seed não reconhecia duplicidades encapsuladas pelo Drizzle; esse tratamento
foi corrigido, e a conexão de preparação do teste passou a fechar em `finally`.
Após a correção, `npm test` e a suíte Docker foram repetidos com sucesso.
Não foi executado `npm run test:http` pelo frontend nem validação visual no navegador.

## Continuidade: integrações, importação e tempo real

Nesta etapa, o usuário solicitou duas APIs externas, upload de arquivos,
processamento assíncrono e comunicação em tempo real. O Codex inspecionou o
README e os arquivos envolvidos, preservando as alterações locais existentes.
Foram consultadas as documentações oficiais do ViaCEP e do IBGE Localidades.
Não foram usados subagentes nesta etapa.

Foram implementadas consultas de CEP e municípios na simulação, upload CSV de
clientes, executor assíncrono em memória e acompanhamento por SSE. Os arquivos
novos, endpoints, formato aceito e limites estão descritos em
[Integrações e importações](integracoes-e-importacoes.md). A opção por CSV atende
ao formato de exemplo do requisito; XLSX não foi implementado. A fila durável
e a retomada após reinício também não foram implementadas.

Verificações realizadas nesta etapa:

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado para backend e frontend.
- `npm test`: 11 testes aprovados, incluindo HTTP multipart e SSE com NestJS
  real e serviços substituídos em memória. A primeira execução HTTP foi
  bloqueada pela restrição de abertura de porta do sandbox; a execução com
  permissão ampliada revelou um limite incorreto de partes multipart, corrigido
  antes da repetição aprovada da suíte.
- `git diff --check` e conferência dos links locais da documentação: aprovados.
- Consultas reais pelos serviços implementados: ViaCEP retornou São Paulo/SP
  para `01001000`; IBGE retornou 645 municípios de SP. O acesso inicial foi
  bloqueado pela rede restrita; a repetição com permissão ampliada funcionou.

Não foram executados a suíte Docker, o teste HTTP com MySQL/Redis reais ou
validação visual no navegador nesta etapa. Resultados de etapas anteriores
permanecem registrados nas seções anteriores, sem serem atribuídos a estas
novas funcionalidades.

## Verificação dos requisitos em 17/09/2026

A pedido do usuário, o Codex conferiu integrações externas, upload CSV,
processamento assíncrono e SSE no código e executou as seguintes verificações:

- `npm test`: 11 testes aprovados. Upload HTTP e SSE usam NestJS real com
  sessão e persistência substituídas em memória.
- `npm run typecheck`: aprovado.
- Consultas reais usando `criarIntegracoes`: ViaCEP retornou São Paulo/SP
  para `01001000`; IBGE retornou 645 municípios de SP.
- `/api/health`: HTTP 200 nas portas locais 3000 e 3002.
- `/modelo-clientes.csv`: HTTP 200 na porta 3000, mas HTTP 404 na porta 3002,
  publicada pelo frontend Docker em execução.
- `npm run test:http`: falhou no login da conta de demonstração, com HTTP 401,
  tanto na porta 3000 quanto na 3002 (esta com `NEXO_TEST_URL` e
  `NEXO_TEST_ORIGIN` ajustados). O restante desse teste não foi executado;
  não foi determinada a causa da rejeição das credenciais de demonstração.

Não foram alterados usuários, executado seed ou reconstruídos containers.
Não houve validação visual nem importação ponta a ponta com MySQL/Redis reais
nesta verificação. Os resultados confirmam os testes do código local, mas não
atestam todos os fluxos das versões em execução.
