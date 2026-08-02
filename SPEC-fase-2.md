# SPEC — Fase 2: Agenda e Financeiro

**Status:** proposto (revisão 2 — substitui a revisão 1)
**Base:** `master` @ `b3a241b` (Fases 0 e 1 completas, 97 testes)
**Etapas:** 9 (safety-snapshot), 10 (schema), 11 (cadastro + agenda) — *checkpoint 2A* — 12 (cobrança), 13 (pagamento e recibo)

---

## 1. Contexto e fluxo alvo

Fase 1 entregou cadastro, prontuário append-only e anotação privada. Esta fase liga os três
ao dia a dia real:

1. No cadastro, a paciente já recebe **um ou mais horários fixos** e um **preço inicial**.
2. A agenda se preenche sozinha a partir desses horários.
3. Ao registrar a evolução da sessão, o valor entra no financeiro como **pendente**.
4. Quem paga avulso quita sessão a sessão; quem paga mensal quita o mês inteiro de uma vez.

O valor é **sempre unitário por sessão** nos dois casos. A modalidade define apenas se a
cobrança é quitada avulsa ou agrupada por competência — não existe mensalidade de valor fixo.
Isso derruba a `fatura` e a rotina de fechamento mensal da revisão anterior: duas tabelas
(`lancamento` + `pagamento`) cobrem os dois modos, e a diferença vive na tela.

### Invariantes herdadas

| # | Invariante |
|---|---|
| I1 | `prontuario_evolucao` append-only. Correção = linha nova com `retifica_id`. |
| I2 | `anotacao_privada` nunca entra em export. |
| I3 | Preço é `contrato_preco` com vigência. Reajuste cria linha nova. |
| I4 | Dinheiro em inteiro de centavos. Nunca float/REAL. |
| I5 | Timestamps UTC ISO-8601; exibição em `America/Sao_Paulo`. |
| I6 | UUID v7; `created_at`/`updated_at`/`deleted_at`; soft delete. |
| I7 | Anexo `<uuid>.enc` — **não exercitado nesta fase**. |
| I8 | 100% local, sem rede. |

---

## 2. Decisões desta fase

| # | Decisão | Razão |
|---|---|---|
| D10 | Agenda e financeiro na mesma fase, com **checkpoint 2A** ao fim da etapa 11. | Ponto de parada com app utilizável se o escopo esticar. |
| D11 | `contrato_preco` armazena só `vigencia_inicio`. Fim é derivado da linha seguinte. | Elimina por construção sobreposição e buraco de vigência. Nenhum UPDATE em histórico (I3). |
| D12 | Encerrar contrato = linha `modalidade = 'encerrado'`, sem valor. | Mantém D11 sem coluna de fim. |
| D13 | Recorrência **materializada** em linhas concretas de `sessao`, horizonte de 12 semanas. | Regra virtual + exceções é a fonte clássica de bug de agenda. Exceção vira edição de linha. |
| D14 | Recorrência definida em hora local, convertida para UTC na materialização. | Brasil não tem horário de verão hoje; se voltar, basta regerar o horizonte. |
| D15 | **A `sessao` é a única âncora de cobrança.** Registrar evolução marca a sessão como `realizada`, e é isso que materializa o lançamento. | Ver §2.1. Um lugar só onde dinheiro nasce. |
| D16 | ~~Mensalidade fixa~~ **revogado.** Valor é sempre unitário por sessão; modalidade define só a agregação (`avulso` \| `mensal`). | Resposta da usuária: mensal é valor × quantidade. |
| D17 | `prontuario_evolucao.sessao_id` nullable, preenchido **só no insert**. | Tabela é append-only: vínculo retroativo é impossível sem relaxar o trigger. |
| D18 | Recibo é **registro de emissão**, não emissão. Guarda referência, data e CPF do pagador. | Receita Saúde não tem API de terceiros (I8). |
| D19 | Sem anexo nesta fase. | I7 continua não exercitada; não bloqueia agenda/financeiro. |
| D20 | **Sem `fatura` e sem fechamento mensal.** `lancamento` tem status próprio; um `pagamento` cobre N lançamentos. | Avulso e mensal viram a mesma estrutura, diferindo só no agrupamento da tela. |
| D21 | Valor do lançamento é **congelado na criação**, pelo contrato vigente na data da sessão. Reajuste posterior não altera pendente. | I3. Correção é lançamento de ajuste, nunca reescrita. |
| D22 | **Encaixe** é status próprio (`remarcada` + `remarcada_para_id`), nunca cobrado. Quem cobra é a sessão de destino. | Distingue "avisou e remarcou" de "avisou e não veio". |
| D23 | Pagamento cobre lançamentos **inteiros**. Sem pagamento parcial de sessão. | Sessão pela metade não existe. Desconto é lançamento negativo. |
| D24 | Cadastro cria paciente + N recorrências + contrato inicial, numa transação. | Sem isso a primeira sessão nasce sem valor e sem horário. |

