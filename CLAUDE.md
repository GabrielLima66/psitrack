# PsiTrack Desktop

App desktop de gestão de consultório para psicóloga autônoma (uso individual, Windows).
Guarda prontuário psicológico, agenda, controle financeiro e status de emissão do
Receita Saúde. **100% local — o app não faz nenhuma chamada de rede.**

Dado clínico de saúde mental é dado pessoal sensível (LGPD Art. 5º II) e o prontuário
tem guarda legal de até 20 anos (Lei 13.787/2018). Erro de cripto ou de backup aqui
não é bug, é perda irreversível de registro com valor probatório em processo ético.

---

## Stack

| Camada | Escolha |
|---|---|
| Shell | Electron + electron-vite |
| UI | React 19 + TypeScript + Tailwind + shadcn/ui |
| Banco | better-sqlite3-multiple-ciphers (SQLCipher) |
| ORM | Drizzle (migrações versionadas) |
| KDF | @node-rs/argon2 (Argon2id) |
| Estado UI | Zustand |
| Build | electron-builder → NSIS |

`postinstall: electron-builder install-app-deps` é obrigatório — módulo nativo precisa
do ABI do Electron. Sem isso o erro é `NODE_MODULE_VERSION mismatch`.

---

## Invariantes de segurança

Estas regras não são negociáveis. Se uma tarefa parecer exigir violar alguma,
**pare e pergunte** em vez de contornar.

1. **A DEK só existe no processo main.** Nunca trafega por IPC, nunca chega ao
   renderer, nunca aparece em log, exceção, `console.log` ou mensagem de erro.
2. **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.**
   Renderer recebe apenas DTOs por IPC tipado via preload.
3. **Nada em claro toca o disco.** Nem temp, nem cache, nem log. Anexo é decifrado
   em memória e servido por blob URL. **Nunca** `shell.openPath()` em arquivo
   decifrado, nunca `fs.writeFile` de conteúdo clínico sem cifrar.
4. **Envelope de chave:** senha → Argon2id → KEK → desembrulha DEK. A DEK é
   aleatória de 256 bits e nunca muda. Trocar senha reescreve só o envelope.
5. **`keys.json` acompanha todo backup.** Banco sem envelope é banco inabrível,
   mesmo com a senha correta.
6. **Auto-lock em 5 min de ociosidade** (sem teclado/mouse — digitação longa de
   evolução não pode travar no meio). Ao travar, zera a DEK da memória.
7. **Sem rede.** Sem telemetria, sem auto-update, sem CDN. Fontes e ícones no bundle.
   Não adicione dependência que faça request em runtime.

---

## Invariantes de dado

1. **`prontuario_evolucao` é append-only, garantido por trigger SQLite** que aborta
   UPDATE e DELETE. Correção = nova linha com `retifica_id` apontando pra original.
2. **`prontuario_evolucao` e `anotacao_privada` são tabelas separadas.** A primeira
   é acessível ao paciente por direito (Res. CFP 001/2009) e entra no export.
   A segunda nunca entra em export nenhum.
3. **Dinheiro em inteiro de centavos.** Nunca float, nunca `REAL`.
4. **Timestamps em UTC ISO-8601** no banco. Exibição em `America/Sao_Paulo`.
5. **IDs são UUID v7**, não autoincrement. Toda tabela tem `created_at`,
   `updated_at`, `deleted_at`. Exclusão é soft delete.
6. **Preço não é campo do paciente** — é `contrato_preco` com vigência. Reajuste cria
   linha nova; histórico financeiro nunca é reescrito.
7. **Anexo é `<uuid>.enc`.** Nunca use nome original no filesystem — nome de arquivo
   vai em claro pro provedor de nuvem e vazaria o paciente.

---

## Backup

- Snapshot via `VACUUM INTO` (sai já cifrado e consistente com o banco em uso).
- Escreve em `.tmp` e faz `rename` atômico. Nunca escreva direto no arquivo final.
- **Sempre verifique após gerar:** reabre com a DEK, roda `integrity_check`, confere
  contagem de linhas, grava resultado no `manifest.json`.
- Blobs são copiados por UUID, uma vez, nunca reescritos e nunca apagados.
- Repositório canônico em disco local real. Nuvem e removível são destinos de cópia,
  nunca destino primário de escrita.
- **Migração só roda depois de snapshot bem-sucedido**, e dentro de transação.
- `manifest.json` grava a versão de schema. Restaurar backup de versão superior
  à do app deve ser bloqueado com erro claro.

---

## Estrutura

```
electron/
  main/
    crypto/     argon2, envelope, aes-gcm
    db/         conexão, schema drizzle, migrations
    ipc/        handlers por domínio
    backup/     snapshot, blobs, retencao, destinos, scheduler
  preload/      API tipada exposta ao renderer
src/
  features/     pacientes, prontuario, agenda, financeiro, receita-saude
  components/ui
```

Dados em runtime: `%APPDATA%/PsiTrack/` — `psitrack.db`, `attachments/`,
`keys.json`, `config.json`.

---

## Testes

Cobertura de UI é opcional. **Cobertura de cripto e backup não é.** Devem existir e
passar antes de qualquer feature de produto:

- Grava marcador `ZZMARCADORTESTE`, fecha o banco, lê o `.db` como bytes crus e
  afirma que a string **não aparece** no arquivo.
- Abrir o banco sem `PRAGMA key` deve falhar.
- Ciclo backup → restore preserva contagens de todas as tabelas.
- Troca de senha não perde dado e invalida a senha antiga.
- Recovery key abre o banco sem a senha.
- Trigger de append-only rejeita UPDATE e DELETE em `prontuario_evolucao`.

---

## Comandos

```bash
npm run dev            # electron-vite dev
npm run build          # instalador NSIS em release/
npm test               # vitest
npm run db:generate    # gera migração drizzle
```

---

## Regras de trabalho

- Antes de criar arquivo novo, procure se já existe algo equivalente.
- Não instale dependência sem justificar — superfície de ataque e peso de bundle.
- Não faça commit de `*.db`, `attachments/`, `keys.json`, `*.psi`.
- Mensagem de erro nunca inclui conteúdo de campo clínico nem material de chave.
- Ao terminar uma etapa numerada, **pare e reporte** antes de seguir pra próxima.

## Fase atual

**Fase 0 — fundação.** Só shell, banco cifrado, senha mestra, auto-lock e
backup/restore verificado. Não crie tela de paciente, agenda ou financeiro ainda.
