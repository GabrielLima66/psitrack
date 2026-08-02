import type { PsiTrackDatabase } from '../connection'
import { utcParaDataLocal } from '../timezone'
import { criarContratoPreco, type ContratoPrecoInput } from './contratoPreco'
import { criarPaciente, type Paciente, type PacienteInput } from './pacientes'
import { criarRecorrencia, type RecorrenciaInput } from './recorrencia'
import { materializarRecorrencia } from './sessao'

export interface CriarPacienteComAtendimentoInput {
  paciente: PacienteInput
  recorrencias: RecorrenciaInput[]
  contrato: ContratoPrecoInput
}

/**
 * Paciente + N horários fixos + contrato inicial, numa única transação
 * (D24/SPEC-fase-2.md): sem isso a primeira sessão nasceria sem valor e sem
 * horário. Cada recorrência nova já materializa na hora as 12 semanas de
 * ocorrências (D13), pra agenda nascer preenchida junto com o cadastro.
 *
 * Usa `db.$client.transaction(...)` (a API síncrona do próprio
 * better-sqlite3), não `db.transaction()` do Drizzle: o callback do Drizzle
 * recebe um `tx` de tipo `SQLiteTransaction`, que não tem `$client` e por
 * isso não é aceito pelas funções de repositório (todas tipadas com
 * `PsiTrackDatabase`). Como better-sqlite3 só tem uma conexão, qualquer
 * query rodada com o `db` original enquanto o callback do `$client` está
 * executando já roda dentro do mesmo BEGIN/COMMIT — não precisa do `tx`.
 */
export function criarPacienteComAtendimento(db: PsiTrackDatabase, input: CriarPacienteComAtendimentoInput): Paciente {
  const executar = db.$client.transaction((): Paciente => {
    const paciente = criarPaciente(db, input.paciente)
    const hojeLocal = utcParaDataLocal(new Date().toISOString())

    for (const recorrenciaInput of input.recorrencias) {
      const recorrencia = criarRecorrencia(db, paciente.id, recorrenciaInput)
      materializarRecorrencia(db, recorrencia, hojeLocal)
    }

    criarContratoPreco(db, paciente.id, input.contrato)

    return paciente
  })
  return executar()
}
