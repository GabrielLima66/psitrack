# SPEC — Fase 3: Anexos

**Status:** proposto
**Base:** `master` @ `e0abbd0` (Fases 0, 1 e 2 completas, 223 testes)
**Etapas:** 14 (cripto e schema), 15 (blobs no backup), 16 (UI), 17 (tela de restore — recomendada)

---

## 1. Contexto

Anexo é a invariante I7 do `CLAUDE.md`, a única nunca exercitada: `<uuid>.enc` no filesystem,
nome original jamais em claro no disco. O caso de uso real é laudo, encaminhamento, relatório
escolar, contrato assinado — documentos que chegam por fora e hoje ficam na pasta de downloads
dela, em claro, fora de qualquer proteção.

### Por que `blobs.ts` entra junto, mesmo com o escopo declarado "anexo só"

O backup atual copia o banco via `VACUUM INTO`. Anexo vive **fora** do banco. No dia em que a
etapa 16 subir, todo backup produzido passa a estar silenciosamente incompleto — restaurar
devolveria o prontuário com referências a arquivos que não existem mais, e nada avisaria.

Isso não é escopo adicional por gosto: é a condição para que a feature não degrade uma garantia
já entregue. A etapa 15 é parte do custo real de ter anexo.

### Invariantes herdadas

| # | Invariante |
|---|---|
| I1 | `prontuario_evolucao` append-only. |
| I2 | `anotacao_privada` nunca entra em export. |
| I3 | Histórico financeiro nunca é reescrito. |
| I4 | Dinheiro em inteiro de centavos. |
| I5 | Timestamps UTC ISO-8601; exibição em `America/Sao_Paulo`. |
| I6 | UUID v7; soft delete. |
| I7 | **Anexo é `<uuid>.enc`; nome original nunca em claro no disco.** ← exercitada aqui |
| I8 | 100% local, sem rede. |

---

## 2. Decisões desta fase

| # | Decisão | Razão |
|---|---|---|
| D25 | Chave por arquivo, envelopada pela chave mestra, **guardada na linha do banco**. | O blob sozinho é lixo criptográfico: copiar a pasta de anexos sem o banco não dá acesso a nada. |
| D26 | Integridade do plaintext pelo tag do AES-GCM; `sha256` só do **ciphertext**. | Permite `verify` de backup conferir cada blob sem descriptografar nada. |
| D27 | Classificação explícita no upload: `prontuario` \| `privado`. | Espelha a divisão evolução × anotação privada (I2). Anexo privado nunca entra em export. |
| D28 | Visualização **só em memória**. Nenhum plaintext em arquivo temporário, nunca. | Extensão natural de I7 — `<uuid>.enc` no disco não adianta se o visualizador cospe um `.tmp` em claro. |
| D29 | "Salvar cópia" é ação explícita, com caminho escolhido pela usuária e aviso de que a cópia sai da proteção do app. | Ela precisa poder mandar um laudo por e-mail. O app não impede; deixa consciente. |
| D30 | Limite de 25 MB por arquivo, sem streaming. | GCM de uma vez em memória é simples e seguro nessa faixa. Chunking só se aparecer necessidade real. |
| D31 | Escrita atômica: `<uuid>.enc.tmp` → fsync → rename → insert. Varredura de órfãos no unlock. | Crash no meio do upload não pode deixar linha sem arquivo nem arquivo sem linha. |
| D32 | Soft delete não apaga o blob. Purga é comando explícito, para anexos com `deleted_at` acima de 30 dias. | Exclusão acidental de laudo é irreversível se o arquivo sumir junto. |
| D33 | `evolucao_id` preenchido obriga `classificacao = 'prontuario'`. | Anexo pendurado em evolução é documento clínico por definição. |

### 2.1 Decisão antecipada — destino de backup (implementação em fase futura)

Registrada aqui para não ser rediscutida:

- O destino é **uma pasta escolhida pela usuária**. O app não tenta distinguir pendrive de
  pasta sincronizada — essa detecção é frágil e falha em silêncio.
- A cópia local **sempre** existe. O destino externo é adicional, nunca substituto.
- Ao configurar o destino, aviso único e explícito: se for pasta sincronizada, o ciphertext sai
  da máquina e a recovery key passa a ser a única barreira. Confirmação obrigatória.
