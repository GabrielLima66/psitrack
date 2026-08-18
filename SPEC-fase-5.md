# SPEC — Fase 5: Informações clínicas na ficha

**Status:** proposto
**Base:** `master` @ `8613cc9` + trabalho não commitado (estorno de pagamento, preview de `.txt`/`.docx`, mensagens de confirmação) — 371 testes
**Etapas:** 22 (modelo e backend), 23 (UI da aba)

---

## 1. Contexto

Hoje a ficha guarda identificação, evolução, anotação privada, financeiro e documentos. O que
não tem lugar nenhum é o **retrato clínico estável** da paciente: que remédio ela toma, que
diagnóstico trouxe, para quem já foi encaminhada, qual era a demanda quando chegou, e sob que
abordagem está sendo atendida.

Hoje isso é escrito solto dentro de alguma evolução — o que funciona para registrar *quando* a
informação apareceu, e falha para responder *qual é a situação agora*. "Ela ainda toma
sertralina?" exige reler a timeline inteira. É a diferença entre diário e cadastro: a evolução
é o diário, e este spec cria o cadastro.

### Por que isso não é só mais um campo de texto na aba Cadastro

`SPEC-fase-1.md` D1/D2 é explícito: a tabela `pacientes` guarda **identificação, contato e
cobrança — nada de conteúdo clínico**. Demanda inicial e abordagem são conteúdo clínico. Colocá-los
como colunas em `pacientes` violaria uma decisão já tomada e tornaria a tabela mais sensível do
que ela é hoje. Por isso o modelo abaixo usa tabelas próprias, mesmo para os dois campos
narrativos que "caberiam" numa coluna.

### Invariantes herdadas

| # | Invariante |
|---|---|
| I1 | `prontuario_evolucao` append-only. |
| I2 | `anotacao_privada` nunca entra em export. |
| I6 | UUID v7; soft delete. |
| I8 | 100% local, sem rede. |
| I9 | Log e diagnóstico nunca contêm conteúdo clínico nem dado identificável. |

---

## 2. Decisões desta fase

| # | Decisão | Razão |
|---|---|---|
| D43 | Informação clínica é **editável, não append-only**. Soft delete + `updated_at`, como `paciente_responsavel`. | I1 é sobre a *evolução* — o registro do que aconteceu numa data. Isto é cadastro do estado atual: corrigir o nome de um remédio digitado errado não pode exigir o ritual de retificação. |
| D44 | Histórico de remédio vem de **`inicio`/`fim` na própria linha**, não de versionamento de linha. `fim = null` significa em uso hoje. | Uma linha por medicação com período é o modelo natural do dado e responde "toma hoje?" e "já tomou?" com a mesma consulta, sem tabela de histórico à parte. |
| D45 | Remédio é **estruturado**; diagnóstico e encaminhamento são **lista datada com campos mínimos**; demanda inicial e abordagem são **texto livre**. | Só o remédio tem linha do tempo de verdade e ganha algo real com estrutura. Estruturar demanda inicial seria formulário no lugar de clínica. |
| D46 | Remédio registra **quem prescreveu**, e o app nunca trata isso como prescrição. | Psicóloga não prescreve. O campo existe porque a informação é *relatada* — pela paciente ou pelo psiquiatra — e a origem importa para a leitura clínica. |
| D47 | "Encaminhamento" aqui é **de saída**: ela encaminha a paciente para outro profissional. A entrada continua sendo o campo `origem` do cadastro. | Dois sentidos no mesmo rótulo é ambiguidade garantida na leitura. `origem` (indicação/convênio/redes) já cobre a entrada. |
| D48 | Tudo desta fase é **prontuário** e entra no export quando o export existir. Nada aqui é anotação privada. | Se fosse conteúdo que a paciente não pode ver, o lugar seria `anotacao_privada`, que já existe. Registrar agora evita que a decisão seja tomada por acidente no código de export (mesma preocupação de `SPEC-fase-1.md` §7). |
| D49 | Aba própria na ficha, não bloco dentro de Cadastro. | Dado clínico e dado administrativo têm públicos e sensibilidades diferentes; misturar numa tela longa esconde os dois. |

> **Revisão de D49 (pós-implementação):** demanda inicial e abordagem — só esses dois, não
> medicamentos/diagnósticos/encaminhamentos — foram movidos pra aba Cadastro e se tornaram
> **obrigatórios no cadastro de paciente novo**. Decisão do usuário: sem os dois, o prontuário
> nasce incompleto e ninguém volta pra preencher depois. O modelo não mudou — continuam em
> `paciente_ficha_clinica`, nunca em `pacientes` (D1/D2 intacto) — só o lugar na tela e a
> obrigatoriedade na criação. Ao editar um paciente já existente, os dois campos continuam
> opcionais (mesmo raciocínio de D45: nem toda ficha antiga tem os dois preenchidos, e limpar um
> campo não pode ficar impossível). `criarPacienteComAtendimento` passa a validar os dois campos
> com um schema próprio (`fichaClinicaObrigatoriaSchema`), fora da transação — falha de campo
> obrigatório é rejeitada antes de abrir o `BEGIN`, não via rollback.

---

## 3. Etapa 22 — Modelo e backend

### Tabelas

