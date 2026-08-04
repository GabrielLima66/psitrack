import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatarBytes, formatarDataHoraBr } from './formatters'
import type { BackupListado, BackupVerificationResult } from './types'

interface BackupItemProps {
  backup: BackupListado
  verificando: boolean
  resultadoVerificacao: BackupVerificationResult | null
  restaurando: boolean
  onVerificar: () => void
  onRestaurar: () => void
}

/**
 * "Restaurar" é a primeira ação realmente destrutiva/difícil de reverter do
 * app (substitui banco, keys.json e anexos inteiros) — por isso é a única
 * com confirmação em duas etapas: o primeiro clique só abre o aviso, um
 * segundo botão com rótulo distinto é que de fato dispara.
 */
export function BackupItem({ backup, verificando, resultadoVerificacao, restaurando, onVerificar, onRestaurar }: BackupItemProps) {
  const [confirmando, setConfirmando] = useState(false)

  const pacientes = backup.manifest.verification.rowCounts.pacientes ?? 0
  const anexos = backup.manifest.blobs.total

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={backup.origem === 'manual' ? 'neutral' : 'outline'}>
            {backup.origem === 'manual' ? 'Manual' : 'Segurança pré-restauração'}
          </Badge>
          <span className="text-sm text-foreground">{formatarDataHoraBr(backup.manifest.createdAt)}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatarBytes(backup.tamanhoBytes)} · {pacientes} paciente(s) · {anexos} anexo(s)
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={verificando} onClick={onVerificar}>
          {verificando ? 'Verificando…' : 'Verificar'}
        </Button>
        {!confirmando && (
          <Button type="button" variant="outline" size="sm" disabled={restaurando} onClick={() => setConfirmando(true)}>
            Restaurar este backup
          </Button>
        )}
      </div>

      {resultadoVerificacao && (
        <Alert variant={resultadoVerificacao.ok ? 'default' : 'destructive'}>
          <AlertDescription>
            {resultadoVerificacao.ok
              ? 'Verificado — íntegro.'
              : `Problemas encontrados: ${resultadoVerificacao.blobs.problemas.join('; ') || 'integridade do banco falhou'}`}
          </AlertDescription>
        </Alert>
      )}

      {confirmando && (
        <Alert variant="destructive">
          <TriangleAlert className="size-[17px]" />
          <AlertTitle>Restaurar este backup</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Isso vai substituir TODO o estado atual do app (pacientes, prontuário, agenda,
              financeiro e anexos) pelo conteúdo deste backup de {formatarDataHoraBr(backup.manifest.createdAt)}.
              Um snapshot de segurança do estado atual é criado automaticamente antes de sobrescrever
              — mas essa ação não é instantaneamente reversível. O app vai fechar e reabrir sozinho em
              seguida.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" size="sm" disabled={restaurando} onClick={onRestaurar}>
                {restaurando ? 'Restaurando…' : 'Sim, restaurar e reiniciar o app'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
