# Arquitetura do backend

O backend segue uma separação simples por responsabilidades, preservando o
fluxo existente:

```text
HTTP/NestJS Controller
  -> DTO e validação de transporte
  -> caso de uso/serviço em server/
  -> contrato de repositório em domain/
  -> implementação Drizzle/MySQL em infrastructure/
```

## Camadas

| Camada | Responsabilidade | Exemplos |
| --- | --- | --- |
| Controllers | Rotas, status HTTP, cookies, headers e redirecionamentos | `app.controller.ts`, `gestao.controller.ts` |
| DTOs | Formato e validação dos corpos recebidos pelo HTTP | `src/application/dtos/auth.dto.ts` |
| Decorators | Extração de dados de transporte reutilizáveis | `src/http/decorators/client-ip.decorator.ts` |
| Casos de uso/serviços | Regras de negócio, autorização, multi-tenant e orquestração | `server/auth.ts`, `server/gestao.ts`, `server/cadastro.ts` |
| Domain | Contratos independentes de banco e tipos persistidos | `src/domain/repositories.ts` |
| Infrastructure | Drizzle, MySQL, Redis e integrações externas | `src/infrastructure/` |
| Presenters | Formato das respostas públicas sem expor tokens internos | `src/application/presenters/auth.presenter.ts` |
| Tratamento de erros | Conversão de exceções para respostas HTTP seguras | `security.filter.ts` |

## Regras de dependência

- Controllers não acessam Drizzle, Redis ou tabelas diretamente.
- DTOs validam apenas o contrato de entrada; regras de negócio permanecem nos
  serviços e casos de uso.
- Os serviços recebem `Sessao` obtida no servidor e nunca autorizam por
  `tenant_id` enviado pelo navegador.
- O domínio depende de interfaces de repositório, enquanto a infraestrutura
  implementa essas interfaces.
- Presenters não incluem senha, hash, cookie, refresh token, segredo MFA ou
  credencial OAuth em respostas.
- O filtro global não expõe detalhes de drivers ou SQL em erros 5xx.

## Decisões e limites

Os serviços em `server/` exercem o papel de casos de uso sem uma hierarquia de
classes adicional. Essa escolha mantém o projeto pequeno e deixa as regras
testáveis com repositórios simulados ou reais. Uma evolução futura pode separar
cada caso de uso em arquivos próprios caso o número de fluxos cresça; não há
necessidade de criar abstrações vazias para os fluxos atuais.

As validações de domínio de clientes, usuários, transportadoras e simulações
continuam no serviço de gestão, porque dependem de permissões, existência de
registros e isolamento por empresa. As validações dos corpos de autenticação
foram extraídas para DTOs, pois são específicas do transporte HTTP.