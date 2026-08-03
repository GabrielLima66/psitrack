# SPEC — Fase 4: Empacotamento e Backup Externo

**Status:** proposto
**Base:** `master` @ `3fc3974` (Fases 0–3 completas, 273 testes)
**Etapas:** 18 (empacotamento mínimo), 19 (destinos), 20 (retenção), 21 (scheduler)

---

## 1. Contexto

O app está funcionalmente pronto para o dia a dia, mas nunca rodou fora da máquina de
desenvolvimento e o backup continua manual e no mesmo disco. Com uso real começando em
semanas, essas duas lacunas passam a ser o risco dominante — nenhuma delas é sobre feature.

**Ordem importa.** A etapa 18 está no caminho crítico do piloto: sem instalador ela não usa o
app. As etapas 19–21 só passam a importar quando houver dado real acumulado, ou seja, algumas
semanas depois. Se a fase precisar ser cortada, corte pelo fim, nunca pelo começo.

### Invariante nova proposta

| # | Invariante |
|---|---|
| I9 | **Log e diagnóstico nunca contêm conteúdo clínico nem dado identificável.** Nem nome de paciente, nem texto de evolução, nem CPF, nem nome original de anexo. |

Escrever isso no `CLAUDE.md` **antes** de existir a primeira linha de logger. Invariante criada
depois do código nasce violada.

---

## 2. Decisões desta fase

| # | Decisão | Razão |
|---|---|---|
| D34 | Sem auto-update. Instalador entregue manualmente, versão visível na UI. | Updater exige servidor e chamada de rede recorrente — arranha I8 por conveniência de N=1. |
| D35 | Sem certificado de assinatura por ora; aviso do SmartScreen documentado no passo a passo de instalação. | Certificado EV custa mais do que resolve para uma usuária conhecida. Revisável se houver segunda usuária. |
| D36 | Destino externo é **uma pasta escolhida pela usuária**. O app não tenta distinguir pendrive de nuvem. | Detecção é frágil e falha em silêncio. Aviso explícito na configuração resolve melhor. |
| D37 | Cópia local **sempre** existe. O destino externo é adicional, nunca substituto. | Pendrive esquecido não pode significar zero backup. |
| D38 | **Pool de blobs endereçado por conteúdo** no destino: cada blob é gravado uma vez e referenciado por N manifestos. | Anexo é imutável. Cópia integral por snapshot multiplicaria gigabytes por 17 retenções. |
| D39 | Retenção 7 diários + 4 semanais + 6 mensais. Purga só remove snapshot já verificado, e nunca o último bom. | Retenção que pode apagar o único backup íntegro é pior que nenhuma. |
| D40 | Scheduler é **por evento**, não por relógio: ao destrancar (se passou >24h) e ao fechar o app. Máximo um automático por dia. | `cipher_integrity_check` precisa da chave — backup com cofre trancado é impossível por construção. |
| D41 | Falha de backup nunca é silenciosa: banner persistente até resolver ou dispensar explicitamente. | O modo de falha real não é o erro, é o erro que ninguém viu. |
| D42 | Destino indisponível é **estado**, não erro. Backup local segue normalmente. | Pendrive desconectado é rotina, não incidente. |

---

## 3. Etapa 18 — Empacotamento mínimo

Caminho crítico do piloto. O único item da fase sem o qual nada mais acontece.

### Escopo
- `electron-builder` gerando instalador NSIS para Windows x64.
- **Rebuild dos módulos nativos** para o ABI do Electron empacotado — SQLCipher e o driver
  SQLite são a parte que costuma consumir o tempo todo desta etapa. Tratar como risco, não
  como checkbox: pacote que abre em dev e quebra empacotado é a falha esperada aqui.
- Versão visível na UI (Configurações → Sobre), lida do `package.json` em build time.
- Passo a passo de instalação em `docs/INSTALACAO.md`, incluindo o aviso do SmartScreen (D35)
  e onde fica o `userData`.

### Verificações obrigatórias (VM Windows limpa, sem Node nem toolchain)
- [ ] Instalar, criar cofre, cadastrar paciente com horário e preço, registrar evolução,
      anexar PDF, fechar, reabrir, desbloquear, conferir que tudo está lá.
- [ ] **Upgrade real**: instalar build A, gerar dados, instalar build B com migration nova →
      safety-snapshot roda, migration aplica, nada se perde.
- [ ] Desinstalar não apaga `userData` — e isso está dito no `INSTALACAO.md`.
- [ ] Tempo de derivação Argon2id medido em hardware mais fraco que o de dev. Acima de ~2s no
      desbloqueio, reparametrizar antes de entregar. Parâmetro calibrado em máquina de dev é
      uma armadilha clássica.
- [ ] Caminho com espaço e acento (`C:\Users\Maria José\...`) não quebra blobs nem backup.

---

## 4. Etapa 19 — Destinos de backup

