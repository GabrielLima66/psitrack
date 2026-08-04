import { formatarDataHoraBr } from './formatters'
import type { ExecucaoBackupAutomatico } from './types'

interface HistoricoAutomaticoSectionProps {
  historico: ExecucaoBackupAutomatico[]
}

const GATILHO_LABELS: Record<ExecucaoBackupAutomatico['gatilho'], string> = {
  destrancar: 'Ao destrancar',
  fechar: 'Ao fechar o app'
}

function resultadoLabel(execucao: ExecucaoBackupAutomatico): string {
  if (!execucao.localOk) return `Falhou — ${execucao.erro ?? 'motivo desconhecido'}`
  if (execucao.destinoOk === false) return 'Parcial — destino externo falhou'
  if (execucao.destinoOk === true) return 'OK (local + destino externo)'
  return 'OK (local)'
}

/** Scheduler automático (Etapa 21): últimas execuções, quando/gatilho/resultado — só leitura, sem ação aqui. */
export function HistoricoAutomaticoSection({ historico }: HistoricoAutomaticoSectionProps) {
  if (historico.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">Backups automáticos</h2>
      <div className="flex flex-col gap-1">
        {historico.map((execucao, indice) => (
          <div key={`${execucao.executadoEm}-${indice}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{formatarDataHoraBr(execucao.executadoEm)}</span>
            <span className="text-xs text-muted-foreground">{GATILHO_LABELS[execucao.gatilho]}</span>
            <span className={execucao.localOk && execucao.destinoOk !== false ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
              {resultadoLabel(execucao)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
