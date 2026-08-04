import { formatarHoraLocal } from './formatters'
import type { SessaoComPaciente } from './types'

interface SessaoCardProps {
  sessao: SessaoComPaciente
  selecionada: boolean
  onSelecionar: () => void
  top: number
  height: number
}

/** Cor da barra lateral por status — substitui o Badge de status (não cabe num bloco de ~45px de altura). */
const STATUS_BORDA: Record<string, string> = {
  realizada: 'border-l-success',
  agendada: 'border-l-primary',
  falta_sem_aviso: 'border-l-destructive',
  falta_com_aviso: 'border-l-destructive',
  remarcada: 'border-l-muted-foreground',
  cancelada_profissional: 'border-l-muted-foreground'
}

/** Só logística — horário, nome. Nunca conteúdo clínico (critério de aceite da Etapa 11). */
export function SessaoCard({ sessao, selecionada, onSelecionar, top, height }: SessaoCardProps) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      style={{ top, height }}
      className={`absolute right-[3px] left-[3px] overflow-hidden rounded-[7px] border border-l-[3px] bg-card px-[7px] py-1 text-left transition-colors ${
        STATUS_BORDA[sessao.status] ?? 'border-l-muted-foreground'
      } ${selecionada ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
    >
      <span className="block truncate font-mono text-[11.5px] font-medium text-muted-foreground">
        {formatarHoraLocal(sessao.inicioUtc)}
      </span>
      <span className="block truncate text-[12px] font-medium text-foreground">{sessao.pacienteNome}</span>
    </button>
  )
}
