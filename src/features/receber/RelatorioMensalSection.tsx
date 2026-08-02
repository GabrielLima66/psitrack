import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarCentavos, formatarMeioPagamento } from '../pacientes/formatters'
import { useReceberStore } from './store'

/** Relatório do mês (Etapa 13): recebido por meio, em aberto por paciente, relação pronta pra Receita Saúde + export CSV local. */
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Relatório do mês</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor="receber-competencia" className="text-xs">
            Competência
          </Label>
          <Input
            id="receber-competencia"
            type="month"
            className="w-36"
            value={store.competenciaRelatorio}
            onChange={(e) => store.setCompetenciaRelatorio(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={handleExportar}>
            Exportar CSV
          </Button>
        </div>
      </div>

      {relatorio && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 font-medium text-foreground">Recebido por meio</p>
            {relatorio.recebidoPorMeio.length === 0 && <p className="text-muted-foreground">Nada recebido neste mês.</p>}
            {relatorio.recebidoPorMeio.map((r) => (
              <p key={r.meio} className="text-muted-foreground">
                {formatarMeioPagamento(r.meio)}: <span className="text-foreground">{formatarCentavos(r.totalCentavos)}</span>
              </p>
            ))}
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">Em aberto por paciente</p>
            {relatorio.emAbertoPorPaciente.length === 0 && <p className="text-muted-foreground">Nada em aberto.</p>}
            {relatorio.emAbertoPorPaciente.map((p) => (
              <p key={p.pacienteId} className="text-muted-foreground">
                {p.pacienteNome}: <span className="text-foreground">{formatarCentavos(p.totalCentavos)}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {mensagemExport && <p className="text-sm text-muted-foreground">{mensagemExport}</p>}
      {store.relatorioError && <p className="text-sm text-destructive">{store.relatorioError}</p>}
    </div>
  )
}
