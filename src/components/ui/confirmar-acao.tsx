import { TriangleAlert } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Button } from './button'
import { Label } from './label'
import { Textarea } from './textarea'

interface ConfirmarAcaoProps {
  rotulo: string
  titulo: string
  descricao: ReactNode
  rotuloConfirmar: string
  variant?: 'warn' | 'destructive'
  pedirMotivo?: boolean
  motivoLabel?: string
  busy?: boolean
  disabled?: boolean
  className?: string
  onConfirmar: (motivo?: string) => void | Promise<void>
}

/**
 * Padrão de confirmação inline já usado em BackupItem/RetencaoSection
 * (Configurações), extraído aqui porque a Parte A do financeiro revertível
 * precisa dele em ~5 lugares diferentes — copiar/colar deixou de compensar.
 * Nunca é modal: primeiro clique só abre o aviso no lugar, um segundo botão
 * com rótulo específico é que dispara.
 */
export function ConfirmarAcao({
  rotulo,
  titulo,
  descricao,
  rotuloConfirmar,
  variant = 'warn',
  pedirMotivo = false,
  motivoLabel = 'Motivo',
  busy: busyExterno,
  disabled,
  className,
  onConfirmar
}: ConfirmarAcaoProps) {
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const busy = busyExterno ?? enviando
  const motivoValido = !pedirMotivo || motivo.trim().length > 0

  function abrir(): void {
    setMotivo('')
    setConfirmando(true)
  }

  function cancelar(): void {
    setConfirmando(false)
    setMotivo('')
  }

  async function confirmar(): Promise<void> {
    if (!motivoValido) return
    setEnviando(true)
    try {
      await onConfirmar(pedirMotivo ? motivo.trim() : undefined)
      setConfirmando(false)
      setMotivo('')
    } finally {
      setEnviando(false)
    }
  }

  if (!confirmando) {
    return (
      <Button type="button" variant="outline" size="sm" className={className} disabled={disabled} onClick={abrir}>
        {rotulo}
      </Button>
    )
  }

  return (
    <Alert variant={variant} className={className}>
      <TriangleAlert className="size-[17px]" />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <div>{descricao}</div>
        {pedirMotivo && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="confirmar-acao-motivo">{motivoLabel}</Label>
            <Textarea
              id="confirmar-acao-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            size="sm"
            disabled={busy || !motivoValido}
            onClick={confirmar}
          >
            {busy ? 'Aguarde…' : rotuloConfirmar}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={cancelar}>
            Cancelar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