```
paciente_ficha_clinica          1:1 com paciente
  id, paciente_id (único, não deletado)
  demanda_inicial   text        narrativa: o que a trouxe
  abordagem         text        TCC, psicanálise, ACT…
  created_at, updated_at, deleted_at

paciente_medicamento            N por paciente
  id, paciente_id
  nome              text NOT NULL
  dose              text         "50mg, 1x ao dia" — texto livre, não numérico
  prescritor        text         quem prescreveu (D46)
  inicio            text         'YYYY-MM-DD', nullable (nem sempre se sabe)
  fim               text         'YYYY-MM-DD', null = em uso hoje (D44)
  observacao        text
  created_at, updated_at, deleted_at

paciente_diagnostico            N por paciente
  id, paciente_id
  descricao         text NOT NULL
  cid               text         opcional, texto livre — sem tabela de CID embutida
  data              text         'YYYY-MM-DD', quando foi comunicado/registrado
  profissional      text         quem diagnosticou
  observacao        text
  created_at, updated_at, deleted_at

paciente_encaminhamento         N por paciente (D47 — de saída)
  id, paciente_id
  para_quem         text NOT NULL   nome do profissional ou serviço
  especialidade     text            psiquiatria, neuro, nutrição…
  data              text NOT NULL   'YYYY-MM-DD'
  motivo            text
  observacao        text
  created_at, updated_at, deleted_at
```

Índice por `paciente_id + deleted_at` em cada uma das três tabelas N, mesmo padrão de
`idx_resp_paciente`. `paciente_ficha_clinica` não precisa de índice além do único.

### Repositórios

Um arquivo por entidade em `electron/main/db/repositories/`, seguindo `responsaveis.ts` linha a
linha (schema Zod, `obterXOuFalhar`, listar/criar/atualizar/remover com soft delete):

- `fichaClinica.ts` — `obterFichaClinica`, `salvarFichaClinica` (upsert: cria na primeira gravação).
- `medicamento.ts` — CRUD + `listarMedicamentos(db, pacienteId)` devolvendo em uso primeiro, depois encerrados por `fim` desc.
- `diagnostico.ts` — CRUD, ordenado por `data` desc.
- `encaminhamento.ts` — CRUD, ordenado por `data` desc.

IPC em `electron/main/ipc/clinico.ts` (`registerClinicoHandlers`), todos via `safely()`, registrado
em `index.ts` junto dos demais. Preload ganha o namespace `clinico`.

### Critérios de aceite

- [ ] Remédio com `fim = null` aparece como em uso; preencher `fim` move para o histórico sem apagar a linha.
- [ ] Remover remédio é soft delete: some da listagem, continua no banco.
- [ ] `salvarFichaClinica` chamada duas vezes atualiza a mesma linha, nunca cria a segunda.
- [ ] Nenhuma coluna clínica foi adicionada à tabela `pacientes` (verificação de D1/D2).
- [ ] Teste de I2 atualizado: `coletarParaExport(pacienteId)` inclui as quatro tabelas desta fase e continua **nunca** incluindo `anotacao_privada`.

---

## 4. Etapa 23 — UI da aba

### Escopo

Aba **"Informações clínicas"** na ficha, entre Cadastro e Evolução. Quatro blocos no padrão de
card já usado em `FinanceiroSection` (cabeçalho com título + ação à direita, corpo abaixo):

1. **Quadro clínico** — demanda inicial e abordagem, dois textareas com salvamento explícito.
2. **Medicações** — duas listas: *em uso* e *já utilizadas*, separadas visualmente. Formulário
   inline para adicionar, edição inline para corrigir. Encerrar uma medicação é preencher `fim`,
   ação com rótulo próprio ("Marcar como encerrada"), não um "excluir".
3. **Diagnósticos** — lista datada, mais recente primeiro.
4. **Encaminhamentos** — lista datada, mais recente primeiro, com para quem e motivo.

Exclusão em qualquer lista usa `<ConfirmarAcao variant="warn">` — o componente já existe.

Textarea de demanda inicial e abordagem usa o auto-resize da Fase 6 (§ Etapa 24) se as fases
forem construídas na ordem; se esta vier antes, o auto-resize nasce aqui e a Fase 6 reaproveita.

### Critérios de aceite

- [ ] Aba visível e distinguível; a ficha continua legível com 7 abas (ver §6).
- [ ] Encerrar uma medicação move o item de lista sem perder nenhum campo.
- [ ] Editar um diagnóstico atualiza a linha e o `updated_at` (comportamento oposto ao da evolução, D43).
- [ ] Paciente sem nenhuma informação clínica mostra estado vazio explicativo em cada bloco, não uma aba em branco.
- [ ] Nada nesta aba aparece em log, mensagem de erro ou diagnóstico (I9).

---

## 5. Fora de escopo

Tabela de CID embutida ou validação de código CID; alerta de interação medicamentosa (não é
papel do app e seria perigoso); importar medicação de receita digitalizada; versionamento de
linha das informações clínicas (D43 decide o contrário); relatório clínico consolidado.

---

## 6. Risco de navegação registrado

Com esta fase e a Fase 6, a ficha vai de 5 para 7 abas: Cadastro, Informações clínicas, Evolução,
Práticas entre sessões, Anotações, Financeiro, Documentos.

Sete é o limite do que uma barra de abas suporta antes de virar menu. Não bloqueia esta fase, mas
**a próxima aba depois dessas duas deve vir acompanhada de um reagrupamento**, não de mais uma
aba. O agrupamento natural, se for preciso: *Clínico* (informações + evolução + práticas +
anotações) e *Administrativo* (cadastro + financeiro + documentos).

---

## 7. Checklist de invariantes

- [ ] I1 — nenhuma tabela desta fase tem trigger append-only; a distinção com `prontuario_evolucao` está comentada no schema.
- [ ] I2 — teste de export atualizado e passando, incluindo as quatro tabelas novas e excluindo `anotacao_privada`.
- [ ] I6 — UUID v7 em toda inserção; soft delete em toda remoção.
- [ ] I8 — nenhuma dependência nova; nenhuma chamada de rede.
- [ ] I9 — nenhum campo desta fase aparece em log ou mensagem de erro.
