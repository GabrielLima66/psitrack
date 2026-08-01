# Handoff — Fase 0 do PsiTrack Desktop

Nota de continuidade de sessão, escrita em 2026-08-01. Objetivo: permitir
retomar o trabalho em outra máquina sem reconstruir o raciocínio do zero.
Isso **não é documentação do produto** — é um registro temporário de
progresso da Fase 0. Pode ser apagado quando a Fase 0 terminar e o
histórico de commits contar a história sozinho.

## Status

**Etapa 1 (scaffold) concluída e commitada** — commit `dae951f`, branch
`master`. Repositório git é **só local, sem remote configurado**. Se a
continuação for em outra máquina, alguém precisa ou (a) configurar um
remote (GitHub/GitLab/etc.) e dar `git push`/`git clone`, ou (b) copiar a
pasta do projeto manualmente (não precisa copiar `node_modules/`, `out/`,
`release/` — dá pra rodar `npm install` de novo do zero).

Etapas 2 a 5 (cripto, banco+drizzle, backup, UI mínima) **ainda não
começaram**. O plano de trabalho é estritamente sequencial e numerado —
depois de cada etapa, para e reporta antes de seguir pra próxima (pedido
explícito do usuário, não é comportamento padrão meu). A última coisa que
aconteceu antes desta nota foi eu perguntar se podia seguir pra Etapa 2, e
o usuário pediu pra registrar o raciocínio antes de continuar em outra
máquina — ou seja, **a resposta a essa pergunta ainda está pendente**.

## Pré-requisitos de ambiente na máquina nova (Windows)

O `better-sqlite3-multiple-ciphers` (SQLCipher) é um módulo nativo que
precisa ser recompilado contra o ABI do Electron via
`electron-builder install-app-deps` (isso já está no `postinstall` do
`package.json`, conforme o CLAUDE.md exige). Isso **requer um toolchain de
compilação C++**, que não vem pronto no Windows:

- Python 3.x — instalei via `winget install --id Python.Python.3.12 -e`
- Visual Studio 2022 Build Tools, workload C++ — instalei via:
  ```
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent \
    --accept-package-agreements --accept-source-agreements \
    --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  ```

**Por que precisa compilar e não dá pra usar binário pré-pronto:** conferi
os assets de release do `better-sqlite3-multiple-ciphers` no GitHub e o
mantenedor só publica binário pré-compilado pra Electron até ABI135
(Electron ~36). O projeto está no Electron 43 (ABI148) de propósito — dava
pra evitar o toolchain inteiro fixando o Electron em uma versão bem mais
antiga, mas isso deixaria o Chromium/Node embutido ~7 versões majors atrás
em patches de segurança, o que não faz sentido pra um app que guarda dado
clínico sensível. Perguntei ao usuário e ele confirmou: instalar o
toolchain e manter o Electron atual.

Se a máquina nova já tiver Python + MSVC Build Tools (ou Visual Studio
completo com workload C++), nenhum desses dois passos é necessário — só
rodar `npm install` normalmente.

**Se o `npm install`/postinstall falhar com erro de Python não encontrado
mesmo com Python instalado:** o node-gyp pode não achar o Python se ele não
estiver no PATH da sessão de shell atual (aconteceu nesta máquina logo após
o `winget install`, porque a sessão de shell não recarrega o PATH do
registro do Windows). Contorno: rodar o `npm install` com o Python
apontado explicitamente:
```
PYTHON="C:\caminho\pra\python.exe" npm install
```

## Decisões técnicas e o porquê

- **`vite` fixado em `^7.3.6`, não `^8.x`** — `electron-vite@5.0.0` só
  aceita `vite ^5 || ^6 || ^7` como peer dependency. Vite 8 quebra o
  `npm install` com ERESOLVE.
