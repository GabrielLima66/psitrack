import { VaultFlow } from '@/features/vault/VaultFlow'
import { PacientesFlow } from '@/features/pacientes/PacientesFlow'

function App() {
  return (
    <VaultFlow>
      <PacientesFlow />
    </VaultFlow>
  )
}

export default App
