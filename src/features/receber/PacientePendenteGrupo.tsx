import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hojeLocal as hoje } from '../agenda/tempo'
import { formatarCentavos, formatarCompetencia, formatarTipoLancamento } from '../pacientes/formatters'
import { useReceberStore } from './store'
import type { ContratoPreco, LancamentoComPaciente, MeioPagamento } from './types'

interface PacientePendenteGrupoProps {
  pacienteId: string
  pacienteNome: string
  lancamentos: LancamentoComPaciente[]
  contrato: ContratoPreco | null
  selecionados: string[]
}

const MEIO_OPTIONS: { value: MeioPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outro', label: 'Outro' }
]

/**
 * `avulso`: seleção item a item. `mensal`: competência inteira já vem
 * pré-selecionada (feito em selecaoPadrao no store) — aqui só exibe.
 */
export function PacientePendenteGrupo({ pacienteId, pacienteNome, lancamentos, contrato, selecionados }: PacientePendenteGrupoProps) {
  const store = useReceberStore(
    useShallow((s) => ({
      registrandoPacienteId: s.registrandoPacienteId,
      abrirRegistrar: s.abrirRegistrar,
      registrarPagamento: s.registrarPagamento,
      fecharRegistrar: s.fecharRegistrar,
      toggleSelecionado: s.toggleSelecionado
    }))
  )
  const registrando = store.registrandoPacienteId === pacienteId

  const [data, setData] = useState(hoje())
  const [meio, setMeio] = useState<MeioPagamento>('pix')
  const [pagadorNome, setPagadorNome] = useState('')
  const [pagadorCpf, setPagadorCpf] = useState('')
  const [salvando, setSalvando] = useState(false)

  const totalSelecionado = lancamentos.filter((l) => selecionados.includes(l.id)).reduce((soma, l) => soma + l.valorCentavos, 0)

  async function handleAbrirRegistrar(): Promise<void> {
    await store.abrirRegistrar(pacienteId)
    const padrao = useReceberStore.getState().pagadorPadrao
    setPagadorNome(padrao?.nome ?? pacienteNome)
    setPagadorCpf(padrao?.cpf ?? '')
    setData(hoje())
  }

  async function handleRegistrar(): Promise<void> {
    setSalvando(true)
    const ok = await store.registrarPagamento(pacienteId, { data, meio, pagadorNome, pagadorCpf: pagadorCpf || null })
    setSalvando(false)
    if (!ok) return
  }

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-[18px] py-[13px]">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-foreground">{pacienteNome}</h3>
          <Badge variant={contrato?.modalidade === 'mensal' ? 'default' : 'neutral'}>
            {contrato?.modalidade === 'mensal' ? 'Mensal' : 'Avulso'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">
            Selecionado <span className="font-mono font-medium text-foreground">{formatarCentavos(totalSelecionado)}</span>
          </span>
          {!registrando && (
            <Button type="button" className="h-[30px]" disabled={selecionados.length === 0} onClick={handleAbrirRegistrar}>
              Registrar pagamento
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col px-[18px] pb-3">
        {lancamentos.map((l) => (
          <label key={l.id} className="flex h-10 items-center gap-2 border-t border-border text-[13.5px] first:border-t-0">
            <Checkbox checked={selecionados.includes(l.id)} onCheckedChange={() => store.toggleSelecionado(pacienteId, l.id)} />
            <span className="flex-1 truncate">
              {formatarTipoLancamento(l.tipo)} · {formatarCompetencia(l.competencia)} · {l.descricao}
            </span>
            <span className="font-mono text-[13.5px] text-foreground">{formatarCentavos(l.valorCentavos)}</span>
          </label>
        ))}
      </div>

      {registrando && (
        <div className="mx-[18px] mb-[18px] flex flex-col gap-2 rounded-md bg-muted p-3">
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`receber-data-${pacienteId}`}>Data</Label>
              <Input id={`receber-data-${pacienteId}`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Meio</Label>
              <Select value={meio} onValueChange={(v) => setMeio(v as MeioPagamento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEIO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`receber-pagador-nome-${pacienteId}`}>Pagador</Label>
              <Input id={`receber-pagador-nome-${pacienteId}`} value={pagadorNome} onChange={(e) => setPagadorNome(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`receber-pagador-cpf-${pacienteId}`}>CPF do pagador</Label>
              <Input
                id={`receber-pagador-cpf-${pacienteId}`}
                value={pagadorCpf}
                onChange={(e) => setPagadorCpf(e.target.value.replace(/\D/g, ''))}
                maxLength={11}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <ConfirmarAcao
              rotulo="Confirmar pagamento"
              titulo="Confirmar pagamento"
              descricao={`Marca ${formatarCentavos(totalSelecionado)} como pago. Dá pra estornar depois, na aba Financeiro da ficha do paciente, se for engano.`}
              rotuloConfirmar="Sim, confirmar pagamento"
              disabled={!pagadorNome.trim()}
              busy={salvando}
              onConfirmar={handleRegistrar}
            />
            <Button type="button" variant="ghost" size="sm" onClick={store.fecharRegistrar}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