- **Tailwind v4 via `@tailwindcss/vite`**, não postcss+autoprefixer — a v4
  já embute prefixing (Lightning CSS) e o plugin de Vite dedicado é o
  caminho mais direto, sem precisar de `postcss.config.js`.
- **`electron.vite.config.ts` precisa de `build.lib.entry` explícito** para
  `main` e `preload`, e de `renderer.root: '.'` +
  `build.rollupOptions.input` apontando pro `index.html` da raiz. Motivo:
  o zero-config do electron-vite espera a convenção
  `src/main/`, `src/preload/`, `src/renderer/`, mas a estrutura de pastas
  aqui é `electron/main/`, `electron/preload/`, `src/` (é a estrutura que o
  próprio CLAUDE.md define), então o autodetect não funciona e precisa ser
  configurado manualmente — sem isso o build falha com
  "An entry point is required..." e depois "index.html file is not found".
- **shadcn/ui foi montado à mão** (`components.json`, `src/lib/utils.ts`,
  `Button`/`Card` em `src/components/ui/`) em vez de rodar
  `npx shadcn add`. O CLI interativo de scaffold (tanto o do electron-vite
  quanto o do shadcn) não lida bem com entrada via pipe neste ambiente de
  shell — trava esperando resposta interativa. Se for adicionar mais
  componentes shadcn depois (Dialog, Label, Input) e o `npx shadcn add`
  funcionar interativamente na máquina nova, pode usar o CLI normal; senão,
  seguir o padrão dos arquivos já criados.
- **Módulos de cripto/banco/backup não devem importar `'electron'` no
  escopo do módulo.** `require('electron')` só retorna a API real
  (`app`, `BrowserWindow` etc.) quando o processo é o processo main de um
  app Electron de verdade rodando normalmente; em qualquer outro modo
  (Node puro, ou Electron com `ELECTRON_RUN_AS_NODE=1`) ele retorna só a
  *string* do caminho do binário. Isso quebra silenciosamente qualquer
  módulo testável que dependa de `app.getPath('userData')` internamente.
  Padrão adotado: módulos puros (`electron/main/crypto`, `electron/main/db`,
  `electron/main/backup`) recebem caminhos como parâmetro explícito
  (injeção de dependência); só o `electron/main/index.ts` e os handlers em
  `electron/main/ipc/*.ts` — que não são testados via vitest — importam
  `electron` de verdade e calculam os caminhos reais.

## Armadilha de ambiente: `ELECTRON_RUN_AS_NODE`

Este ambiente de shell (o processo do Claude Code / harness) roda com
`ELECTRON_RUN_AS_NODE=1` já setado no ambiente herdado — **não é uma
variável de sistema/usuário persistida** (conferi no registro do Windows,
não está lá), é só herdada do processo pai. Isso quebra `npm run dev`
com o erro `Cannot read properties of undefined (reading 'setName')`
porque, nesse modo, `require('electron')` vira a string do binário em vez
da API. Correção usada: rodar com
`env -u ELECTRON_RUN_AS_NODE npm run dev` (bash) quando estiver validando
o app de dentro de uma sessão de agente. **Isso não deve afetar a usuária
rodando num terminal normal fora do Claude Code** — é só um cuidado a ter
ao validar comandos dentro de uma sessão de agente.

Por outro lado, essa mesma variável é **necessária de propósito** pra
rodar os testes (`npm test` → `scripts/test.mjs`), porque o binário nativo
do SQLCipher é recompilado pelo `postinstall` contra o ABI do Electron
(148), não o do Node do sistema (137) — então `vitest` puro quebra com
`NODE_MODULE_VERSION mismatch`, e a saída é rodar o vitest dentro do
próprio binário do Electron em modo "Node puro"
(`ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run`).
Isso já está implementado em `scripts/test.mjs` e não deve precisar de
ajuste na máquina nova.

## Git: identidade de commit

