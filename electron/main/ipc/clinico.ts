import { ipcMain } from 'electron'
import {
  atualizarDiagnostico,
  criarDiagnostico,
  listarDiagnosticos,
  removerDiagnostico,
  type DiagnosticoInput
} from '../db/repositories/diagnostico'
import {
  atualizarEncaminhamento,
  criarEncaminhamento,
  listarEncaminhamentos,
  removerEncaminhamento,
  type EncaminhamentoInput
} from '../db/repositories/encaminhamento'
import { obterFichaClinica, salvarFichaClinica, type FichaClinicaInput } from '../db/repositories/fichaClinica'
import {
  atualizarMedicamento,
  criarMedicamento,
  listarMedicamentos,
  removerMedicamento,
  type MedicamentoInput
} from '../db/repositories/medicamento'
import { getDb } from './vault'
import { safely } from './result'

/** Handlers das informações clínicas — Etapa 22 (SPEC-fase-5.md): ficha, medicamentos, diagnósticos e encaminhamentos. */
export function registerClinicoHandlers(): void {
  ipcMain.handle('clinico:obterFicha', (_event, pacienteId: string) =>
    safely(() => ({ ficha: obterFichaClinica(getDb(), pacienteId) }))
  )

  ipcMain.handle('clinico:salvarFicha', (_event, pacienteId: string, input: FichaClinicaInput) =>
    safely(() => ({ ficha: salvarFichaClinica(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('clinico:listarMedicamentos', (_event, pacienteId: string) =>
    safely(() => ({ medicamentos: listarMedicamentos(getDb(), pacienteId) }))
  )

  ipcMain.handle('clinico:criarMedicamento', (_event, pacienteId: string, input: MedicamentoInput) =>
    safely(() => ({ medicamento: criarMedicamento(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('clinico:atualizarMedicamento', (_event, id: string, input: MedicamentoInput) =>
    safely(() => ({ medicamento: atualizarMedicamento(getDb(), id, input) }))
  )

  ipcMain.handle('clinico:removerMedicamento', (_event, id: string) =>
    safely(() => {
      removerMedicamento(getDb(), id)
      return {}
    })
  )

  ipcMain.handle('clinico:listarDiagnosticos', (_event, pacienteId: string) =>
    safely(() => ({ diagnosticos: listarDiagnosticos(getDb(), pacienteId) }))
  )

  ipcMain.handle('clinico:criarDiagnostico', (_event, pacienteId: string, input: DiagnosticoInput) =>
    safely(() => ({ diagnostico: criarDiagnostico(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('clinico:atualizarDiagnostico', (_event, id: string, input: DiagnosticoInput) =>
    safely(() => ({ diagnostico: atualizarDiagnostico(getDb(), id, input) }))
  )

  ipcMain.handle('clinico:removerDiagnostico', (_event, id: string) =>
    safely(() => {
      removerDiagnostico(getDb(), id)
      return {}
    })
  )

  ipcMain.handle('clinico:listarEncaminhamentos', (_event, pacienteId: string) =>
    safely(() => ({ encaminhamentos: listarEncaminhamentos(getDb(), pacienteId) }))
  )

  ipcMain.handle('clinico:criarEncaminhamento', (_event, pacienteId: string, input: EncaminhamentoInput) =>
    safely(() => ({ encaminhamento: criarEncaminhamento(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('clinico:atualizarEncaminhamento', (_event, id: string, input: EncaminhamentoInput) =>
    safely(() => ({ encaminhamento: atualizarEncaminhamento(getDb(), id, input) }))
  )

  ipcMain.handle('clinico:removerEncaminhamento', (_event, id: string) =>
    safely(() => {
      removerEncaminhamento(getDb(), id)
      return {}
    })
  )
}
