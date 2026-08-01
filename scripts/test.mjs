#!/usr/bin/env node
/**
 * `npm run postinstall` recompila os módulos nativos (better-sqlite3-multiple-ciphers)
 * contra o ABI do Electron, não do Node — é exatamente o passo que o CLAUDE.md
 * exige. Isso significa que rodar `vitest` com o Node do sistema normalmente
 * QUEBRA (NODE_MODULE_VERSION mismatch), porque o binário compilado não bate
 * com o ABI do Node puro.
 *
 * A saída é rodar o vitest dentro do próprio binário do Electron, usando
 * ELECTRON_RUN_AS_NODE=1: nesse modo o binário do Electron se comporta como
 * um executável Node comum (sem `app`, `BrowserWindow`, etc.), mas com o
 * mesmo runtime V8/Node embutido — logo o mesmo ABI contra o qual o módulo
 * nativo foi compilado.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import electronPath from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vitestEntry = join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs')

const child = spawn(electronPath, [vitestEntry, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1'
  }
})

child.on('error', (err) => {
  console.error('Falha ao iniciar o Electron para rodar os testes:', err.message)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
