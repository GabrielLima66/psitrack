import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useConfiguracoesStore } from './store'

/**
 * Scheduler automático (Etapa 21) — assina os eventos do main a nível de
 * app-shell (mesmo padrão de `vault.onLocked` em `VaultFlow.tsx`), porque o
 * aviso de falha (D41, "nunca silenciosa") e o overlay de fechamento
 * precisam aparecer em qualquer tela, não só em Configurações.
 */
export function BackupAutomaticoOverlay() {
  const aviso = useConfiguracoesStore((s) => s.avisoBackupAutomatico)
  const fechandoComBackup = useConfiguracoesStore((s) => s.fechandoComBackup)
  const registrarResultadoAutomatico = useConfiguracoesStore((s) => s.registrarResultadoAutomatico)
  const mostrarOverlayFechamento = useConfiguracoesStore((s) => s.mostrarOverlayFechamento)
  const dispensarAvisoBackupAutomatico = useConfiguracoesStore((s) => s.dispensarAvisoBackupAutomatico)
  const pularFechamento = useConfiguracoesStore((s) => s.pularFechamento)

  useEffect(() => {
    const cancelarResultado = window.psitrack.backup.onResultadoAutomatico((execucao) => registrarResultadoAutomatico(execucao))
    const cancelarAntesDeFechar = window.psitrack.backup.onAntesDeFechar(() => mostrarOverlayFechamento())
    return () => {
      cancelarResultado()
      cancelarAntesDeFechar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {aviso && (
        <div className="border-b border-warn-border bg-warn-background px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-warn-foreground">
              {!aviso.localOk
                ? `Backup automático falhou: ${aviso.erro ?? 'motivo desconhecido'}.`
                : `Backup automático local ok, mas o destino externo falhou: ${aviso.erro ?? 'motivo desconhecido'}.`}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={dispensarAvisoBackupAutomatico}>
              Dispensar
            </Button>
          </div>
        </div>
      )}

      {fechandoComBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 text-center">
            <p className="text-sm text-foreground">Fazendo backup antes de fechar…</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void pularFechamento()}>
              Pular
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
