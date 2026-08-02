import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Anexo } from './types'

interface AnexoPreviewProps {
  anexo: Anexo
  onClose: () => void
  onLer: (id: string) => Promise<{ bytes: Uint8Array; mime: string; nomeOriginal: string } | null>
}

/**
 * Blob URL em memória — nunca escreve o plaintext em disco (D28, I7). O
 * unmount (fechar aqui ou o auto-lock chamando onClose) sempre revoga a URL
 * no cleanup do efeito, então o plaintext nunca sobrevive além da tela aberta.
 */
export function AnexoPreview({ anexo, onClose, onLer }: AnexoPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    let urlCriada: string | null = null

    void (async () => {
      const resultado = await onLer(anexo.id)
      if (!ativo) return
      if (!resultado) {
        setErro('Não foi possível abrir o arquivo.')
        return
      }
      const blob = new Blob([new Uint8Array(resultado.bytes)], { type: resultado.mime })
      urlCriada = URL.createObjectURL(blob)
      setBlobUrl(urlCriada)
    })()

    return () => {
      ativo = false
      if (urlCriada) URL.revokeObjectURL(urlCriada)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexo.id])

  // Auto-lock zera a DEK no main (CLAUDE.md invariante #6) — o preview tem
  // que sumir junto, nunca continuar mostrando conteúdo clínico decifrado
  // depois que a sessão travou.
  useEffect(() => window.psitrack.vault.onLocked(onClose), [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{anexo.nomeOriginal}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto rounded-md border border-border bg-muted">
        {erro && <p className="p-4 text-sm text-destructive">{erro}</p>}
        {!erro && !blobUrl && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {blobUrl && anexo.mime === 'application/pdf' && (
          <embed src={blobUrl} type="application/pdf" className="h-full w-full" />
        )}
        {blobUrl && anexo.mime.startsWith('image/') && (
          <img src={blobUrl} alt={anexo.nomeOriginal} className="max-h-full max-w-full object-contain" />
        )}
      </div>
    </div>
  )
}
