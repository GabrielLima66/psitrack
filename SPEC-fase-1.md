# SPEC — Fase 1: Cadastro de Paciente, Prontuário e Anotações

**Status:** proposto
**Base:** `master` @ `951a242` (Fase 0 completa)
**Etapas:** 6 (cadastro + lista), 7 (evolução), 8 (anotação privada)

---

## 1. Contexto

A Fase 0 entregou fundação sem nenhuma tela de domínio: cripto (Argon2id + AES-256-GCM,
recovery key, rotação), SQLCipher + Drizzle com migrations versionadas, trigger append-only,
backup verificado e UI de autenticação com auto-lock. 51 testes.

Esta fase levanta a proibição de telas de domínio e entrega o primeiro fluxo utilizável de
ponta a ponta: cadastrar uma paciente, encontrá-la e registrar sessão.

### Invariantes herdadas (não negociáveis)

| # | Invariante |
|---|---|
| I1 | `prontuario_evolucao` é append-only (trigger SQLite). Correção = linha nova com `retifica_id`. |
| I2 | `anotacao_privada` nunca entra em export algum. `prontuario_evolucao` sempre entra. |
| I3 | Preço não é campo de paciente. É `contrato_preco` com vigência. |
| I4 | Dinheiro em inteiro de centavos. Nunca float/REAL. |
| I5 | Timestamps UTC ISO-8601 no banco; exibição em `America/Sao_Paulo`. |
| I6 | IDs UUID v7. Toda tabela mutável tem `created_at`/`updated_at`/`deleted_at`. Exclusão é soft delete. |
| I7 | Anexo é `<uuid>.enc` no filesystem; nome original nunca em claro no disco. |
| I8 | App 100% local. Nenhuma requisição de rede em runtime. |

---

## 2. Decisões desta fase

| # | Decisão | Razão |
|---|---|---|
| D1 | Cadastro guarda identificação, contato e cobrança. Nada de conteúdo clínico. | Campo clínico no cadastro é dado editável sem trilha — contorna I1. |
| D2 | Sem campo `observacoes` no cadastro. | Vira anotação privada disfarçada, sem a proteção de I2. |
| D3 | Sem endereço. | Só emite recibo simples (nome + CPF do pagador). Endereço seria dado sensível guardado à toa. |
| D4 | Responsável legal em tabela própria (`paciente_responsavel`), N por paciente. | Guarda compartilhada é o caso comum, não a exceção. Colunas `responsavel_*` inline travam o caso real. |
| D5 | Menoridade é **derivada** de `data_nascimento`, nunca coluna. | Aos 18 a titularidade do direito de acesso muda sozinha. Coluna booleana apodrece. |
| D6 | `status` (`ativo`/`pausado`/`encerrado`) é ortogonal a `deleted_at`. | `encerrado` é fato clínico (alta); `deleted_at` é erro de digitação. Prontuário de alta continua existindo pelo prazo de guarda. |
| D7 | `contrato_preco` **não** entra nesta fase. | Sem agenda/sessão não há o que precificar; o formato seria chute. Vigência permite inserção retroativa depois — nada se perde. |
| D8 | Busca por `LIKE` sobre coluna normalizada. Sem FTS5. | Centenas de linhas. Indexar conteúdo de prontuário em FTS é decisão de segurança separada. |
| D9 | Evolução mínima: textarea puro. Sem rich text, anexo ou template. | Superfície mínima para exercitar o trigger com UI real. |

---

## 3. Delta de schema (`electron/main/db/schema.ts`)

### 3.1 `pacientes` — alteração

```ts
export const pacientes = sqliteTable('pacientes', {
  id: text('id').primaryKey(),                    // UUID v7
  nome: text('nome').notNull(),
  nomeSocial: text('nome_social'),
  nomeBusca: text('nome_busca').notNull(),        // derivado, ver §3.5
  dataNascimento: text('data_nascimento'),        // 'YYYY-MM-DD' — DATE, sem hora nem fuso
  cpf: text('cpf'),                               // só dígitos, 11 chars
  telefone: text('telefone'),
  email: text('email'),
  status: text('status').notNull().default('ativo'),      // ativo | pausado | encerrado
  motivoEncerramento: text('motivo_encerramento'),        // alta | abandono | encaminhamento | outro
  statusAlteradoEm: text('status_alterado_em'),
  origem: text('origem'),                          // indicação | convênio | redes | outro
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  cpfUnico: uniqueIndex('idx_pacientes_cpf')
    .on(t.cpf).where(sql`${t.cpf} is not null and ${t.deletedAt} is null`),
  buscaIdx: index('idx_pacientes_busca').on(t.nomeBusca),
  statusIdx: index('idx_pacientes_status').on(t.status, t.deletedAt),
}))
```

