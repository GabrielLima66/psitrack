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
    <div className="flex flex-col gap-3 rounded-lg border-2 border-warn-border bg-warn-background/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-warn-foreground" />
          <h3 className="text-sm font-semibold text-warn-foreground">Anotações privadas</h3>
        </div>
        {!editandoId && (
          <Button type="button" size="sm" variant="outline" onClick={abrirNova}>
            Nova anotação
          </Button>
        )}
      </div>
      <p className="text-[12.5px] text-warn-foreground/80">
        Não acessível à paciente · Nunca entra em export ou relatório.
      </p>

      {editandoId && (
        <div className="flex flex-col gap-2 rounded-md bg-background/70 p-3">
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
          <p className="text-sm text-warn-foreground/70">Nenhuma anotação registrada ainda.</p>
        )}
        {anotacoes.map((anotacao) => (
          <div key={anotacao.id} className="flex flex-col gap-1 rounded-md border border-warn-border/60 bg-background/50 p-3">
            <div className="flex items-center justify-between gap-2">
              {anotacao.titulo && <span className="text-sm font-medium text-foreground">{anotacao.titulo}</span>}
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(anotacao)}>
                  Editar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void onExcluir(anotacao.id)}>
                  Excluir
                </Button>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap text-foreground">{anotacao.conteudo}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
