import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgendaScreen } from '@/features/agenda/AgendaScreen'
import { ConfiguracoesScreen } from '@/features/configuracoes/ConfiguracoesScreen'
import { PacientesFlow } from '@/features/pacientes/PacientesFlow'
import { AReceberScreen } from '@/features/receber/AReceberScreen'
import { VaultFlow } from '@/features/vault/VaultFlow'
import { useNavigationStore } from '@/store/navigation'

function NavegacaoTopo() {
  const { area, irPara } = useNavigationStore()
  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex gap-1">
        <Button type="button" variant={area === 'pacientes' ? 'default' : 'ghost'} size="sm" onClick={() => irPara('pacientes')}>
          Pacientes
        </Button>
        <Button type="button" variant={area === 'agenda' ? 'default' : 'ghost'} size="sm" onClick={() => irPara('agenda')}>
          Agenda
        </Button>
        <Button type="button" variant={area === 'receber' ? 'default' : 'ghost'} size="sm" onClick={() => irPara('receber')}>
          A receber
        </Button>
      </div>
      <Button type="button" variant={area === 'configuracoes' ? 'default' : 'ghost'} size="sm" onClick={() => irPara('configuracoes')}>
        <Settings className="size-4" />
        Configurações
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
        <div className="min-h-0 flex-1 overflow-hidden">
          {area === 'agenda' ? (
            <AgendaScreen />
          ) : area === 'receber' ? (
            <AReceberScreen />
          ) : area === 'configuracoes' ? (
            <ConfiguracoesScreen />
          ) : (
            <PacientesFlow />
          )}
        </div>
      </div>
    </VaultFlow>
  )
}

export default App
