import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarCentavos, formatarCompetencia, formatarMeioPagamento } from '../pacientes/formatters'
import { useReceberStore } from './store'

/**
 * Cabeçalho de competência + export CSV, e os 3 cards de estatística do
 * topo da tela A receber (Etapa 6 do redesign — antes era um relatório em
 * duas colunas de texto corrido). "Vencendo esta semana" do mock não entrou:
 * `Lancamento` não tem data de vencimento no modelo de dados hoje, só
 * competência — troquei por "Lançamentos pendentes" (contagem real).
 */
export function RelatorioMensalSection() {
  const store = useReceberStore()
  const [mensagemExport, setMensagemExport] = useState<string | null>(null)

  useEffect(() => {
    void store.carregarRelatorio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.competenciaRelatorio])

  async function handleExportar(): Promise<void> {
    setMensagemExport(null)
    const caminho = await store.exportarCsv()
    setMensagemExport(caminho ? `Exportado para ${caminho}` : null)
  }

  const relatorio = store.relatorio
  const totalEmAberto = store.pendentes.reduce((soma, l) => soma + l.valorCentavos, 0)
  const pacientesComPendencia = new Set(store.pendentes.map((l) => l.pacienteId)).size
  const totalRecebido = relatorio ? relatorio.recebidoPorMeio.reduce((soma, r) => soma + r.totalCentavos, 0) : 0
  const notaRecebido =
    relatorio && relatorio.recebidoPorMeio.length > 0
      ? relatorio.recebidoPorMeio.map((r) => `${formatarMeioPagamento(r.meio)} ${formatarCentavos(r.totalCentavos)}`).join(' · ')
      : 'Nada recebido neste mês.'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="receber-competencia" className="text-[13px] text-muted-foreground">
            Competência
          </Label>
          <Input
            id="receber-competencia"
            type="month"
            className="h-[34px] w-36"
            value={store.competenciaRelatorio}
            onChange={(e) => store.setCompetenciaRelatorio(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" className="h-[34px]" onClick={handleExportar}>
          <ExternalLink className="size-[14px] text-warn-foreground" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-[14px]">
        <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
          <p className="text-[12.5px] text-muted-foreground">Total em aberto</p>
          <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{formatarCentavos(totalEmAberto)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pacientesComPendencia} paciente{pacientesComPendencia === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
          <p className="text-[12.5px] text-muted-foreground">Recebido em {formatarCompetencia(store.competenciaRelatorio)}</p>
          <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{formatarCentavos(totalRecebido)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{notaRecebido}</p>
        </div>
        <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
          <p className="text-[12.5px] text-muted-foreground">Lançamentos pendentes</p>
          <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{store.pendentes.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">aguardando pagamento</p>
        </div>
      </div>

      {mensagemExport && <p className="text-sm text-muted-foreground">{mensagemExport}</p>}
      {store.relatorioError && <p className="text-sm text-destructive">{store.relatorioError}</p>}
    </div>
  )
}
