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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Documentos</h3>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMostrarLixeira((v) => !v)}>
            {mostrarLixeira ? 'Ver ativos' : `Lixeira (${anexosLixeira.length})`}
          </Button>
          {!anexando && !mostrarLixeira && (
            <Button type="button" size="sm" onClick={() => setAnexando(true)}>
              <Paperclip className="size-4" />
              Anexar
            </Button>
          )}
        </div>
      </div>

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
                ? 'flex items-center justify-between gap-2 rounded-md border border-warn-border/60 bg-warn-background/50 p-3'
                : 'flex items-center justify-between gap-2 rounded-md border border-border p-3'
            }
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {anexo.classificacao === 'privado' ? (
                <Lock className="size-4 shrink-0 text-warn-foreground" />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm text-foreground">{anexo.nomeOriginal}</span>
                <span className="text-xs text-muted-foreground">
                  {formatarBytes(anexo.tamanhoBytes)} · {formatarClassificacaoAnexo(anexo.classificacao)} ·{' '}
                  {formatarDataHoraBr(anexo.createdAt)}
                  {anexo.descricao ? ` · ${anexo.descricao}` : ''}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {temPreview(anexo.mime) && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewAnexo(anexo)}>
                  Visualizar
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" title="Copia o arquivo decifrado pra fora da proteção do app" onClick={() => void onSalvarCopia(anexo.id)}>
                Salvar cópia
              </Button>
              {mostrarLixeira ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void onRestaurar(anexo.id)}>
                  Restaurar
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => void onExcluir(anexo.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {previewAnexo && <AnexoPreview anexo={previewAnexo} onClose={() => setPreviewAnexo(null)} onLer={onLer} />}
    </div>
  )
}