### 2.1 Por que a evolução não é a âncora (D15)

O fluxo pedido é "escreveu a evolução → entra no financeiro". Do ponto de vista da usuária
é exatamente isso que acontece. Internamente, porém, o gatilho é a mudança de status da
sessão, por três motivos:

1. `prontuario_evolucao` é append-only e retificação é **linha nova** — se a linha nova
   disparasse cobrança, corrigir uma vírgula duplicaria o valor.
2. Falta cobrável não tem evolução. Com a sessão como âncora, ela cobra pelo mesmo caminho.
3. Evolução tem `tipo` (`sessao`/`contato`/`administrativo`); só uma cobra.

Índice único em `lancamento.sessao_id` fecha a porta para duplicata por construção.

---

## 3. Etapa 9 — Safety-snapshot pré-migração

Banco só tem dados de teste hoje, então isto é seguro barato, não urgência — mas é a última
janela em que dá pra errar de graça.

### Escopo
- No runner de migrations: havendo migration pendente **e** banco já existente, executar
  `snapshot` + `verify` (Etapa 4) antes do primeiro DDL.
- Abortar a migração se a verificação falhar. Log com o caminho do snapshot.
- Nome: `pre-migration-v{n}-{timestamp}.db`.

### Critérios de aceite
- [ ] Banco novo não gera snapshot — não há o que proteger.
- [ ] Banco existente com migration pendente gera snapshot verificado antes do DDL.
- [ ] `verify` falhando aborta e deixa o banco original intacto.
- [ ] Falha de `VACUUM INTO` (disco cheio simulado) não deixa banco meio-migrado.

---

## 4. Etapa 10 — Schema e regras puras (migration 003)

### 4.1 `recorrencia`

N por paciente — dois ou mais horários fixos na semana é caso normal, não exceção.

```ts
export const recorrencia = sqliteTable('recorrencia', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  diaSemana: integer('dia_semana').notNull(),         // 0=dom … 6=sáb
  horaLocal: text('hora_local').notNull(),            // 'HH:MM' em America/Sao_Paulo
  duracaoMin: integer('duracao_min').notNull().default(50),
  modalidade: text('modalidade').notNull(),           // presencial | online
  vigenciaInicio: text('vigencia_inicio').notNull(),  // 'YYYY-MM-DD'
  vigenciaFim: text('vigencia_fim'),                  // null = ativa
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})
```

### 4.2 `sessao`

```ts
export const sessao = sqliteTable('sessao', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  recorrenciaId: text('recorrencia_id').references(() => recorrencia.id),
  inicioUtc: text('inicio_utc').notNull(),            // ISO-8601 UTC
  duracaoMin: integer('duracao_min').notNull(),
  modalidade: text('modalidade').notNull(),           // presencial | online
  status: text('status').notNull().default('agendada'),
  statusAlteradoEm: text('status_alterado_em'),
  avisadaEm: text('avisada_em'),                      // p/ calcular aviso prévio
  motivo: text('motivo'),
  remarcadaParaId: text('remarcada_para_id'),         // encaixe: aponta p/ a sessão nova
  observacao: text('observacao'),                     // logística, NUNCA clínico
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  agendaIdx: index('idx_sessao_agenda').on(t.inicioUtc, t.deletedAt),
  pacienteIdx: index('idx_sessao_paciente').on(t.pacienteId, t.inicioUtc),
}))
```

