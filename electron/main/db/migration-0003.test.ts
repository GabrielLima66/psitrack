import { randomBytes } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from './connection'
import { runMigrations } from './migrate'
import { pacientes, prontuarioEvolucao } from './schema'
import { createTempDbPath } from './test-support'
import { uuidv7 } from './uuidv7'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), 'migrations')

/** Clona a pasta real de migrations, mas removendo a 0003 — simula "banco no estado da Fase 1", antes da migration desta etapa existir. */
function criarPastaSemMigration0003(): string {
  const dir = mkdtempSync(join(tmpdir(), 'psitrack-sem-0003-'))
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true })
  rmSync(join(dir, '0003_agenda_financeiro.sql'))

  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: { tag: string }[] }
  journal.entries = journal.entries.filter((entrada) => !entrada.tag.startsWith('0003_'))
  writeFileSync(journalPath, JSON.stringify(journal, null, 2))

  return dir
}

let db: PsiTrackDatabase | undefined
let cleanup: (() => void) | undefined

afterEach(() => {
  db?.$client.close()
  db = undefined
  cleanup?.()
  cleanup = undefined
})

describe('migration 0003 sobre banco da Fase 1', () => {
  it('aplica sem perder dado existente, e a trigger append-only segue bloqueando', () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    // 1. Banco "da Fase 1": só até a migration 0002.
    const pastaFase1 = criarPastaSemMigration0003()
    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, pastaFase1)

    // Inserts em SQL cru, não via query builder do Drizzle: o objeto de
    // schema importado é o ATUAL (já com sessao_id), então um
    // `db.insert(prontuarioEvolucao).values(...)` geraria uma coluna que
    // ainda não existe fisicamente neste banco só-até-0002. SQL cru insere
    // só as colunas que existiam de verdade na Fase 1.
    const pacienteId = uuidv7()
    const agora = new Date().toISOString()
    db.$client
      .prepare('INSERT INTO pacientes (id, nome, nome_busca, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(pacienteId, 'Paciente Pré-Existente', 'paciente pre-existente', agora, agora)

    const evolucaoId = uuidv7()
    db.$client
      .prepare('INSERT INTO prontuario_evolucao (id, paciente_id, conteudo, data_sessao, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(evolucaoId, pacienteId, 'Evolução gravada antes da Etapa 10 existir.', '2026-05-01', agora)

    // 2. Migra pra versão atual (0003 incluída).
    runMigrations(db, MIGRATIONS_FOLDER)

    // 3. Dado antigo sobreviveu, intocado.
    const pacienteDepois = db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).get()
    expect(pacienteDepois?.nome).toBe('Paciente Pré-Existente')

    const evolucaoDepois = db.select().from(prontuarioEvolucao).where(eq(prontuarioEvolucao.id, evolucaoId)).get()
    expect(evolucaoDepois?.conteudo).toBe('Evolução gravada antes da Etapa 10 existir.')
    expect(evolucaoDepois?.sessaoId).toBeNull() // coluna nova, sem valor pra linha antiga

    // 4. Trigger append-only segue bloqueando, mesmo pra linha que já existia antes do ALTER.
    expect(() =>
      db!.update(prontuarioEvolucao).set({ conteudo: 'tentando reescrever' }).where(eq(prontuarioEvolucao.id, evolucaoId)).run()
    ).toThrow()

    // 5. Tabelas novas existem e estão vazias.
    const tabelasNovas = ['recorrencia', 'sessao', 'contrato_preco', 'lancamento', 'pagamento']
    for (const tabela of tabelasNovas) {
      const linhas = db!.$client.prepare(`SELECT count(*) as count FROM "${tabela}"`).get() as { count: number }
      expect(linhas.count).toBe(0)
    }
  })
})
