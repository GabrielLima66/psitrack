# SPEC — Fase 6: Evolução mais expressiva e práticas entre sessões

**Status:** proposto
**Base:** `master` @ `8613cc9` + trabalho não commitado — 371 testes
**Etapas:** 24 (evolução), 25 (práticas entre sessões)

> As duas etapas estão no mesmo spec **de propósito**: ambas alteram a mesma tela
> (`EvolucaoSection.tsx`) e a mesma tabela (`prontuario_evolucao`). Separá-las significaria
> alterar duas vezes uma tabela protegida por trigger e mexer duas vezes no mesmo formulário.

---

## 1. Contexto

A evolução hoje aceita três tipos (`sessao`, `contato`, `administrativo`) e um campo de texto.
Na prática isso perde informação em três pontos:

- **Sessão extra não existe como categoria.** Ela vira uma sessão comum e some no meio da
  timeline, mesmo sendo um evento diferente — e com consequência financeira diferente.
- **`contato` não diz com quem.** Contato com a mãe, com a escola e com o psiquiatra são
  registros clinicamente distintos que hoje ficam indistinguíveis sem ler o texto.
- **`administrativo` não diz o motivo.** Mesmo problema.

Somam-se dois incômodos de uso: a timeline não tem busca (achar "o que foi trabalhado sobre o
pai" exige rolar tudo), e a caixa de texto não cresce com o conteúdo — colar um texto longo
deixa a escrita dentro de uma janelinha de quatro linhas.

A segunda etapa cria o que hoje não tem registro nenhum: a **prática combinada entre sessões**.
Ela é proposta no fim da sessão, precisa ser retomada na próxima, e hoje só existe na memória
da psicóloga ou solta dentro do texto da evolução.

### A restrição que molda a Etapa 25

`prontuario_evolucao` é append-only por trigger (I1). Se o *status* da prática ("cumprida",
"não cumprida") morasse nessa tabela, ele nunca poderia ser marcado — a trigger aborta o UPDATE.

Isso não é obstáculo, é o desenho correto aparecendo: **o que foi proposto** é registro clínico
daquela sessão e deve mesmo ser imutável; **como a pessoa se saiu** é informação posterior, que
nasce depois e muda. São dois fatos com ciclos de vida diferentes, e por isso duas tabelas.

### Invariantes herdadas

| # | Invariante |
|---|---|
| I1 | **`prontuario_evolucao` append-only.** ← exercitada aqui |
| I2 | `anotacao_privada` nunca entra em export. |
| I3 | Histórico financeiro nunca é reescrito. |
| I6 | UUID v7; soft delete. |
| I8 | 100% local, sem rede. |
| I9 | Log e diagnóstico nunca contêm conteúdo clínico. |

---

## 2. Decisões desta fase

| # | Decisão | Razão |
|---|---|---|
| D50 | `sessao_extra` é **tipo novo**, não um sinalizador em cima de `sessao`. | O tipo já é o eixo de leitura da timeline e o gatilho da cobrança. Um booleano paralelo criaria dois lugares para responder a mesma pergunta. |
| D51 | Ao salvar uma `sessao_extra` sem sessão vinculada, o app **pergunta se deve gerar cobrança** — reaproveitando o fluxo de sessão retroativa que já existe. | Extra cortesia e extra cobrada são as duas rotinas reais. Escolher uma no código obrigaria a desfazer na mão na outra metade das vezes. |
| D52 | `contatoCom` e `motivoAdministrativo` são **colunas nullable novas**, preenchidas conforme o tipo — não um campo genérico reaproveitado. | Coluna genérica com significado que muda conforme o tipo é o padrão que impede consulta e confunde leitura seis meses depois. |
| D53 | Busca é **só campo de texto, filtrando a timeline no lugar**, sem tela de resultados. | A timeline já é a visualização certa; a busca só precisa reduzi-la. Tela separada obrigaria a inventar um segundo formato para o mesmo conteúdo. |
| D54 | Busca roda **no renderer**, sobre as entradas já carregadas. | `listarEvolucoes` já traz o prontuário inteiro do paciente para a tela. Ir ao main a cada tecla adicionaria latência sem nada em troca. |
| D55 | A **proposta** da prática mora em `prontuario_evolucao` (imutável); o **status** mora em tabela própria (mutável). | Consequência direta de I1 — ver §1. |
| D56 | Retificar uma evolução **herda** `praticaProposta` da original, exatamente como já herda `sessaoId`. | Mesma razão do precedente: sem herança, retificar uma entrada criaria uma segunda prática para a mesma sessão, como criaria uma segunda cobrança. |
| D57 | Status inicial é `pendente`, criado junto com a evolução. Revisão registra `revisadoEm` e observação. | Prática sem status nasceria invisível na aba de pendências, que é justamente o motivo dela existir. |
| D58 | A aba de práticas fica **dentro da ficha**, por paciente. | Decisão do usuário. Registrado o custo: não existe visão de "todas as práticas pendentes do dia" — ver §6. |

---

## 3. Etapa 24 — Evolução mais expressiva

### Schema

```
prontuario_evolucao  (ALTER TABLE — permitido, a trigger bloqueia UPDATE/DELETE de linha, não DDL)
  + contato_com             text  preenchido quando tipo = 'contato'
  + motivo_administrativo   text  preenchido quando tipo = 'administrativo'
  + pratica_proposta        text  Etapa 25 — mesma migration, ver §4
```

`tipo` passa a aceitar `'sessao' | 'sessao_extra' | 'contato' | 'administrativo'` em
`TIPO_VALUES` (`evolucao.ts:7`), no `$type<>` do schema e em `formatarTipoEvolucao`.

### Cobrança da sessão extra

Três pontos, todos existentes, nenhum reescrito:

- `criarEvolucaoComCobranca` (`faturamento.ts:118`) hoje testa `evolucao.tipo !== 'sessao'`.
  Passa a aceitar também `sessao_extra`.
- `criarEvolucaoComSessaoRetroativa` (`faturamento.ts:198`) hoje fixa `tipo: 'sessao'` ao criar a
  entrada. Passa a receber o tipo de quem chamou.
- `EvolucaoSection.handleSalvar` hoje oferece a sessão retroativa quando
  `tipo === 'sessao' && !sessaoIdAtual`. A condição passa a incluir `sessao_extra` (D51), com
  texto adaptado: recusar continua significando "registra sem cobrar".

O motor de cobrança (`decidirCobranca`, contrato vigente, política de falta) **não muda**: a
sessão extra que gera cobrança gera uma sessão de verdade na agenda e é cobrada por ela, como
qualquer outra.

### Busca

Campo de texto no cabeçalho da aba. Filtra `conteudo`, `contatoCom` e `motivoAdministrativo`,
sem acento e sem caixa. A normalização é a mesma regra de `normalizarBusca`
(`repositories/pacientes.ts:11`), duplicada no renderer pela razão já documentada em
`agenda/tempo.ts` (o renderer não importa de `electron/main/**`).

Timeline vazia por filtro mostra "Nenhuma entrada encontrada para *termo*" com ação de limpar —
nunca a mesma mensagem de "nenhuma entrada registrada ainda", que significa outra coisa.

### Caixa de texto que cresce

`Textarea` ganha modo auto-resize (altura mínima preservada, cresce até um teto e então rola),
aplicado no conteúdo da evolução, nas anotações privadas e nos campos narrativos da Fase 5.
Precisa funcionar ao **colar** texto, não só ao digitar — é o caso relatado.

### Critérios de aceite

- [ ] `sessao_extra` aparece na timeline com rótulo próprio, distinguível de `sessao`.
- [ ] Salvar `sessao_extra` sem sessão vinculada pergunta sobre cobrança; aceitar cria sessão e lançamento, recusar grava sem lançamento nenhum.
- [ ] Registrar a mesma sessão extra duas vezes (original + retificação) continua gerando **um** lançamento.
- [ ] `contato` sem `contatoCom` e `administrativo` sem `motivoAdministrativo` são aceitos (campo opcional), mas o campo aparece assim que o tipo é escolhido.
- [ ] Buscar "joão" encontra entrada escrita "João"; buscar termo inexistente mostra o vazio correto.
- [ ] Colar 40 linhas na caixa de evolução expande a caixa sem exigir rolagem interna imediata.
- [ ] Trigger append-only continua ativa após o `ALTER TABLE` (mesma verificação de `SPEC-fase-1.md`).

---

## 4. Etapa 25 — Práticas entre sessões

### Schema

```
prontuario_evolucao
  + pratica_proposta   text   null = nenhuma prática combinada nessa sessão (D55)

pratica_entre_sessoes           status, mutável (D55)
  id
  evolucao_id      único, referencia prontuario_evolucao
  paciente_id      denormalizado, mesmo motivo de lancamento.paciente_id: a aba lista por
                   paciente e não deve depender de join para isso
  status           'pendente' | 'cumprida' | 'parcial' | 'nao_cumprida'   default 'pendente'
  revisado_em      text  ISO-8601 UTC, null enquanto pendente
  observacao       text  como foi na revisão
  created_at, updated_at, deleted_at
```

Índice por `paciente_id + status + deleted_at`.

### Fluxo

1. No formulário de evolução, checkbox **"Combinei uma prática para até a próxima sessão"**.
2. Marcado, abre um textarea para a proposta. Salvar grava `praticaProposta` na evolução e cria
   a linha de status como `pendente` (D57), na mesma transação.
3. Retificar essa evolução herda `praticaProposta` e **não** cria segunda prática (D56).
4. Aba **"Práticas entre sessões"** na ficha: pendentes no topo, revisadas abaixo. Cada item
   mostra a data da sessão de origem, a proposta e o status; revisar abre status + observação.
5. A proposta nunca é editável na aba — corrigi-la é retificar a evolução, como qualquer outro
   conteúdo clínico.

### Nome

Rótulo adotado: **"Práticas entre sessões"**. Considerado e descartado: "Tarefas" (soa
administrativo, colide com a leitura de to-do do app) e "Tarefas de casa" (corrente em TCC, mas
amarra o vocabulário a uma abordagem só, e a ficha registra a abordagem justamente porque ela
varia). Aberto a troca antes da implementação — é só rótulo, não modelo.

### Critérios de aceite

- [ ] Marcar a checkbox e salvar cria a evolução e a prática `pendente` atomicamente; falha em uma não deixa a outra.
- [ ] Não marcar a checkbox não cria linha nenhuma em `pratica_entre_sessoes`.
- [ ] Retificar uma evolução com prática **não** duplica a prática na aba.
- [ ] Marcar como cumprida grava `revisadoEm` e move o item para a seção de revisadas.
- [ ] Desfazer uma revisão volta o item para pendente e limpa `revisadoEm`.
- [ ] Tentativa de UPDATE em `prontuario_evolucao` continua abortando (a proposta é imutável).
- [ ] A aba com zero práticas explica o que ela é, em vez de mostrar lista vazia.

---

## 5. Fora de escopo

Lembrete da prática por WhatsApp (ver §6); prática recorrente ou com repetição; anexar arquivo à
prática; prática visível para a paciente ou exportável como folha de atividade; métrica de
adesão ao longo do tratamento; busca global de evolução entre pacientes.

---

## 6. Correlações registradas

**Prática × mensagens de confirmação (já implementado).** O módulo de mensagens tem template com
placeholders e disparo por WhatsApp. Um placeholder `{pratica}` e um lembrete "combinamos X" são
extensão natural, não feature nova — o custo é quase só de UI. Fora de escopo aqui por decisão de
tamanho, e registrado para não ser redescoberto do zero.

**Práticas sem visão global (D58).** A aba fica na ficha, então não existe "o que está pendente
hoje, de todos os pacientes". Se na prática ela passar a abrir ficha por ficha só para conferir
pendência, isso é o sinal de que a visão global é necessária — e o modelo já suporta
(`paciente_id + status` está indexado exatamente para isso).

**Sessão extra × relatório mensal.** `gerarRelatorioMensal` agrupa por lançamento, não por tipo de
evolução, então a sessão extra cobrada entra no relatório sem nenhuma alteração. Verificado, não
é trabalho.

---

## 7. Checklist de invariantes

- [ ] I1 — trigger append-only ativa e testada **após** o `ALTER TABLE`; nenhum caminho de código atualiza `praticaProposta`.
- [ ] I2 — `pratica_entre_sessoes` classificada no teste de export (é prontuário: entra).
- [ ] I3 — cobrança da sessão extra passa pelo caminho existente; nenhum `UPDATE` em `lancamento`.
- [ ] I6 — UUID v7; soft delete na prática.
- [ ] I8 — nenhuma dependência nova.
- [ ] I9 — nenhum trecho de evolução, proposta ou termo de busca aparece em log.
