import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { diasDesde, formatarDataHoraBr } from './formatters'
import type { BackupVerificationResult } from './types'

interface DestinoBackupSectionProps {
  destino: string | null
  ultimoBackupExternoEm: string | null
  configurando: boolean
  error: string | null
  verificacao: BackupVerificationResult | null
  verificando: boolean
  onConfigurar: () => void
  onRemover: () => void
  onVerificar: () => void
}

const LIMITE_DEFASAGEM_DIAS = 7

/**
 * Configurar destino não é destrutivo (não sobrescreve nada na hora), mas
 * tem consequência de segurança real — por isso o aviso vem antes do
 * diálogo de pasta, não depois: pasta sincronizada tira o ciphertext da
 * máquina, e a recovery key vira a única barreira que resta (D36/D37).
 */
export function DestinoBackupSection({
  destino,
  ultimoBackupExternoEm,
  configurando,
  error,
  verificacao,
  verificando,
  onConfigurar,
  onRemover,
  onVerificar
}: DestinoBackupSectionProps) {
  const [avisoAberto, setAvisoAberto] = useState(false)

  function handleEntendiEConfigurar(): void {
    setAvisoAberto(false)
    onConfigurar()
  }

  const dias = ultimoBackupExternoEm ? diasDesde(ultimoBackupExternoEm) : null
  const defasado = dias !== null && dias > LIMITE_DEFASAGEM_DIAS

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Destino externo</h2>
        <p className="text-xs text-muted-foreground">
          Pendrive, HD externo ou pasta sincronizada — cópia adicional, nunca substitui a local.
        </p>
      </div>

      {!destino && !avisoAberto && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setAvisoAberto(true)}>
          Configurar pasta de destino
        </Button>
      )}

      {avisoAberto && (
        <Alert variant="warn">
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Se a pasta escolhida for sincronizada com nuvem (Google Drive, OneDrive, Dropbox,
              etc.), o backup cifrado vai sair deste computador. A senha mestra e a recovery key
              continuam sendo a única proteção dele — confirme que a recovery key está guardada num
              lugar seguro e separado antes de continuar.
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={configurando} onClick={handleEntendiEConfigurar}>
                {configurando ? 'Abrindo…' : 'Entendi, escolher pasta'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvisoAberto(false)}>
                Cancelar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {destino && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground break-all">{destino}</p>
          <p className="text-xs text-warn-foreground">
            Se esta pasta for sincronizada com nuvem, o backup cifrado sai deste computador — a senha mestra e a
            recovery key passam a ser a única proteção dele.
          </p>
          <p className={defasado ? 'text-sm font-medium text-destructive' : 'text-xs text-muted-foreground'}>
            {ultimoBackupExternoEm
              ? `Último backup externo: há ${dias} dia(s) — ${formatarDataHoraBr(ultimoBackupExternoEm)}`
              : 'Ainda sem backup externo bem-sucedido nesta pasta.'}
          </p>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={verificando} onClick={onVerificar}>
              {verificando ? 'Verificando…' : 'Verificar'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemover}>
              Remover destino
            </Button>
          </div>

          {verificacao && (
            <Alert variant={verificacao.ok ? 'default' : 'destructive'}>
              <AlertDescription>
                {verificacao.ok
                  ? 'Verificado — íntegro.'
                  : `Problemas encontrados: ${verificacao.blobs.problemas.join('; ') || 'integridade do banco falhou'}`}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
