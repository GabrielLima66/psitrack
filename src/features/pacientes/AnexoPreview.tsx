import { convertToHtml } from 'mammoth'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Anexo } from './types'

interface AnexoPreviewProps {
  anexo: Anexo
  onClose: () => void
  onLer: (id: string) => Promise<{ bytes: Uint8Array; mime: string; nomeOriginal: string } | null>
}

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Nada aqui toca o disco (D28, I7): blob URL pra PDF/imagem, texto decodificado
 * em memória pra .txt, HTML convertido em memória (mammoth) pra .docx. O
 * unmount (fechar aqui ou o auto-lock chamando onClose) sempre revoga a blob
 * URL no cleanup do efeito, então o plaintext nunca sobrevive além da tela aberta.
 */
export function AnexoPreview({ anexo, onClose, onLer }: AnexoPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [texto, setTexto] = useState<string | null>(null)
  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [docxAvisos, setDocxAvisos] = useState<string[]>([])
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

      if (resultado.mime === 'text/plain') {
        setTexto(new TextDecoder('utf-8').decode(resultado.bytes))
        return
      }

      if (resultado.mime === MIME_DOCX) {
        const bytes = resultado.bytes
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        try {
          const convertido = await convertToHtml({ arrayBuffer })
          if (!ativo) return
          setDocxHtml(convertido.value)
          setDocxAvisos(convertido.messages.map((m) => m.message))
        } catch {
          if (ativo) setErro('Não foi possível converter este .docx pra visualização.')
        }
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

  const carregando = !erro && !blobUrl && texto === null && docxHtml === null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{anexo.nomeOriginal}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="flex flex-1 flex-col overflow-auto rounded-md border border-border bg-muted">
        {erro && <p className="p-4 text-sm text-destructive">{erro}</p>}
        {carregando && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
        {blobUrl && anexo.mime === 'application/pdf' && (
          <embed src={blobUrl} type="application/pdf" className="h-full w-full" />
        )}
        {blobUrl && anexo.mime.startsWith('image/') && (
          <div className="flex flex-1 items-center justify-center">
            <img src={blobUrl} alt={anexo.nomeOriginal} className="max-h-full max-w-full object-contain" />
          </div>
        )}
        {texto !== null && (
          <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[13px] text-foreground">{texto}</pre>
        )}
        {docxHtml !== null && (
          <div className="flex flex-col gap-2 p-4">
            {docxAvisos.length > 0 && (
              <p className="text-xs text-muted-foreground">Alguns elementos deste documento podem não ter sido convertidos fielmente.</p>
            )}
            <div
              className="max-w-none bg-background p-6 text-[13.5px] text-foreground [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_p]:mb-2 [&_p]:leading-relaxed [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:p-1 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5"
              // eslint-disable-next-line react/no-danger -- HTML gerado pelo mammoth a partir do próprio docx, sem <script> (D28: preview em memória, mesmo raciocínio de blob URL)
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
