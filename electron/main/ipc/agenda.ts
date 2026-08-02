import { ipcMain } from 'electron'
import { criarPacienteComAtendimento, type CriarPacienteComAtendimentoInput } from '../db/repositories/cadastroAtendimento'
import { alterarStatusSessaoComCobranca, remarcarSessaoComCobranca } from '../db/repositories/faturamento'
import { criarRecorrencia, listarRecorrencias, type RecorrenciaInput } from '../db/repositories/recorrencia'
import {
  criarSessaoAvulsa,
  encerrarSerie,
  listarSessoesPeriodo,
  materializarRecorrencia,
  sobreposicaoHorario,
  type AlterarStatusSessaoInput,
  type CriarSessaoAvulsaInput,
  type RemarcarSessaoInput
} from '../db/repositories/sessao'
import { utcParaDataLocal } from '../db/timezone'
import { getDb } from './vault'
import { safely } from './result'

/** Handlers de agenda/atendimento — Etapa 11 (SPEC-fase-2.md): recorrência, sessão e o cadastro combinado (D24). */
export function registerAgendaHandlers(): void {
  ipcMain.handle('paciente:criarComAtendimento', (_event, input: CriarPacienteComAtendimentoInput) =>
    safely(() => ({ paciente: criarPacienteComAtendimento(getDb(), input) }))
  )

  ipcMain.handle('recorrencia:listar', (_event, pacienteId: string) =>
    safely(() => ({ recorrencias: listarRecorrencias(getDb(), pacienteId) }))
  )

  ipcMain.handle('recorrencia:criar', (_event, pacienteId: string, input: RecorrenciaInput) =>
    safely(() => {
      const db = getDb()
      const recorrencia = criarRecorrencia(db, pacienteId, input)
      materializarRecorrencia(db, recorrencia, utcParaDataLocal(new Date().toISOString()))
      return { recorrencia }
    })
  )

  ipcMain.handle('recorrencia:encerrar', (_event, id: string, vigenciaFim: string) =>
    safely(() => ({ recorrencia: encerrarSerie(getDb(), id, vigenciaFim) }))
  )

  ipcMain.handle('sessao:listarPeriodo', (_event, inicioUtc: string, fimUtc: string) =>
    safely(() => ({ sessoes: listarSessoesPeriodo(getDb(), inicioUtc, fimUtc) }))
  )

  ipcMain.handle('sessao:criarAvulsa', (_event, input: CriarSessaoAvulsaInput) =>
    safely(() => ({ sessao: criarSessaoAvulsa(getDb(), input) }))
  )

  ipcMain.handle('sessao:alterarStatus', (_event, id: string, input: AlterarStatusSessaoInput) =>
    safely(() => alterarStatusSessaoComCobranca(getDb(), id, input))
  )

  ipcMain.handle('sessao:remarcar', (_event, id: string, input: RemarcarSessaoInput) =>
    safely(() => remarcarSessaoComCobranca(getDb(), id, input))
  )

  ipcMain.handle('sessao:sobreposicao', (_event, inicioUtc: string, duracaoMin: number, excludingId?: string) =>
    safely(() => ({ colisoes: sobreposicaoHorario(getDb(), inicioUtc, duracaoMin, excludingId) }))
  )
}
