import type { PsiTrackDatabase } from '../connection'
import { listarEvolucoes, type Evolucao } from './evolucao'

/**
 * Provisória e sem UI ainda (SPEC-fase-1.md Etapa 8) — existe só pra fixar,
 * com teste, o invariante de dado #2 do CLAUDE.md antes que exista feature
 * de export de verdade: `anotacao_privada` NUNCA entra aqui, `prontuario_
 * evolucao` sempre entra. Se um dia isto ganhar mais campos (dados
 * cadastrais, anexos), `anotacaoPrivada`/`anotacao` não pode ser um deles.
 */
export interface DadosExport {
  evolucao: Evolucao[]
}

export function coletarParaExport(db: PsiTrackDatabase, pacienteId: string): DadosExport {
  return {
    evolucao: listarEvolucoes(db, pacienteId)
  }
}
