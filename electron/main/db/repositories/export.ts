import { listarAnexosPaciente, type Anexo } from '../../anexos/anexoStore'
import type { PsiTrackDatabase } from '../connection'
import { listarEvolucoes, type Evolucao } from './evolucao'

/**
 * Provisória e sem UI ainda (SPEC-fase-1.md Etapa 8) — existe só pra fixar,
 * com teste, o invariante de dado #2 do CLAUDE.md antes que exista feature
 * de export de verdade: `anotacao_privada` NUNCA entra aqui, `prontuario_
 * evolucao` sempre entra. Anexo (Etapa 16) entra só quando `classificacao
 * = 'prontuario'` — `privado` é o mesmo regime jurídico de `anotacao_privada`
 * (D27), nunca pode ser um campo daqui.
 */
export interface DadosExport {
  evolucao: Evolucao[]
  anexos: Anexo[]
}

export function coletarParaExport(db: PsiTrackDatabase, pacienteId: string): DadosExport {
  return {
    evolucao: listarEvolucoes(db, pacienteId),
    anexos: listarAnexosPaciente(db, pacienteId).filter((a) => a.classificacao === 'prontuario')
  }
}
