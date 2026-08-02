import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ContratoPreco, ContratoPrecoInput, Lancamento, LancamentoAjusteInput, MarcarReciboEmitidoInput, Pagamento, PoliticaFalta } from '../agenda/types'
import {
  formatarCentavos,
  formatarCompetencia,
  formatarDataBr,
  formatarMeioPagamento,
  formatarModalidadeContrato,
  formatarPoliticaFalta,
  formatarStatusLancamento,
  formatarTipoLancamento
} from './formatters'

interface FinanceiroSectionProps {
  contratoVigente: ContratoPreco | null
  historicoContratos: ContratoPreco[]
  lancamentos: Lancamento[]
  pagamentos: Pagamento[]
  onReajustar: (input: ContratoPrecoInput) => Promise<number | null>
  onCriarAjuste: (input: LancamentoAjusteInput) => Promise<boolean>
  onCancelarLancamento: (id: string) => Promise<void>
  onMarcarReciboEmitido: (pagamentoId: string, input: MarcarReciboEmitidoInput) => Promise<void>
}

const POLITICA_OPTIONS: { value: PoliticaFalta; label: string }[] = [
  { value: 'cobra_sempre', label: 'Cobra sempre' },
  { value: 'cobra_sem_aviso', label: 'Cobra só sem aviso prévio' },
  { value: 'nunca_cobra', label: 'Nunca cobra falta' }
]

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Aba Financeiro da ficha (Etapa 12): contrato vigente, histórico de vigências, reajuste e lançamentos por competência. */
export function FinanceiroSection({
  contratoVigente,
  historicoContratos,
  lancamentos,
  pagamentos,
  onReajustar,
  onCriarAjuste,
  onCancelarLancamento,
  onMarcarReciboEmitido
}: FinanceiroSectionProps) {
  const [reajustando, setReajustando] = useState(false)
  const [novoValor, setNovoValor] = useState('')
  const [novaModalidade, setNovaModalidade] = useState<'avulso' | 'mensal'>('avulso')
  const [novaPolitica, setNovaPolitica] = useState<PoliticaFalta>('cobra_sem_aviso')
  const [novaVigencia, setNovaVigencia] = useState(hoje())
  const [avisoLancamentos, setAvisoLancamentos] = useState<number | null>(null)

  const [emitindoReciboId, setEmitindoReciboId] = useState<string | null>(null)
  const [reciboData, setReciboData] = useState(hoje())
  const [reciboReferencia, setReciboReferencia] = useState('')

  const [ajustando, setAjustando] = useState(false)
  const [ajusteTipo, setAjusteTipo] = useState<'ajuste' | 'desconto'>('ajuste')
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteDescricao, setAjusteDescricao] = useState('')
  const [ajusteCompetencia, setAjusteCompetencia] = useState(hoje().slice(0, 7))

  async function handleReajustar(): Promise<void> {
    const valorCentavos = Math.round(Number(novoValor || 0) * 100)
    const resultado = await onReajustar({
      modalidade: novaModalidade,
      valorCentavos,
      politicaFalta: novaPolitica,
      vigenciaInicio: novaVigencia
    })
    if (resultado !== null) {
      setAvisoLancamentos(resultado)
      setReajustando(false)
      setNovoValor('')
    }
  }

  async function handleCriarAjuste(): Promise<void> {
    const sinal = ajusteTipo === 'desconto' ? -1 : 1
    const valorCentavos = sinal * Math.abs(Math.round(Number(ajusteValor || 0) * 100))
    const ok = await onCriarAjuste({ tipo: ajusteTipo, valorCentavos, descricao: ajusteDescricao, competencia: ajusteCompetencia })
    if (ok) {
      setAjustando(false)
      setAjusteValor('')
      setAjusteDescricao('')
    }
  }

  function abrirEmitirRecibo(pagamentoId: string): void {
    setEmitindoReciboId(pagamentoId)
    setReciboData(hoje())
    setReciboReferencia('')
  }

  async function handleMarcarRecibo(): Promise<void> {
    if (!emitindoReciboId) return
    await onMarcarReciboEmitido(emitindoReciboId, { data: reciboData, referencia: reciboReferencia })
    setEmitindoReciboId(null)
  }

  const lancamentosPorCompetencia = new Map<string, Lancamento[]>()
  for (const l of lancamentos) {
    const grupo = lancamentosPorCompetencia.get(l.competencia) ?? []
    grupo.push(l)
    lancamentosPorCompetencia.set(l.competencia, grupo)
  }
  const competencias = [...lancamentosPorCompetencia.keys()].sort().reverse()

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Contrato vigente</h3>
        {contratoVigente ? (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-foreground">
              {contratoVigente.valorCentavos != null ? formatarCentavos(contratoVigente.valorCentavos) : '—'} ·{' '}
              {formatarModalidadeContrato(contratoVigente.modalidade)}
            </span>
            <span className="text-muted-foreground">{formatarPoliticaFalta(contratoVigente.politicaFalta)}</span>
            <span className="text-muted-foreground">Desde {formatarDataBr(contratoVigente.vigenciaInicio)}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum contrato vigente — sessões realizadas ficam sinalizadas como pendência.</p>
        )}

        {!reajustando ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setReajustando(true)}>
            Reajustar preço
          </Button>
        ) : (
          <div className="mt-3 flex flex-col gap-2 rounded-md bg-muted p-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="reajuste-valor">Novo valor (R$)</Label>
                <Input id="reajuste-valor" type="number" min={0} step="0.01" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Modalidade</Label>
                <Select value={novaModalidade} onValueChange={(v) => setNovaModalidade(v as 'avulso' | 'mensal')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avulso">Avulso</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Política de falta</Label>
                <Select value={novaPolitica} onValueChange={(v) => setNovaPolitica(v as PoliticaFalta)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLITICA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="reajuste-vigencia">Vigente a partir de</Label>
                <Input id="reajuste-vigencia" type="date" value={novaVigencia} onChange={(e) => setNovaVigencia(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleReajustar}>
                Confirmar reajuste
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setReajustando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {avisoLancamentos !== null && avisoLancamentos > 0 && (
          <Alert variant="warn" className="mt-3">
            <AlertDescription>
              {avisoLancamentos} lançamento(s) já existem no período afetado por este reajuste — eles NÃO serão alterados
              (o valor de um lançamento é sempre congelado na criação).
            </AlertDescription>
          </Alert>
        )}

        {historicoContratos.length > 1 && (
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Histórico de vigências ({historicoContratos.length})</summary>
            <div className="mt-1 flex flex-col gap-1">
              {historicoContratos.map((c) => (
                <span key={c.id}>
                  Desde {formatarDataBr(c.vigenciaInicio)}: {c.valorCentavos != null ? formatarCentavos(c.valorCentavos) : '—'} ·{' '}
                  {formatarModalidadeContrato(c.modalidade)}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Lançamentos</h3>
          {!ajustando && (
            <Button type="button" variant="outline" size="sm" onClick={() => setAjustando(true)}>
              Lançamento manual
            </Button>
          )}
        </div>

        {ajustando && (
          <div className="mb-3 flex flex-col gap-2 rounded-md bg-muted p-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <Label>Tipo</Label>
                <Select value={ajusteTipo} onValueChange={(v) => setAjusteTipo(v as 'ajuste' | 'desconto')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="desconto">Desconto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ajuste-valor">Valor (R$)</Label>
                <Input id="ajuste-valor" type="number" min={0} step="0.01" value={ajusteValor} onChange={(e) => setAjusteValor(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ajuste-competencia">Competência</Label>
                <Input
                  id="ajuste-competencia"
                  type="month"
                  value={ajusteCompetencia}
                  onChange={(e) => setAjusteCompetencia(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ajuste-descricao">Descrição</Label>
                <Input id="ajuste-descricao" value={ajusteDescricao} onChange={(e) => setAjusteDescricao(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={!ajusteValor || !ajusteDescricao.trim()} onClick={handleCriarAjuste}>
                Salvar lançamento
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAjustando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {competencias.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>}
        {competencias.map((competencia) => (
          <div key={competencia} className="mb-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{formatarCompetencia(competencia)}</p>
            <div className="flex flex-col gap-1">
              {lancamentosPorCompetencia.get(competencia)!.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-foreground">
                      {formatarTipoLancamento(l.tipo)} · {formatarCentavos(l.valorCentavos)}
                    </span>
                    <span className="text-xs text-muted-foreground">{l.descricao}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === 'pago' ? 'default' : l.status === 'cancelado' ? 'outline' : 'secondary'}>
                      {formatarStatusLancamento(l.status)}
                    </Badge>
                    {l.status === 'pendente' && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => onCancelarLancamento(l.id)}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Pagamentos</h3>
        {pagamentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>}
        <div className="flex flex-col gap-2">
          {pagamentos.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground">
                  {formatarCentavos(p.valorCentavos)} · {formatarMeioPagamento(p.meio)} · {formatarDataBr(p.data)}
                </span>
                {p.reciboEmitidoEm ? (
                  <span className="text-xs text-muted-foreground">
                    Recibo emitido em {formatarDataBr(p.reciboEmitidoEm)} — ref. {p.reciboReferencia}
                  </span>
                ) : (
                  emitindoReciboId !== p.id && (
                    <Button type="button" variant="outline" size="sm" onClick={() => abrirEmitirRecibo(p.id)}>
                      Marcar recibo emitido
                    </Button>
                  )
                )}
              </div>
              <span className="text-xs text-muted-foreground">Pagador: {p.pagadorNome}{p.pagadorCpf ? ` (${p.pagadorCpf})` : ''}</span>

              {emitindoReciboId === p.id && (
                <div className="flex items-end gap-2 rounded-md bg-muted p-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`recibo-data-${p.id}`}>Data</Label>
                    <Input id={`recibo-data-${p.id}`} type="date" value={reciboData} onChange={(e) => setReciboData(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`recibo-referencia-${p.id}`}>Referência</Label>
                    <Input
                      id={`recibo-referencia-${p.id}`}
                      value={reciboReferencia}
                      onChange={(e) => setReciboReferencia(e.target.value)}
                    />
                  </div>
                  <Button type="button" size="sm" disabled={!reciboReferencia.trim()} onClick={handleMarcarRecibo}>
                    Confirmar
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEmitindoReciboId(null)}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
