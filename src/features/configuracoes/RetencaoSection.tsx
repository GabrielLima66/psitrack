import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatarBytes } from './formatters'
import type { PreviewPurga, ResultadoPurga } from './types'

interface RetencaoSectionProps {
  preview: PreviewPurga | null
  purgando: boolean
  error: string | null
  ultimaPurga: ResultadoPurga | null
  onPurgar: () => void
}

/**
 * Retenção GFS (Etapa 20, D39): 7 diários + 4 semanais + 6 mensais, local e
 * externo. Purgar backups antigos é irreversível (embora não seja dado
 * clínico vivo, como o restore) — por isso tem uma confirmação de um clique
 * extra, mas não o painel pesado do restore.
 */
export function RetencaoSection({ preview, purgando, error, ultimaPurga, onPurgar }: RetencaoSectionProps) {
  const [confirmando, setConfirmando] = useState(false)

  if (!preview) return null

  const aLiberarBytes =
    preview.local.aLiberarBytes + (preview.externo?.aLiberarBytes ?? 0) + (preview.externo?.poolALiberarBytes ?? 0)
  const backupsAPurgar = preview.local.purgar + (preview.externo?.purgar ?? 0)

  function handlePurgar(): void {
    setConfirmando(false)
    onPurgar()
  }

  return (
    <div className="flex flex-col gap-3 rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
      {backupsAPurgar > 0 ? (
        <p className="text-sm text-muted-foreground">
          Uma purga agora liberaria {formatarBytes(aLiberarBytes)} ({backupsAPurgar} backup(s) fora da retenção).
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Nada fora da retenção agora — nenhuma purga necessária.</p>
      )}

      {!confirmando && backupsAPurgar > 0 && (
        <Button type="button" variant="outline" size="sm" className="self-start" disabled={purgando} onClick={() => setConfirmando(true)}>
          Purgar agora
        </Button>
      )}

      {confirmando && (
        <Alert variant="destructive">
          <TriangleAlert className="size-[17px]" />
          <AlertTitle>Purgar backups fora da retenção</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Isso apaga permanentemente os {backupsAPurgar} backup(s) fora da política de retenção. Os mais
              recentes (diários/semanais/mensais) continuam guardados.
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={purgando} onClick={handlePurgar}>
                {purgando ? 'Purgando…' : 'Sim, purgar agora'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {ultimaPurga && (
        <p className="text-xs text-muted-foreground">
          Última purga: {ultimaPurga.local.purgar.length} local(is)
          {ultimaPurga.externo ? ` · ${ultimaPurga.externo.purgar.length} externo(s) · ${ultimaPurga.externo.blobsPurgadosDoPool.length} blob(s) órfão(s) removido(s) do pool` : ''}.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