### Escopo
- Configurações → Backup: escolher pasta de destino via diálogo nativo (hook de teste da
  Fase 3 já cobre).
- Ao configurar, aviso único e obrigatório: se for pasta sincronizada, o ciphertext sai da
  máquina e a recovery key passa a ser a única barreira. Confirmação explícita, e lembrete de
  onde a recovery key está guardada.
- Backup passa a escrever nos dois lugares: local (sempre) e externo (quando disponível).
- Estrutura no destino:
  ```
  {destino}/psitrack/
    snapshots/{timestamp}/  banco.db + manifest.json
    blobs/{sha256}.enc      pool compartilhado (D38)
  ```
- Destino indisponível: estado visível, backup local segue (D42). Sem erro modal.
- Indicador permanente de defasagem: *"último backup externo há N dias"*, destacado quando N > 7.

### Critérios de aceite
- [ ] Dois snapshots com o mesmo anexo gravam **um** blob no pool, referenciado por ambos.
- [ ] Destino removido no meio do backup não corrompe o snapshot local nem deixa lixo parcial.
- [ ] Reconectar o destino e rodar backup recupera a defasagem sem intervenção manual.
- [ ] `verify` sobre o destino externo confere manifesto + pool e aponta blob faltante.
- [ ] Configurar destino dentro do próprio `userData` é bloqueado.

---

## 5. Etapa 20 — Retenção e purga

### Escopo
- Política 7 diários + 4 semanais + 6 mensais, aplicada a local e externo (D39).
- Purga de snapshot só após `verify` bem-sucedido do conjunto que fica.
- Purga do pool: blob sem referência em nenhum manifesto retido é removido. Contagem de
  referências derivada dos manifestos, nunca mantida como estado à parte.
- Nunca purgar o snapshot verificado mais recente, mesmo que a política mande.
- Tela mostra quanto espaço a retenção ocupa e o que a próxima purga removeria.

### Critérios de aceite
- [ ] Simulação de 90 dias de backups diários converge para exatamente 17 snapshots.
- [ ] Blob referenciado por snapshot mensal antigo **não** é purgado ao cair os diários.
- [ ] Política que resultaria em zero snapshots retém o último bom.
- [ ] Purga interrompida na metade deixa estado consistente; próxima execução completa.
- [ ] `verify` falhando cancela a purga inteira.

---

## 6. Etapa 21 — Scheduler

### Escopo
- Gatilhos (D40): ao destrancar o cofre se passou mais de 24h desde o último backup bem-sucedido;
  ao fechar o app se houve escrita na sessão. Máximo um automático por dia.
- Preferir o gatilho de **destrancar**: no fechamento, uma espera de 10s parece travamento.
  No fechamento, janela de progresso com opção de pular.
- Backup roda sem bloquear a UI, mas escritas ficam suspensas durante o `VACUUM INTO`, com
  indicação visível.
- Falha: banner persistente com motivo e ação (D41). Nunca toast que some.
- Histórico das últimas execuções em Configurações: quando, para onde, resultado.

### Critérios de aceite
- [ ] Destrancar duas vezes no mesmo dia dispara um backup só.
- [ ] Destrancar após 48h dispara imediatamente e o registro fica no histórico.
- [ ] Falha de destino externo mantém o backup local como sucesso parcial, com banner.
- [ ] Fechar o app durante o backup não deixa snapshot pela metade nem pool inconsistente.
- [ ] Auto-lock durante o backup não interrompe a operação em curso.

---

## 7. Fora de escopo

Assinatura de código, auto-update, log e exportação de diagnóstico (Fase 5), export de
prontuário, relatório anual de IR, backup incremental do banco, criptografia adicional do
destino (o snapshot já é SQLCipher).

---

## 8. Depois desta fase: piloto com congelamento

Recomendação de processo, não de escopo: **quatro a seis semanas de uso real sem feature nova**,
só correção. Seis fases foram construídas sobre suposições que nunca encostaram num dia de
consultório. O piloto é o que decide o que a Fase 5 deveria ser — inclusive se export de
prontuário é urgente ou raro, o que por sua vez informa a questão do sigilo do adolescente
(`SPEC-fase-1.md` §7), ainda em aberto.

Durante o piloto, o que colher: quantos backups automáticos rodaram de fato, quantas vezes o
destino esteve indisponível, tempo de desbloqueio na máquina dela, e toda vez que ela precisou
fazer algo fora do app.

---

## 9. Checklist de invariantes

- [ ] I7 — pool de blobs no destino não expõe nome original em nenhum caminho de arquivo.
- [ ] I8 — zero chamadas de rede; escrita em pasta sincronizada é I/O local, o SO é que sincroniza.
- [ ] I9 — registrada no `CLAUDE.md` antes de qualquer logger existir.
- [ ] Retenção nunca deixa o sistema sem um snapshot verificado.