Esta máquina não tinha `user.name`/`user.email` configurados no git. Eu
não configuro git config sozinho (regra minha, não do projeto) — pedi pro
usuário rodar `git config user.name "Gabriel Lima"` e
`git config user.email "gabriel.lima24k@gmail.com"` localmente (sem
`--global`) antes do primeiro commit. Numa máquina nova, mesma checagem:
se `git commit` falhar com "Author identity unknown", é isso.

## Validações já feitas na Etapa 1 (não só escritas, rodadas de verdade)

- `npm run typecheck` — limpo
- `electron-vite build` — main/preload/renderer compilam
- `npm run dev` (com o workaround do `ELECTRON_RUN_AS_NODE`) — janela abriu
  de verdade, sandbox confirmado ativo (`--enable-sandbox` no processo
  renderer), `userData` resolvendo pra `AppData\Roaming\PsiTrack`
- `npm run build` — gerou `release/PsiTrack-0.0.1-setup.exe` (NSIS)

## Plano já pensado pra Etapa 2 (cripto) — ainda não implementado

Isso é uma intenção, não código commitado. Registrar aqui só pra não
precisar re-derivar o raciocínio na retomada.

- **`keys.json`**: `{ version, dek: { password: {salt, kdf:{algorithm:'argon2id', memoryCost, timeCost, parallelism}, nonce, authTag, ciphertext}, recovery: {nonce, authTag, ciphertext} } }`.
  Todos os campos binários em base64.
- **Argon2id**: memoryCost 65536 KiB (64 MiB), timeCost 3, parallelism 4,
  saída de 32 bytes (KEK de 256 bits). É um tier "paranoid" da recomendação
  OWASP — justificado porque é app desktop de usuário único, não é
  memory-constrained, e guarda dado de saúde mental.
- **Recovery key**: 32 bytes aleatórios, exibidos pro usuário em base32
  (Crockford) agrupado em blocos legíveis. Usados **diretamente** como
  chave AES-256-GCM pra desembrulhar a DEK — sem Argon2, porque já é
  entropia máxima (256 bits), KDF só faz sentido pra esticar segredo de
  baixa entropia (senha).
- **Troca de senha**: só rescreve o envelope da senha (novo salt + novos
  parâmetros de KDF) envolvendo a mesma DEK; o envelope da recovery key
  não muda. A senha antiga fica automaticamente inválida porque o envelope
  antigo é substituído, não porque existe uma lista de "senhas revogadas".
- **PRAGMA key**: a DEK vira string hex só no momento exato de abrir o
  banco (`db.pragma("key=\"x'<hex>'\"")`), no menor escopo possível. Essa
  string hex é uma limitação conhecida e aceita — string JS é imutável, não
  dá pra zerar de verdade da heap do V8. Documentar isso como comentário no
  código quando for escrito, não esconder o limite.
- **Auto-lock**: usar `powerMonitor.getSystemIdleTime()` no processo main
  (poll periódico), não listener de mouse/teclado no renderer — mede
  ociosidade de teclado/mouse do SO inteiro, bate exatamente com o texto
  do CLAUDE.md, e mantém o zeramento da DEK inteiramente dentro do main.
- **UUID v7**: implementar à mão (não é justificável adicionar dependência
  pra um algoritmo simples e bem especificado — regra do CLAUDE.md de não
  instalar dependência sem justificar).
- **Trigger append-only**: como o Drizzle não modela triggers no schema
  DSL, gerar com `drizzle-kit generate --custom` (cria uma migração vazia
  já registrada no journal) e escrever o SQL do trigger nela à mão, em vez
  de editar a migração autogerada do schema.

## Regra de ouro pra quem (ou qual sessão) retomar isso

Ler o `CLAUDE.md` inteiro antes de tocar em qualquer coisa — as invariantes
de segurança e de dado de lá valem pro projeto inteiro e não são
negociáveis. Este arquivo aqui é só o estado da Etapa 1 pra cá; o CLAUDE.md
é a fonte de verdade permanente.