`observacao` é logística ("pediu pra entrar pelos fundos"). Se for clínico, é evolução —
mesmo raciocínio do D2 da Fase 1.

### 4.3 `contrato_preco`

```ts
export const contratoPreco = sqliteTable('contrato_preco', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  modalidade: text('modalidade').notNull(),           // avulso | mensal | encerrado
  valorCentavos: integer('valor_centavos'),           // POR SESSÃO. null quando 'encerrado'
  politicaFalta: text('politica_falta').notNull().default('cobra_sem_aviso'),
                                                      // cobra_sempre | cobra_sem_aviso | nunca_cobra
  avisoMinimoHoras: integer('aviso_minimo_horas').notNull().default(24),
  vigenciaInicio: text('vigencia_inicio').notNull(),  // 'YYYY-MM-DD'
  observacao: text('observacao'),                     // "valor social", "acordo até dez"
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  vigenciaIdx: index('idx_contrato_vigencia').on(t.pacienteId, t.vigenciaInicio),
}))
```

Preço vigente numa data — consulta única, sem sobreposição possível:

```sql
select * from contrato_preco
 where paciente_id = ? and deleted_at is null and vigencia_inicio <= ?
 order by vigencia_inicio desc limit 1
```

`modalidade` não muda o valor: muda só se a tela quita avulso ou agrupado por mês.

### 4.4 `lancamento`

```ts
export const lancamento = sqliteTable('lancamento', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  sessaoId: text('sessao_id').references(() => sessao.id),   // null em ajuste/desconto
  competencia: text('competencia').notNull(),         // 'YYYY-MM' da data LOCAL da sessão
  tipo: text('tipo').notNull(),                       // sessao | falta | ajuste | desconto
  descricao: text('descricao').notNull(),
  valorCentavos: integer('valor_centavos').notNull(), // pode ser negativo (desconto)
  status: text('status').notNull().default('pendente'),  // pendente | pago | cancelado
  pagamentoId: text('pagamento_id').references(() => pagamento.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  sessaoUnico: uniqueIndex('idx_lancamento_sessao')
    .on(t.sessaoId).where(sql`${t.sessaoId} is not null and ${t.deletedAt} is null`),
  pendentesIdx: index('idx_lancamento_pendentes').on(t.pacienteId, t.status, t.competencia),
}))
```

- `competencia` é **armazenada**, não derivada em consulta: a sessão está em UTC e a virada
  do mês é local. Sessão de 31/01 23:00 local é competência `2025-01`, não `2025-02`.
- Invariante testável: `status = 'pago'` ⟺ `pagamento_id is not null`.
- `sessaoUnico` é a proteção estrutural contra cobrança duplicada (§2.1).

### 4.5 `pagamento`

```ts
export const pagamento = sqliteTable('pagamento', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  valorCentavos: integer('valor_centavos').notNull(),
  data: text('data').notNull(),                       // 'YYYY-MM-DD' — regime de caixa
  meio: text('meio').notNull(),                       // pix | dinheiro | transferencia | cartao | outro
  pagadorNome: text('pagador_nome').notNull(),        // snapshot
  pagadorCpf: text('pagador_cpf'),                    // snapshot
  reciboEmitidoEm: text('recibo_emitido_em'),
  reciboReferencia: text('recibo_referencia'),        // número gerado pela Receita (D18)
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})
```

`pagador_*` é snapshot, não FK: se o responsável pagador mudar depois, o recibo já emitido
continua refletindo quem pagou. Invariante: `valorCentavos` = soma dos lançamentos apontando
para ele (D23).

