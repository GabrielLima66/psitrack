import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type {
  ContratoPreco,
  ContratoPrecoInput,
  EstornarPagamentoInput,
  Lancamento,
  LancamentoAjusteInput,
  MarcarReciboEmitidoInput,
  Pagamento,
  PoliticaFalta
} from '../agenda/types'
import { ChevronDown } from 'lucide-react'
import { formatarDataHoraBr } from '../configuracoes/formatters'
import { hojeLocal as hoje } from '../agenda/tempo'
import {
  formatarCentavos,
  formatarCompetencia,
  formatarDataBr,
  formatarDataCurtaUtc,
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
  onReabrirLancamento: (id: string) => Promise<void>
  onMarcarReciboEmitido: (pagamentoId: string, input: MarcarReciboEmitidoInput) => Promise<void>
  onEstornarPagamento: (pagamentoId: string, input: EstornarPagamentoInput) => Promise<boolean>
}

const POLITICA_OPTIONS: { value: PoliticaFalta; label: string }[] = [
  { value: 'cobra_sempre', label: 'Cobra sempre' },
  { value: 'cobra_sem_aviso', label: 'Cobra só sem aviso prévio' },
  { value: 'nunca_cobra', label: 'Nunca cobra falta' }
]

/** Aba Financeiro da ficha (Etapa 12): contrato vigente, histórico de vigências, reajuste e lançamentos por competência. */
export function FinanceiroSection({
  contratoVigente,
  historicoContratos,
  lancamentos,
  pagamentos,
  onReajustar,
  onCriarAjuste,
  onCancelarLancamento,
  onReabrirLancamento,
  onMarcarReciboEmitido,
  onEstornarPagamento
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

  const [historicoAberto, setHistoricoAberto] = useState(false)

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

  function abrirEmitirRecibo(pagamento: Pagamento): void {
    setEmitindoReciboId(pagamento.id)
    setReciboData(pagamento.reciboEmitidoEm ?? hoje())
    setReciboReferencia(pagamento.reciboReferencia ?? '')
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

  const mesAtual = hoje().slice(0, 7)
  const totalEmAberto = lancamentos.filter((l) => l.status === 'pendente').reduce((acc, l) => acc + l.valorCentavos, 0)
  const totalRecebidoMes = pagamentos.filter((p) => p.data.slice(0, 7) === mesAtual).reduce((acc, p) => acc + p.valorCentavos, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-[14px]">
        <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
          <p className="text-[12.5px] text-muted-foreground">Em aberto</p>
          <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{formatarCentavos(totalEmAberto)}</p>
        </div>
        <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
          <p className="text-[12.5px] text-muted-foreground">Recebido em {formatarCompetencia(mesAtual)}</p>
          <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{formatarCentavos(totalRecebidoMes)}</p>
        </div>
        <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
          <p className="text-[12.5px] text-muted-foreground">Contrato vigente</p>
          <p className="mt-1 font-mono text-[22px] font-medium text-foreground">
            {contratoVigente?.valorCentavos != null ? formatarCentavos(contratoVigente.valorCentavos) : '—'}
          </p>
          {contratoVigente && <p className="mt-1 text-xs text-muted-foreground">{formatarModalidadeContrato(contratoVigente.modalidade)}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
        <div className="border-b border-border px-[18px] py-[14px]">
          <h3 className="text-[14.5px] font-semibold text-foreground">Contrato vigente</h3>
        </div>
        <div className="flex flex-col p-[20px_18px]">
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
          <Button type="button" variant="outline" size="sm" className="mt-3 self-start" onClick={() => setReajustando(true)}>
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
              <ConfirmarAcao
                rotulo="Confirmar reajuste"
                titulo="Confirmar reajuste de preço"
                descricao="A partir da data escolhida, o novo valor passa a valer. Lançamentos já criados não mudam de valor — histórico financeiro nunca é reescrito."
                rotuloConfirmar="Sim, aplicar reajuste"
                disabled={!novoValor}
                onConfirmar={handleReajustar}
              />
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
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setHistoricoAberto((v) => !v)}
            >
              <ChevronDown className={`size-3.5 transition-transform ${historicoAberto ? 'rotate-180' : ''}`} />
              Histórico de vigências ({historicoContratos.length})
            </button>
            {historicoAberto && (
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {historicoContratos.map((c) => (
                <span key={c.id}>
                  Desde {formatarDataBr(c.vigenciaInicio)}: {c.valorCentavos != null ? formatarCentavos(c.valorCentavos) : '—'} ·{' '}
                  {formatarModalidadeContrato(c.modalidade)}
                </span>
              ))}
            </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
          <h3 className="text-[14.5px] font-semibold text-foreground">Lançamentos</h3>
          {!ajustando && (
            <Button type="button" variant="outline" className="h-[30px]" onClick={() => setAjustando(true)}>
              Lançamento manual
            </Button>
          )}
        </div>

        <div className="flex flex-col p-[20px_18px]">
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
              <ConfirmarAcao
                rotulo="Salvar lançamento"
                titulo="Confirmar lançamento manual"
                descricao={`${ajusteTipo === 'desconto' ? 'Desconto' : 'Ajuste'} de ${formatarCompetencia(ajusteCompetencia)}, sem vínculo com nenhuma sessão.`}
                rotuloConfirmar="Sim, salvar"
                disabled={!ajusteValor || !ajusteDescricao.trim()}
                onConfirmar={handleCriarAjuste}
              />
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
            <div className="flex flex-col">
              {lancamentosPorCompetencia.get(competencia)!.map((l) => (
                <div key={l.id} className="flex flex-col gap-1.5 border-b border-border py-1.5 last:border-0">
                  <div className="flex h-8 items-center gap-3">
                    <span className="w-[110px] shrink-0 font-mono text-[13.5px] text-muted-foreground">{formatarDataCurtaUtc(l.createdAt)}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] text-foreground">{l.descricao || formatarTipoLancamento(l.tipo)}</span>
                    </div>
                    <span className="w-[120px] shrink-0 text-right font-mono text-[13.5px] text-foreground">{formatarCentavos(l.valorCentavos)}</span>
                    <div className="flex w-[90px] shrink-0 justify-end">
                      <Badge variant={l.status === 'pago' ? 'success' : l.status === 'cancelado' ? 'outline' : 'warn'}>
                        {formatarStatusLancamento(l.status)}
                      </Badge>
                    </div>
                  </div>
                  {l.status === 'pendente' && (
                    <div className="flex justify-end">
                      <ConfirmarAcao
                        rotulo="Cancelar"
                        titulo="Cancelar lançamento"
                        descricao="Fica marcado como cancelado, sem cobrança. Dá pra reabrir depois, se for engano."
                        rotuloConfirmar="Sim, cancelar"
                        onConfirmar={() => onCancelarLancamento(l.id)}
                      />
                    </div>
                  )}
                  {l.status === 'cancelado' && (
                    <div className="flex justify-end">
                      <ConfirmarAcao
                        rotulo="Reabrir"
                        titulo="Reabrir lançamento"
                        descricao="Volta pra pendente, como se nunca tivesse sido cancelado."
                        rotuloConfirmar="Sim, reabrir"
                        onConfirmar={() => onReabrirLancamento(l.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
        <div className="border-b border-border px-[18px] py-[14px]">
          <h3 className="text-[14.5px] font-semibold text-foreground">Pagamentos</h3>
        </div>
        <div className="flex flex-col p-[20px_18px]">
        {pagamentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>}
        <div className="flex flex-col gap-2">
          {pagamentos.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground">
                  {formatarCentavos(p.valorCentavos)} · {formatarMeioPagamento(p.meio)} · {formatarDataBr(p.data)}
                </span>
                {p.estornadoEm && <Badge variant="destructive">Estornado</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">Pagador: {p.pagadorNome}{p.pagadorCpf ? ` (${p.pagadorCpf})` : ''}</span>

              {p.estornadoEm ? (
                <span className="text-xs text-muted-foreground">
                  Estornado em {formatarDataHoraBr(p.estornadoEm)} — {p.motivoEstorno}
                </span>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    {p.reciboEmitidoEm ? (
                      <span className="text-xs text-muted-foreground">
                        Recibo emitido em {formatarDataBr(p.reciboEmitidoEm)} — ref. {p.reciboReferencia}
                      </span>
                    ) : (
                      <span />
                    )}
                    {emitindoReciboId !== p.id && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => abrirEmitirRecibo(p)}>
                        {p.reciboEmitidoEm ? 'Editar recibo' : 'Marcar recibo emitido'}
                      </Button>
                    )}
                  </div>

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

                  <div className="flex justify-end">
                    <ConfirmarAcao
                      rotulo="Estornar pagamento"
                      titulo="Estornar pagamento"
                      variant="destructive"
                      pedirMotivo
                      motivoLabel="Motivo do estorno"
                      descricao={
                        <>
                          <p>
                            O pagamento continua registrado, marcado como estornado. Os lançamentos que ele cobria
                            voltam a pendente.
                          </p>
                          {p.reciboEmitidoEm && (
                            <p>
                              Este pagamento já tem recibo emitido em {formatarDataBr(p.reciboEmitidoEm)}. Estornar
                              aqui não desfaz a emissão — resolva isso separadamente se necessário.
                            </p>
                          )}
                        </>
                      }
                      rotuloConfirmar="Sim, estornar"
                      onConfirmar={async (motivo) => {
                        await onEstornarPagamento(p.id, { motivo: motivo ?? '' })
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
