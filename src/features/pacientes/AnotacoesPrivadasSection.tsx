import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Anotacao, AnotacaoInput } from './types'

interface AnotacoesPrivadasSectionProps {
  anotacoes: Anotacao[]
  onCriar: (input: AnotacaoInput) => Promise<void>
  onAtualizar: (id: string, input: AnotacaoInput) => Promise<void>
  onExcluir: (id: string) => Promise<void>
}

/**
 * Visual de propósito diferente da evolução (cor de aviso + cadeado, mesmos
 * tokens warn-* da revelação da recovery key) — "distinguível à primeira
 * vista, sem ler o texto" (SPEC-fase-1.md). Edição e exclusão são livres
 * aqui: sem trigger, sem append-only, ao contrário de prontuario_evolucao.
 */
export function AnotacoesPrivadasSection({ anotacoes, onCriar, onAtualizar, onExcluir }: AnotacoesPrivadasSectionProps) {
  const [editandoId, setEditandoId] = useState<string | 'nova' | null>(null)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [salvando, setSalvando] = useState(false)

  function abrirNova(): void {
    setTitulo('')
    setConteudo('')
    setEditandoId('nova')
  }

  function abrirEdicao(anotacao: Anotacao): void {
    setTitulo(anotacao.titulo ?? '')
    setConteudo(anotacao.conteudo)
    setEditandoId(anotacao.id)
  }

  async function handleSalvar(): Promise<void> {
    setSalvando(true)
    if (editandoId === 'nova') {
      await onCriar({ titulo: titulo.trim() || null, conteudo })
    } else if (editandoId) {
      await onAtualizar(editandoId, { titulo: titulo.trim() || null, conteudo })
    }
    setSalvando(false)
    setEditandoId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-warn-border bg-warn-background p-[16px_18px]">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 size-[17px] shrink-0 text-warn-foreground" />
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[13.5px] font-semibold text-warn-foreground">Anotações privadas</h3>
            <p className="text-[13px] text-warn-foreground/80">
              Não acessível à paciente. Nunca entra em export, relatório ou documento entregue.
            </p>
          </div>
        </div>
        {!editandoId && (
          <Button type="button" className="h-[30px] shrink-0 border-warn-border text-warn-foreground hover:bg-warn-background" variant="outline" onClick={abrirNova}>
            Nova anotação
          </Button>
        )}
      </div>

      {editandoId && (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
          <Input placeholder="Título (opcional)" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
          <Textarea rows={4} value={conteudo} onChange={(event) => setConteudo(event.target.value)} />
          <div className="flex gap-2">
            <Button type="button" disabled={salvando || !conteudo.trim()} onClick={handleSalvar}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditandoId(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {anotacoes.length === 0 && !editandoId && (
          <p className="text-sm text-muted-foreground">Nenhuma anotação registrada ainda.</p>
        )}
        {anotacoes.map((anotacao) => (
          <div key={anotacao.id} className="flex flex-col gap-1.5 rounded-[0.625rem] border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              {anotacao.titulo && <span className="text-[13.5px] font-medium text-foreground">{anotacao.titulo}</span>}
              <div className="ml-auto flex gap-3">
                <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(anotacao)}>
                  Editar
                </button>
                <button type="button" className="text-[12.5px] text-muted-foreground hover:text-foreground" onClick={() => void onExcluir(anotacao.id)}>
                  Excluir
                </button>
              </div>
            </div>
            <p className="text-[14px] leading-[1.65] whitespace-pre-wrap text-foreground">{anotacao.conteudo}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