- Indicador permanente de defasagem: *"último backup externo há N dias"*, visível quando N > 7.
  Pendrive desconectado precisa ser um fato visível, não uma falha silenciosa.
- Retenção sugerida: 7 diários + 4 semanais + 6 mensais, purgados por data.

---

## 3. Etapa 14 — Cripto de blob e schema (migration 004)

### 3.1 Tabela `anexo`

```ts
export const anexo = sqliteTable('anexo', {
  id: text('id').primaryKey(),                        // UUID v7 — é também o nome do arquivo
  pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
  evolucaoId: text('evolucao_id').references(() => prontuarioEvolucao.id),
  classificacao: text('classificacao').notNull(),     // prontuario | privado
  nomeOriginal: text('nome_original').notNull(),      // só aqui, nunca no disco
  mime: text('mime').notNull(),
  tamanhoBytes: integer('tamanho_bytes').notNull(),
  sha256Cifrado: text('sha256_cifrado').notNull(),    // verificação sem descriptografar (D26)
  nonce: text('nonce').notNull(),                     // base64
  chaveEnvelopada: text('chave_envelopada').notNull(),// DEK do arquivo, envelopada (D25)
  descricao: text('descricao'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => ({
  pacienteIdx: index('idx_anexo_paciente').on(t.pacienteId, t.classificacao, t.deletedAt),
  evolucaoIdx: index('idx_anexo_evolucao').on(t.evolucaoId),
}))
```

Diretório: `{userData}/anexos/<uuid>.enc`. Nada mais mora lá.

### 3.2 Módulo `anexoCripto.ts` (puro, testável)

```ts
cifrarArquivo(bytes: Buffer, chaveMestra): { blob, nonce, chaveEnvelopada, sha256Cifrado }
decifrarArquivo(blob, nonce, chaveEnvelopada, chaveMestra): Buffer   // lança se o tag falhar
```

DEK aleatória de 256 bits por arquivo, envelopada pela chave mestra já existente da Fase 0.
Mesma primitiva do envelope de banco — nenhuma cripto nova é inventada aqui.

### 3.3 Módulo `anexoStore.ts`

- `salvar(bytes, meta)` — escrita atômica conforme D31, dentro da transação do insert.
- `ler(anexoId)` — devolve `Buffer` em memória; nunca escreve nada.
- `varrerOrfaos()` — no unlock, lista blobs sem linha e linhas sem blob. Blobs órfãos com mais
  de 24h são removidos; linhas sem blob são sinalizadas (nunca apagadas em silêncio).
- `purgar(dias = 30)` — remove blobs de anexos com `deleted_at` acima do limite (D32).

### Critérios de aceite
- [ ] Arquivo cifrado e decifrado devolve bytes idênticos ao original.
- [ ] Alterar 1 byte do blob faz `decifrarArquivo` lançar (tag GCM), não devolver lixo.
- [ ] `chaveEnvelopada` de um banco não abre blob de outro banco.
- [ ] Nome original não aparece em lugar algum do diretório de anexos (teste varre a pasta).
- [ ] Crash simulado entre escrita e insert deixa só um `.tmp`, removido pela varredura.
- [ ] Arquivo acima de 25 MB é rejeitado com mensagem clara, antes de qualquer I/O.

---

## 4. Etapa 15 — Blobs no backup (`blobs.ts`)

### Escopo
- `snapshot` passa a copiar o diretório de anexos junto com o `.db`.
- `manifest.json` ganha a lista de blobs com `id`, `sha256Cifrado` e tamanho, mais a contagem total.
- `verify` confere cada blob do manifesto: presença, tamanho e hash. Divergência falha a verificação.
- `restore` restaura banco **e** blobs, e recusa restaurar um snapshot cujo manifesto não bate.
- Snapshot pré-migração (Etapa 9) passa a incluir blobs pelo mesmo caminho.

### Critérios de aceite
- [ ] Snapshot de banco com 5 anexos produz manifesto com 5 entradas e 5 arquivos.
- [ ] Remover um blob do snapshot faz `verify` falhar apontando qual.
- [ ] Restore devolve banco e blobs; abrir um anexo restaurado decifra corretamente.
- [ ] Restore de snapshot com manifesto divergente é recusado sem tocar no estado atual.
- [ ] Snapshot pré-migração de banco com anexos inclui os blobs.

