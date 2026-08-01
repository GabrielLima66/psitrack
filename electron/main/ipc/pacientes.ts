import { ipcMain } from 'electron'
import {
  alterarStatusPaciente,
  arquivarPaciente,
  atualizarPaciente,
  criarPaciente,
  listarPacientes,
  obterPaciente,
  restaurarPaciente,
  type AlterarStatusInput,
  type ListarPacientesOptions,
  type PacienteInput
} from '../db/repositories/pacientes'
import {
  atualizarResponsavel,
  criarResponsavel,
  listarResponsaveis,
  removerResponsavel,
  type ResponsavelInput
} from '../db/repositories/responsaveis'
import { getDb } from './vault'
import { safely } from './result'

/** Handlers do domínio "paciente"/"responsável" — Etapa 6 (cadastro, lista e busca). */
export function registerPacientesHandlers(): void {
  ipcMain.handle('paciente:criar', (_event, input: PacienteInput) =>
    safely(() => ({ paciente: criarPaciente(getDb(), input) }))
  )

  ipcMain.handle('paciente:atualizar', (_event, id: string, input: PacienteInput) =>
    safely(() => ({ paciente: atualizarPaciente(getDb(), id, input) }))
  )

  ipcMain.handle('paciente:alterarStatus', (_event, id: string, input: AlterarStatusInput) =>
    safely(() => ({ paciente: alterarStatusPaciente(getDb(), id, input) }))
  )

  ipcMain.handle('paciente:obter', (_event, id: string) => safely(() => ({ paciente: obterPaciente(getDb(), id) ?? null })))

  ipcMain.handle('paciente:listar', (_event, options: ListarPacientesOptions) =>
    safely(() => ({ pacientes: listarPacientes(getDb(), options) }))
  )

  ipcMain.handle('paciente:arquivar', (_event, id: string) =>
    safely(() => {
      arquivarPaciente(getDb(), id)
      return {}
    })
  )

  ipcMain.handle('paciente:restaurar', (_event, id: string) =>
    safely(() => {
      restaurarPaciente(getDb(), id)
      return {}
    })
  )

  ipcMain.handle('responsavel:listar', (_event, pacienteId: string) =>
    safely(() => ({ responsaveis: listarResponsaveis(getDb(), pacienteId) }))
  )

  ipcMain.handle('responsavel:criar', (_event, pacienteId: string, input: ResponsavelInput) =>
    safely(() => ({ responsavel: criarResponsavel(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('responsavel:atualizar', (_event, id: string, input: ResponsavelInput) =>
    safely(() => ({ responsavel: atualizarResponsavel(getDb(), id, input) }))
  )

  ipcMain.handle('responsavel:remover', (_event, id: string) =>
    safely(() => {
      removerResponsavel(getDb(), id)
      return {}
    })
  )
}
