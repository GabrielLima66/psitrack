import { Button } from '@/components/ui/button'
import { AgendaScreen } from '@/features/agenda/AgendaScreen'
import { PacientesFlow } from '@/features/pacientes/PacientesFlow'
import { VaultFlow } from '@/features/vault/VaultFlow'
import { useNavigationStore } from '@/store/navigation'

function NavegacaoTopo() {
  const { area, irPara } = useNavigationStore()
  return (
    <div className="flex gap-1 border-b border-border bg-background px-4 py-2">
      <Button type="button" variant={area === 'pacientes' ? 'default' : 'ghost'} size="sm" onClick={() => irPara('pacientes')}>
        Pacientes
      </Button>
      <Button type="button" variant={area === 'agenda' ? 'default' : 'ghost'} size="sm" onClick={() => irPara('agenda')}>
        Agenda
      </Button>
    </div>
  )
}

function App() {
  const area = useNavigationStore((s) => s.area)

  return (
    <VaultFlow>
      <div className="flex h-screen flex-col">
        <NavegacaoTopo />
        <div className="min-h-0 flex-1 overflow-hidden">{area === 'agenda' ? <AgendaScreen /> : <PacientesFlow />}</div>
      </div>
    </VaultFlow>
  )
}

export default App