- **CPF**: nullable de verdade — menor sem CPF e paciente que não quer recibo existem.
  Único apenas entre não-deletados, para permitir recadastro após soft delete.
- **Idade** é sempre derivada em runtime. Nunca persistida.

### 3.2 `paciente_responsavel` — nova

```ts
export const pacienteResponsavel = sqliteTable('paciente_responsavel', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  nome: text('nome').notNull(),
  cpf: text('cpf'),
  parentesco: text('parentesco').notNull(),        // mae | pai | avo | tutor | outro
  telefone: text('telefone'),
  email: text('email'),
  principal: integer('principal', { mode: 'boolean' }).notNull().default(false),
  pagador: integer('pagador', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  pacienteIdx: index('idx_resp_paciente').on(t.pacienteId, t.deletedAt),
}))
```

- `principal` — contato preferencial. No máximo um ativo por paciente (regra de aplicação).
- `pagador` — quem figura no recibo. **Não é sempre o `principal`**: pai paga, mãe leva.
  O CPF do pagador é o que a Receita usa na dedução de despesa de dependente. A Fase de
  financeiro consome esse flag; aqui ele só é coletado.

### 3.3 `prontuario_evolucao` — alteração

```ts
  dataSessao: text('data_sessao').notNull(),       // 'YYYY-MM-DD'
  tipo: text('tipo').notNull().default('sessao'),  // sessao | contato | administrativo
  motivoRetificacao: text('motivo_retificacao'),   // obrigatório na app quando retificaId != null
```

`data_sessao` ≠ `created_at`: o registro pode ser digitado dias depois do atendimento.
Listagem e export ordenam por `data_sessao`; auditoria usa `created_at`.

> ⚠️ **Migration:** a trigger append-only referencia a tabela. `ALTER TABLE ADD COLUMN`
> não invalida trigger no SQLite, mas a migration deve **dropar e recriar** a trigger e o
> teste de regressão deve rodar depois do `ALTER`, provando que UPDATE/DELETE continuam
> bloqueados nas colunas novas também.

### 3.4 `anotacao_privada` — nova

```ts
export const anotacaoPrivada = sqliteTable('anotacao_privada', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  titulo: text('titulo'),
  conteudo: text('conteudo').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),   // TEM updated_at — de propósito
  deletedAt: text('deleted_at'),             // TEM deleted_at — de propósito
})
```

**Sem trigger. Edita e apaga à vontade.** A assimetria em relação a
`prontuario_evolucao` é a feature, não um descuido — documente isso no comentário do arquivo
para que ninguém "conserte" depois.

### 3.5 `nomeBusca`

SQLite não normaliza acento: `LIKE '%jose%'` não acha "José". Derivar na aplicação,
em um único helper compartilhado por escrita e consulta:

```ts
export const normalizarBusca = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
```

Preenchido com `nome` + `nomeSocial` concatenados. Recalculado em todo update.

### 3.6 Migration `002`

1. `ALTER TABLE pacientes ADD COLUMN` × 10 (todas nullable nesta etapa).
2. Backfill `nome_busca` a partir de `nome`.
3. Recriar tabela `pacientes` com `nome_busca NOT NULL` (padrão 12-step do SQLite) — ou,
   se o banco de dev estiver vazio, aplicar `NOT NULL` direto e documentar.
4. `CREATE TABLE paciente_responsavel`, `CREATE TABLE anotacao_privada`.
5. `ALTER TABLE prontuario_evolucao ADD COLUMN` × 3; `data_sessao` entra nullable e vira
   `NOT NULL` no rebuild, já que a tabela está vazia.
6. `DROP TRIGGER` + `CREATE TRIGGER` append-only.
7. Índices.

---

## 4. Etapa 6 — Cadastro, lista e busca

### Escopo
- Migration `002` completa (todas as tabelas de uma vez; as telas é que são fatiadas).
- Repositório + IPC: `paciente:criar | atualizar | obter | listar | arquivar | restaurar`,
  `responsavel:criar | atualizar | remover`.
- Validação Zod no processo main, não só no renderer: CPF com dígito verificador,
  `data_nascimento` não futura, e-mail, `status` no enum.
- **Tela de lista = tela inicial pós-desbloqueio.** Colunas: nome, status, idade,
  data da última sessão. Filtro por status (default `ativo`). Campo de busca por nome/CPF.
- Formulário de cadastro/edição, com seção de responsáveis exibida **apenas** quando
  `data_nascimento` indica menor de 18.
