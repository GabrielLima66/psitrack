import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatarDiaSemanaAbrev } from '../agenda/formatters'
import type { ConflitoRecorrencia } from '../agenda/types'

interface ConflitoRecorrenciaDialogProps {
  conflitos: ConflitoRecorrencia[]
  onMudarHorario: () => void
  onCriarMesmoAssim: () => void
}

/**
 * Aviso, não bloqueio (mesmo critério de `sobreposicaoHorario`/D-Etapa 11):
 * "Criar assim mesmo" sempre disponível — a psicóloga pode ter um motivo
 * válido (ex.: dois horários que na prática nunca colidem por outro
 * arranjo). O popup só garante que a decisão é consciente, não decide por ela.
 */
export function ConflitoRecorrenciaDialog({ conflitos, onMudarHorario, onCriarMesmoAssim }: ConflitoRecorrenciaDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-[0.625rem] border border-warn-border bg-card p-5 shadow-lg">
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-[17px] shrink-0 text-warn-foreground" />
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[14.5px] font-semibold text-foreground">Esse horário já está ocupado</h3>
            <div className="flex flex-col gap-1">
              {conflitos.map((conflito) => (
                <p key={conflito.recorrenciaId} className="text-[13px] leading-[1.55] text-muted-foreground">
                  <span className="font-medium text-foreground">{conflito.pacienteNome}</span> já tem horário fixo toda{' '}
                  {formatarDiaSemanaAbrev(conflito.diaSemana)} às <span className="font-mono">{conflito.horaLocal}</span>.
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onMudarHorario}>
            Mudar horário
          </Button>
          <Button type="button" onClick={onCriarMesmoAssim}>
            Criar assim mesmo
          </Button>
        </div>
      </div>
    </div>
  )
}
