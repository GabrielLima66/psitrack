import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatarDataBr, formatarDataHoraBr, formatarTipoEvolucao } from './formatters'
import type { CriarEvolucaoInput, Evolucao, RetificarEvolucaoInput, TipoEvolucao } from './types'

interface EvolucaoSectionProps {
  pacienteId: string
  evolucoes: Evolucao[]
  onCriar: (input: CriarEvolucaoInput) => Promise<boolean>
  onRetificar: (input: RetificarEvolucaoInput) => Promise<boolean>
  /** Atalho "registrar evolução" clicado a partir de uma sessão na agenda (Etapa 11/D17). */
  prefill?: { sessaoId: string; dataSessao: string } | null
  onPrefillConsumido?: () => void
}

type Modo = 'fechado' | 'nova' | { retificando: string }

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Timeline append-only de verdade: não existe editar nem excluir aqui — só
 * "nova entrada" e "retificar" (que também é só uma entrada nova). A
 * retificação NUNCA esconde o original; as duas linhas ficam visíveis, uma
 * apontando pra outra pela data (SPEC-fase-1.md, regra de exibição crítica).
 */
export function EvolucaoSection({ pacienteId, evolucoes, onCriar, onRetificar, prefill, onPrefillConsumido }: EvolucaoSectionProps) {
  const [modo, setModo] = useState<Modo>('fechado')
  const [conteudo, setConteudo] = useState('')
  const [dataSessao, setDataSessao] = useState(hoje())
  const [tipo, setTipo] = useState<TipoEvolucao>('sessao')
  const [motivoRetificacao, setMotivoRetificacao] = useState('')
  const [sessaoIdAtual, setSessaoIdAtual] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!prefill || modo !== 'fechado') return
    setConteudo('')
    setDataSessao(prefill.dataSessao)
    setTipo('sessao')
    setSessaoIdAtual(prefill.sessaoId)
    setModo('nova')
    onPrefillConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  const porId = new Map(evolucoes.map((entrada) => [entrada.id, entrada]))
  const retificadaPor = new Map<string, Evolucao>()
  for (const entrada of evolucoes) {
    if (entrada.retificaId) retificadaPor.set(entrada.retificaId, entrada)
  }

  function abrirNovaEntrada(): void {
    setConteudo('')
    setDataSessao(hoje())
    setTipo('sessao')
    setSessaoIdAtual(null)
    setModo('nova')
  }

  function abrirRetificacao(original: Evolucao): void {
    setConteudo(original.conteudo)
    setDataSessao(original.dataSessao)
    setTipo(original.tipo)
    setMotivoRetificacao('')
    setSessaoIdAtual(null)
    setModo({ retificando: original.id })
  }

  async function handleSalvar(): Promise<void> {
    setSalvando(true)
    const ok =
      typeof modo === 'object'
        ? await onRetificar({ retificaId: modo.retificando, conteudo, dataSessao, tipo, motivoRetificacao })
        : await onCriar({ pacienteId, conteudo, dataSessao, tipo, sessaoId: sessaoIdAtual })
    setSalvando(false)
    if (ok) setModo('fechado')
  }

  const retificandoOriginal = typeof modo === 'object' ? porId.get(modo.retificando) : undefined

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Evolução clínica</h3>
        {modo === 'fechado' && (
          <Button type="button" size="sm" onClick={abrirNovaEntrada}>
            Nova entrada
          </Button>
        )}
      </div>

      {modo !== 'fechado' && (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
          {retificandoOriginal && (
            <p className="text-[13px] text-muted-foreground">
              Retificando a entrada de {formatarDataBr(retificandoOriginal.dataSessao)}. O texto original continua
              visível na timeline — isto grava uma entrada nova, nunca sobrescreve.
            </p>
          )}
          {sessaoIdAtual && (
            <p className="text-[13px] text-muted-foreground">Vinculada à sessão da agenda selecionada.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="evolucao-data">Data da sessão</Label>
              <Input id="evolucao-data" type="date" value={dataSessao} onChange={(event) => setDataSessao(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(value) => setTipo(value as TipoEvolucao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sessao">Sessão</SelectItem>
                  <SelectItem value="contato">Contato</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="evolucao-conteudo">Conteúdo</Label>
            <Textarea
              id="evolucao-conteudo"
              rows={4}
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
            />
          </div>
          {typeof modo === 'object' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="evolucao-motivo">Motivo da retificação</Label>
              <Input
                id="evolucao-motivo"
                value={motivoRetificacao}
                onChange={(event) => setMotivoRetificacao(event.target.value)}
              />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              disabled={salvando || !conteudo.trim() || (typeof modo === 'object' && !motivoRetificacao.trim())}
              onClick={handleSalvar}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModo('fechado')}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {evolucoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrada registrada ainda.</p>}
        {evolucoes.map((entrada) => {
          const retificacao = retificadaPor.get(entrada.id)
          const original = entrada.retificaId ? porId.get(entrada.retificaId) : undefined

          return (
            <div key={entrada.id} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatarDataBr(entrada.dataSessao)} · {formatarTipoEvolucao(entrada.tipo)}
                </span>
                <span>Registrado em {formatarDataHoraBr(entrada.createdAt)}</span>
              </div>

              {original && (
                <p className="text-[13px] text-muted-foreground">
                  ↳ Retifica entrada de {formatarDataBr(original.dataSessao)} — motivo: {entrada.motivoRetificacao}
                </p>
              )}

              <p className="text-sm whitespace-pre-wrap text-foreground">{entrada.conteudo}</p>

              {retificacao && (
                <p className="text-[13px] text-muted-foreground">
                  Retificada em {formatarDataBr(retificacao.dataSessao)} — o texto corrigido está em outra entrada
                  desta timeline.
                </p>
              )}

              {!retificacao && modo === 'fechado' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => abrirRetificacao(entrada)}
                >
                  Retificar
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