- Arquivar (soft delete) com confirmação; restaurar a partir do filtro "arquivados".

### Critérios de aceite
- [ ] Buscar "jose" retorna "José da Silva"; buscar "silva" também.
- [ ] CPF duplicado é rejeitado com mensagem clara; após arquivar, o mesmo CPF pode ser recadastrado.
- [ ] Paciente com `data_nascimento` de 17 anos exibe seção de responsáveis; com 19, não exibe.
- [ ] Paciente menor sem nenhum responsável ativo salva, mas exibe alerta persistente no cadastro.
- [ ] Alterar `status` para `encerrado` exige `motivo_encerramento` e grava `status_alterado_em`.
- [ ] Arquivar não remove linha alguma do banco (verificado por consulta direta).
- [ ] Auto-lock por inatividade continua funcionando com formulário aberto e sujo; ao
      desbloquear, o rascunho **não** é restaurado do disco em claro.
- [ ] A lista não exibe nenhum conteúdo clínico — nem preview de evolução.

### Fora de escopo
Agenda, financeiro, anexo, import/export, foto de paciente.

---

## 5. Etapa 7 — Evolução clínica

### Escopo
- IPC: `evolucao:criar | listar | retificar`. **Não existe** `evolucao:atualizar` nem
  `evolucao:excluir` — a ausência é intencional e deve estar comentada no arquivo de IPC.
- Timeline na ficha do paciente, ordenada por `data_sessao` desc.
- Editor: textarea, `data_sessao` (default hoje), `tipo`.
- Retificação: abre nova entrada pré-preenchida com o texto anterior, exige
  `motivo_retificacao`, grava `retifica_id`.

### Regra de exibição (crítica)
A retificação **nunca esconde o original**. As duas linhas permanecem visíveis: a antiga
marcada como *retificada em DD/MM/AAAA*, com link para a nova; a nova marcada como
*retifica entrada de DD/MM/AAAA*. Se a UI der a impressão de que "editou", o append-only
virou teatro.

### Critérios de aceite
- [ ] Não há caminho na UI que produza UPDATE ou DELETE em `prontuario_evolucao`.
- [ ] Teste de integração: UPDATE direto no banco é rejeitado pelo trigger (regressão pós-`ALTER`).
- [ ] Cadeia de 3 retificações exibe as 3 entradas, encadeadas e na ordem certa.
- [ ] `data_sessao` retroativa é aceita; `created_at` reflete o momento da digitação.
- [ ] Data exibida em `America/Sao_Paulo`; `created_at` gravado em UTC (teste com TZ do
      sistema alterada).

---

## 6. Etapa 8 — Anotação privada

### Escopo
- IPC completo: `anotacao:criar | atualizar | listar | excluir`.
- Aba separada na ficha do paciente, visualmente distinta da evolução
  (rótulo explícito: *não acessível à paciente, não entra em export*).
- Edição e exclusão livres.

### Critérios de aceite
- [ ] Editar anotação altera a linha e atualiza `updated_at` (comportamento oposto ao da evolução).
- [ ] Nenhuma trigger existe sobre `anotacao_privada` (verificado em `sqlite_master`).
- [ ] Teste de invariante I2: uma função `coletarParaExport(pacienteId)` — ainda que
      provisória e sem UI — retorna evolução e **nunca** anotação privada. Este teste é
      escrito agora, mesmo sem a feature de export, e falha se alguém adicionar a tabela
      à coleta no futuro.
- [ ] As duas abas são distinguíveis à primeira vista, sem ler o texto.

---

## 7. Questão em aberto (não bloqueia esta fase)

**Sigilo do adolescente.** O responsável legal tem direito às informações necessárias ao
exercício da guarda, o que não equivale a acesso integral ao conteúdo do prontuário do
adolescente. Isso importa quando a feature de export/relatório existir — não agora.
Registrar aqui para que a decisão não seja tomada por acidente no código de export.

---

## 8. Checklist de invariantes (rodar ao fim da fase)

- [ ] I1 — trigger append-only ativa e testada após `ALTER TABLE`.
- [ ] I2 — teste de export exclui `anotacao_privada`.
- [ ] I3/I4 — nenhuma coluna de preço ou valor criada nesta fase.
- [ ] I5 — round-trip UTC ↔ `America/Sao_Paulo` testado.
- [ ] I6 — UUID v7 em todas as inserções; nenhum DELETE físico em código de aplicação.
- [ ] I7 — não aplicável (sem anexo nesta fase).
- [ ] I8 — auditoria: zero chamadas de rede no bundle do main e do renderer.
