import { Settings } from 'lucide-react'
import { AgendaScreen } from '@/features/agenda/AgendaScreen'
import { BackupAutomaticoOverlay } from '@/features/configuracoes/BackupAutomaticoOverlay'
import { ConfiguracoesScreen } from '@/features/configuracoes/ConfiguracoesScreen'
import { PacientesFlow } from '@/features/pacientes/PacientesFlow'
import { AReceberScreen } from '@/features/receber/AReceberScreen'
import { VaultFlow } from '@/features/vault/VaultFlow'
import { cn } from '@/lib/utils'
import { useNavigationStore, type AreaApp } from '@/store/navigation'
import '@/store/theme'

const ABAS: { area: AreaApp; label: string }[] = [
  { area: 'pacientes', label: 'Pacientes' },
  { area: 'agenda', label: 'Agenda' },
  { area: 'receber', label: 'A receber' }
]

function NavegacaoTopo() {
  const { area, irPara } = useNavigationStore()
  return (
    <div className="flex h-[52px] items-stretch justify-between border-b border-border bg-card px-[18px]">
      <div className="flex items-stretch">
        <div className="flex items-center gap-[9px] self-center pr-[22px]">
          <div className="flex size-6 items-center justify-center rounded-[7px] bg-primary text-[12.5px] font-semibold text-primary-foreground">
            P
          </div>
          <span className="text-[12.5px] font-semibold tracking-[0.12em] text-foreground uppercase">PSITRACK</span>
        </div>
        {ABAS.map((aba) => (
          <button
            key={aba.area}
            type="button"
            onClick={() => irPara(aba.area)}
            className={cn(
              'flex items-center border-b-2 px-[14px] text-[13.5px] font-medium transition-colors',
              area === aba.area ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {aba.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => irPara('configuracoes')}
        aria-label="Configurações"
        className={cn(
          'flex items-center gap-1.5 self-center rounded-lg transition-colors hover:bg-accent',
          area === 'configuracoes' ? 'px-2 py-1.5' : 'size-8 justify-center'
        )}
      >
        <Settings className={cn('size-[17px]', area === 'configuracoes' ? 'text-primary' : 'text-muted-foreground')} />
        {area === 'configuracoes' && <span className="text-[13.5px] font-medium text-foreground">Configurações</span>}
      </button>
    </div>
  )
}

function App() {
  const area = useNavigationStore((s) => s.area)

  return (
    <VaultFlow>
      <div className="flex h-screen flex-col">
        <NavegacaoTopo />
        <BackupAutomaticoOverlay />
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