### 4.6 Alteração em `prontuario_evolucao`

```ts
  sessaoId: text('sessao_id').references(() => sessao.id),   // só no insert (D17)
```

> ⚠️ Recriar a trigger append-only depois do `ALTER` e rodar o teste de regressão, como na 002.

### 4.7 Regra de cobrança (função pura, testada isolada)

```ts
decidirCobranca(sessao, contrato): { cobra: boolean, tipo: 'sessao'|'falta', valorCentavos: number }
```

| status da sessão | resultado |
|---|---|
| `agendada` | não cobra (futuro) |
| `realizada` | cobra, tipo `sessao` |
| `remarcada` (encaixe) | **nunca** cobra — quem cobra é a sessão de destino (D22) |
| `cancelada_profissional` | nunca cobra |
| `falta_sem_aviso` | cobra, salvo política `nunca_cobra` |
| `falta_com_aviso` | `cobra_sempre` → cobra; `nunca_cobra` → não; `cobra_sem_aviso` → cobra só se `(inicioUtc − avisadaEm) < avisoMinimoHoras` |

### Critérios de aceite (etapa 10)
- [ ] Migration 003 aplica sobre banco da Fase 1 sem perda; trigger append-only segue bloqueando.
- [ ] `precoVigenteEm` acerta em: sem contrato, um contrato, três reajustes, encerrado, reaberto.
- [ ] `decidirCobranca` tem teste para as 6 linhas da tabela × 3 políticas.
- [ ] Sessão local de 31/01 23:00 gera competência `2025-01`.
- [ ] Nenhum valor é float em runtime (assert de inteiro nas fronteiras).

---

## 5. Etapa 11 — Cadastro com horários e agenda (checkpoint 2A)

### Escopo
- **Cadastro estendido**: seção "Atendimento" com N horários fixos (dia da semana, hora,
  duração, modalidade) e preço inicial (valor por sessão, modalidade de cobrança, política
  de falta). Tudo numa transação com o paciente (D24).
- Materialização de 12 semanas na abertura do app; extensão incremental sem duplicar.
- Visão semanal (padrão) e diária; navegação por semana, atalho "hoje".
- Sessão avulsa fora da recorrência.
- Mudança de status com motivo. **Encaixe**: ao marcar falta avisada, oferecer "remarcar
  para…", que cria a sessão de destino e liga via `remarcadaParaId` (D22).
- Editar série = encerrar `vigenciaFim` da recorrência, criar nova, regerar apenas sessões
  futuras com status `agendada`.
- Aviso (não bloqueio) em sobreposição de horário.
- Da sessão, atalho "registrar evolução" abrindo o editor da Etapa 7 com `sessao_id` e
  `data_sessao` preenchidos.

### Critérios de aceite
- [ ] Paciente com dois horários fixos gera as duas séries; encerrar uma não afeta a outra.
- [ ] Abrir o app na semana seguinte estende o horizonte sem duplicar ocorrência.
- [ ] Cancelar uma ocorrência não afeta as demais; encerrar série não apaga sessão `realizada`.
- [ ] Sessão às 14:00 em São Paulo é gravada como `17:00Z` e reexibida como 14:00 com a TZ
      do sistema alterada.
- [ ] Encaixe liga origem e destino, e a origem fica visivelmente marcada como remarcada.
- [ ] Agenda não exibe conteúdo clínico — só nome, horário, modalidade, status.

**Checkpoint 2A:** app utilizável com cadastro + prontuário + agenda. Parada segura.

---

## 6. Etapa 12 — Cobrança

### Escopo
- Marcar sessão como `realizada` (via registro de evolução ou direto na agenda) dispara
  `decidirCobranca` e cria o `lancamento` pendente, com valor congelado (D21).
- Marcar falta dispara a mesma regra; encaixe não gera lançamento.
- Desfazer status (marcou errado): cancela o lançamento (`status = 'cancelado'`) se ainda
  pendente; se já pago, **bloqueia** e orienta lançamento de ajuste.
