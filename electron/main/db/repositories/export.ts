import { listarAnexosPaciente, type Anexo } from '../../anexos/anexoStore'
import type { PsiTrackDatabase } from '../connection'
import { listarDiagnosticos, type Diagnostico } from './diagnostico'
import { listarEncaminhamentos, type Encaminhamento } from './encaminhamento'
import { listarEvolucoes, type Evolucao } from './evolucao'
import { obterFichaClinica, type FichaClinica } from './fichaClinica'
import { listarMedicamentos, type Medicamento } from './medicamento'

/**
 * Provisória e sem UI ainda (SPEC-fase-1.md Etapa 8) — existe só pra fixar,
 * com teste, o invariante de dado #2 do CLAUDE.md antes que exista feature
 * de export de verdade: `anotacao_privada` NUNCA entra aqui, `prontuario_
 * evolucao` sempre entra. Anexo (Etapa 16) entra só quando `classificacao
 * = 'prontuario'` — `privado` é o mesmo regime jurídico de `anotacao_privada`
 * (D27), nunca pode ser um campo daqui.
 *
 * As informações clínicas (SPEC-fase-5.md) entram inteiras: são prontuário
 * por definição (D48). Se algum dia surgir conteúdo clínico que a paciente
 * não pode ver, o lugar dele é `anotacao_privada`, que já existe — nunca uma
 * exceção escondida aqui dentro.
 */
export interface DadosExport {
  evolucao: Evolucao[]
  anexos: Anexo[]
  fichaClinica: FichaClinica | null
  medicamentos: Medicamento[]
  diagnosticos: Diagnostico[]
  encaminhamentos: Encaminhamento[]
}

export function coletarParaExport(db: PsiTrackDatabase, pacienteId: string): DadosExport {
  return {
    evolucao: listarEvolucoes(db, pacienteId),
    anexos: listarAnexosPaciente(db, pacienteId).filter((a) => a.classificacao === 'prontuario'),
    fichaClinica: obterFichaClinica(db, pacienteId),
    medicamentos: listarMedicamentos(db, pacienteId),
    diagnosticos: listarDiagnosticos(db, pacienteId),
    encaminhamentos: listarEncaminhamentos(db, pacienteId)
  }
}
