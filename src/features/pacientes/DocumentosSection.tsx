import { FileText, Lock, Paperclip, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AnexoPreview } from './AnexoPreview'
import { formatarBytes, formatarClassificacaoAnexo, formatarDataHoraBr } from './formatters'
import type { Anexo, AnexarViaDialogoInput, ClassificacaoAnexo } from './types'

interface DocumentosSectionProps {
  anexos: Anexo[]
  anexosLixeira: Anexo[]
  busy: boolean
  error: string | null
  onAnexar: (input: AnexarViaDialogoInput) => Promise<boolean>
  onExcluir: (id: string) => Promise<void>
  onRestaurar: (id: string) => Promise<void>
  onLer: (id: string) => Promise<{ bytes: Uint8Array; mime: string; nomeOriginal: string } | null>
  onSalvarCopia: (id: string) => Promise<void>
}

function temPreview(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/')
}

/**
 * Aba Documentos (Etapa 16). `privado` usa o mesmo visual de aviso da aba de
 * anotações privadas (tokens warn-* + cadeado) — mesmo motivo: distinguível
 * à primeira vista, sem ler nome nem descrição (SPEC-fase-3.md).
 */
export function DocumentosSection({
  anexos,
  anexosLixeira,
  busy,
  error,
  onAnexar,
  onExcluir,
  onRestaurar,
  onLer,
  onSalvarCopia
}: DocumentosSectionProps) {
  const [anexando, setAnexando] = useState(false)
  const [classificacao, setClassificacao] = useState<ClassificacaoAnexo>('prontuario')
  const [descricao, setDescricao] = useState('')
  const [mostrarLixeira, setMostrarLixeira] = useState(false)
  const [previewAnexo, setPreviewAnexo] = useState<Anexo | null>(null)

  async function handleAnexar(): Promise<void> {
    const ok = await onAnexar({ classificacao, descricao: descricao.trim() || null })
    if (ok) {
      setAnexando(false)
      setDescricao('')
      setClassificacao('prontuario')
    }
  }

  const lista = mostrarLixeira ? anexosLixeira : anexos

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Documentos</h3>
        <div className="flex items-center gap-3">
          <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => setMostrarLixeira((v) => !v)}>
            {mostrarLixeira ? 'Ver ativos' : `Lixeira (${anexosLixeira.length})`}
          </button>
          {!anexando && !mostrarLixeira && (
            <Button type="button" className="h-8" onClick={() => setAnexando(true)}>
              <Paperclip className="size-4" />
              Anexar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-[20px_18px]">

      {error && <p className="text-sm text-destructive">{error}</p>}

      {anexando && (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label>Classificação</Label>
              <Select value={classificacao} onValueChange={(value) => setClassificacao(value as ClassificacaoAnexo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prontuario">Prontuário (acessível à paciente, entra em export)</SelectItem>
                  <SelectItem value="privado">Privado (nunca entra em export)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="anexo-descricao">Descrição (opcional)</Label>
              <Input id="anexo-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={handleAnexar}>
              {busy ? 'Escolhendo arquivo…' : 'Escolher arquivo…'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAnexando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {mostrarLixeira ? 'Lixeira vazia.' : 'Nenhum documento anexado ainda.'}
          </p>
        )}
        {lista.map((anexo) => (
          <div
            key={anexo.id}
            className={
              anexo.classificacao === 'privado'
                ? 'flex items-center justify-between gap-3 rounded-[0.625rem] border border-warn-border/60 bg-warn-background/50 px-4 py-[13px]'
                : 'flex items-center justify-between gap-3 rounded-[0.625rem] border border-border px-4 py-[13px]'
            }
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {anexo.classificacao === 'privado' ? (
                <Lock className="size-4 shrink-0 text-warn-foreground" />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-[13.5px] font-medium text-foreground">{anexo.nomeOriginal}</span>
                <span className="text-xs text-muted-foreground">
                  {formatarBytes(anexo.tamanhoBytes)} · {formatarClassificacaoAnexo(anexo.classificacao)} ·{' '}
                  {formatarDataHoraBr(anexo.createdAt)}
                  {anexo.descricao ? ` · ${anexo.descricao}` : ''}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {temPreview(anexo.mime) && (
                <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => setPreviewAnexo(anexo)}>
                  Visualizar
                </button>
              )}
              <button
                type="button"
                className="text-[12.5px] text-muted-foreground hover:text-foreground"
                title="Copia o arquivo decifrado pra fora da proteção do app"
                onClick={() => void onSalvarCopia(anexo.id)}
              >
                Salvar cópia
              </button>
              {mostrarLixeira ? (
                <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => void onRestaurar(anexo.id)}>
                  Restaurar
                </button>
              ) : (
                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => void onExcluir(anexo.id)}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>

      {previewAnexo && <AnexoPreview anexo={previewAnexo} onClose={() => setPreviewAnexo(null)} onLer={onLer} />}
    </div>
  )
}