---

## 5. Etapa 16 — UI de anexos

### Escopo
- Aba "Documentos" na ficha do paciente, lista com nome, tamanho, data, classificação.
- Anexar: diálogo nativo de seleção, escolha obrigatória de classificação (`prontuario` /
  `privado`), descrição opcional. Anexo `privado` fica visualmente marcado como a aba de
  anotação privada — cor de aviso e cadeado, mesma linguagem da Fase 1.
- Da evolução, anexar documento vinculado (`evolucao_id`, força `prontuario` — D33).
- Visualizar em memória: PDF e imagem renderizados no app (D28). Outros formatos só "salvar cópia".
- "Salvar cópia" com aviso de saída da proteção (D29).
- Excluir (soft delete) e restaurar da lixeira.
- **Hook de diálogo sob flag de teste**: sob `PSITRACK_TEST_DIALOG_PATH`, `dialog.showOpenDialog`
  e `showSaveDialog` resolvem com caminho pré-definido em vez de abrir janela. Fecha a lacuna de
  cobertura do CSV da Fase 2 e de tudo que vier depois.

### Critérios de aceite
- [ ] Playwright anexa um PDF de ponta a ponta pelo hook de diálogo, e o arquivo aparece na lista.
- [ ] `coletarParaExport` inclui anexo `prontuario` e **nunca** anexo `privado` (estende o teste da Etapa 8).
- [ ] Visualizar PDF não cria nenhum arquivo fora de `{userData}/anexos` (teste monitora temp e cwd).
- [ ] Anexo vinculado a evolução não permite escolher `privado`.
- [ ] Auto-lock com visualizador aberto descarta o plaintext da memória e fecha o preview.
- [ ] Excluir anexo mantém o blob; purga após 30 dias remove.

---

## 6. Etapa 17 — Tela de restore (recomendada)

A lógica de restore existe e é testada, mas não tem interface: hoje, num desastre real, não há
como usá-la. E a etapa 15 muda o comportamento dela de qualquer forma — o custo marginal de
expor é pequeno agora e alto depois.

### Escopo
- Tela em Configurações: lista de snapshots com data, tamanho, contagem de pacientes e de anexos
  lida do manifesto.
- "Verificar" avulso, sem restaurar.
- Restaurar com dupla confirmação e aviso explícito de que o estado atual será substituído;
  snapshot de segurança do estado atual antes de sobrescrever.
- Registro da última restauração.

### Critérios de aceite
- [ ] Drill completo por Playwright: criar dado → snapshot → apagar paciente e anexo →
      restaurar → conferir que ambos voltaram.
- [ ] Restaurar snapshot corrompido é recusado, com o estado atual intacto.
- [ ] Snapshot de segurança pré-restauração é criado e verificado.

---

## 7. Fora de escopo

Destinos externos de backup / retenção / scheduler (`destinos.ts`, `retencao.ts`,
`scheduler.ts` — ver §2.1); export de prontuário e documentos; OCR; miniatura de imagem;
anexo em anotação privada vinculado (só solto por paciente, com classificação); versionamento
de anexo; assinatura digital.

---

## 8. Dívida ainda em aberto

`coletarParaExport` continua provisória, e a questão do sigilo do adolescente
(`SPEC-fase-1.md` §7) segue devida — vence no momento em que existir feature de export de
prontuário. Esta fase apenas amplia o que `coletarParaExport` precisará considerar (anexos
classificados), sem tornar a decisão exigível ainda.

---

## 9. Checklist de invariantes

- [ ] I1 — `evolucao_id` em anexo não cria caminho de UPDATE em `prontuario_evolucao`.
- [ ] I2 — teste de export cobre anexo `privado`.
- [ ] I5 — timestamps de anexo em UTC, exibição local.
- [ ] I6 — UUID v7 e soft delete na tabela `anexo`.
- [ ] I7 — varredura do diretório de anexos não encontra nenhum nome original nem plaintext.
- [ ] I8 — zero chamadas de rede; toda I/O é local.
