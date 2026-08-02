import { Badge } from '@/components/ui/badge'
import { formatarHoraLocal, formatarModalidade, formatarStatusSessao } from './formatters'
import type { SessaoComPaciente } from './types'

interface SessaoCardProps {
  sessao: SessaoComPaciente
  selecionada: boolean
  onSelecionar: () => void
}

const STATUS_VARIANTE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  agendada: 'secondary',
  realizada: 'default',
  remarcada: 'outline',
  cancelada_profissional: 'outline',
  falta_sem_aviso: 'destructive',
  falta_com_aviso: 'destructive'
}

/** Só logística — horário, nome, modalidade, status. Nunca conteúdo clínico (critério de aceite da Etapa 11). */
export function SessaoCard({ sessao, selecionada, onSelecionar }: SessaoCardProps) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      className={`flex w-full flex-col gap-1 rounded-md border p-2 text-left text-xs transition-colors ${
        selecionada ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">{formatarHoraLocal(sessao.inicioUtc)}</span>
        <Badge variant={STATUS_VARIANTE[sessao.status] ?? 'outline'} className="text-[10px]">
          {formatarStatusSessao(sessao.status)}
        </Badge>
      </div>
      <span className="truncate text-foreground">{sessao.pacienteNome}</span>
      <span className="text-muted-foreground">{formatarModalidade(sessao.modalidade)}</span>
    </button>
  )
}
