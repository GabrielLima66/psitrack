import { PacienteFormScreen } from './PacienteFormScreen'
import { PacientesListScreen } from './PacientesListScreen'
import { usePacientesStore } from './store'

export function PacientesFlow() {
  const screen = usePacientesStore((state) => state.screen)
  return screen === 'form' ? <PacienteFormScreen /> : <PacientesListScreen />
}