- Aba "Financeiro" da ficha do paciente: contrato vigente em destaque, histórico de vigências,
  reajuste, e lista de lançamentos por competência com status.
- Lançamento manual de ajuste/desconto.

### Critérios de aceite
- [ ] Registrar evolução para a mesma sessão duas vezes (original + retificação) gera **um** lançamento.
- [ ] Evolução `tipo = 'contato'` ou `'administrativo'` não gera lançamento.
- [ ] Falta avisada com 30h e política `cobra_sem_aviso`/24h → sem cobrança. Com 12h → cobra.
- [ ] Encaixe: origem sem lançamento, destino com lançamento quando realizada.
- [ ] Reajuste com vigência retroativa **não** altera lançamento já criado; avisa que existem
      lançamentos no período afetado.
- [ ] Paciente sem contrato vigente ao realizar sessão: sessão é marcada, lançamento não é
      criado, e a pendência aparece sinalizada — nunca cobrada como zero.
- [ ] Evolução avulsa sem sessão oferece criar a sessão retroativa; recusando, não há cobrança.

---

## 7. Etapa 13 — Pagamento e recibo

### Escopo
- Tela "A receber": pendentes agrupados por paciente. Para `avulso`, seleção item a item;
  para `mensal`, competência inteira pré-selecionada.
- Registrar pagamento: valor (soma dos selecionados), data, meio, pagador. Default do pagador
  = responsável com `pagador = true`, senão a própria paciente.
- Marcar recibo emitido: data e referência gerada pela Receita (D18).
- Relatório do mês: recebido por meio de pagamento, em aberto por paciente, e a relação pronta
  para transcrição no Receita Saúde (nome, CPF, valor, data do recebimento).
- Export CSV **local**, caminho escolhido pela usuária, sem rede.

### Critérios de aceite
- [ ] `pagamento.valorCentavos` sempre igual à soma dos lançamentos vinculados.
- [ ] Lançamento pago não pode ser vinculado a um segundo pagamento.
- [ ] Paciente menor com responsável pagador → recibo sai no CPF do responsável.
- [ ] Relatório usa regime de caixa: entra pela data do pagamento, não da sessão.
- [ ] Registrar pagamento não altera valor de lançamento algum.
- [ ] Export não inclui `anotacao_privada` nem conteúdo de `prontuario_evolucao`
      (estende o teste da Etapa 8).

---

## 8. Fora de escopo

Anexo (I7), `blobs.ts`/`retencao.ts`/`destinos.ts`/`scheduler.ts`, emissão automática de
Receita Saúde, nota fiscal, convênio/reembolso, lembrete por mensagem, pagamento parcial de
sessão, relatório anual consolidado de IR.

---

## 9. Débito de documentação (fazer junto)

`CLAUDE.md`, seção final: trocar "Fase atual: Fase 0 — fundação" por um ponteiro —
*"Fase atual: ver `SPEC-fase-2.md`. Fases concluídas: 0, 1."* — para a seção não precisar ser
reescrita a cada fase. Conferir também se `receita-saude` está descrita lá como emissão; se
estiver, corrigir para preparação/registro (D18).

---

## 10. Checklist de invariantes

- [ ] I1 — trigger append-only testada após o `ALTER` da 003.
- [ ] I2 — teste de export estendido cobre o relatório financeiro.
- [ ] I3 — nenhum UPDATE de valor em `contrato_preco` ou `lancamento` no código de aplicação.
- [ ] I4 — assert de inteiro em toda fronteira de dinheiro (IPC, repositório, parser de input).
- [ ] I5 — round-trip de agenda e de competência testado com TZ do sistema alterada.
- [ ] I6 — UUID v7 e soft delete em todas as tabelas novas.
- [ ] I8 — zero chamadas de rede; export CSV é escrita em disco escolhida pela usuária.
