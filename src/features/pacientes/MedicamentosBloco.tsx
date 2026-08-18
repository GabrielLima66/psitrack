import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hojeLocal } from '../agenda/tempo'
import { formatarDataBr } from './formatters'
import type { Medicamento, MedicamentoInput } from './types'

interface MedicamentosBlocoProps {
  medicamentos: Medicamento[]
  onCriar: (input: MedicamentoInput) => Promise<boolean>
  onAtualizar: (id: string, input: MedicamentoInput) => Promise<boolean>
  onRemover: (id: string) => Promise<void>
}

function inputVazio(): MedicamentoInput {
  return { nome: '', dose: null, prescritor: null, inicio: null, fim: null, observacao: null }
}

function paraInput(medicamento: Medicamento): MedicamentoInput {
  return {
    nome: medicamento.nome,
    dose: medicamento.dose,
    prescritor: medicamento.prescritor,
    inicio: medicamento.inicio,
    fim: medicamento.fim,
    observacao: medicamento.observacao
  }
}

/** Campos de um medicamento — mesmo formulário serve pra criar e editar. */
function CamposMedicamento({
  valor,
  onChange,
  idPrefixo
}: {
  valor: MedicamentoInput
  onChange: (valor: MedicamentoInput) => void
  idPrefixo: string
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-nome`}>Medicamento</Label>
        <Input id={`${idPrefixo}-nome`} value={valor.nome} onChange={(e) => onChange({ ...valor, nome: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-dose`}>Dose</Label>
        <Input
          id={`${idPrefixo}-dose`}
          placeholder="50mg, 1x ao dia"
          value={valor.dose ?? ''}
          onChange={(e) => onChange({ ...valor, dose: e.target.value || null })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-prescritor`}>Quem prescreveu</Label>
        <Input
          id={`${idPrefixo}-prescritor`}
          value={valor.prescritor ?? ''}
          onChange={(e) => onChange({ ...valor, prescritor: e.target.value || null })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-inicio`}>Início</Label>
        <Input
          id={`${idPrefixo}-inicio`}
          type="date"
          value={valor.inicio ?? ''}
          onChange={(e) => onChange({ ...valor, inicio: e.target.value || null })}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-observacao`}>Observação</Label>
        <Input
          id={`${idPrefixo}-observacao`}
          value={valor.observacao ?? ''}
          onChange={(e) => onChange({ ...valor, observacao: e.target.value || null })}
        />
      </div>
    </div>
  )
}

function LinhaMedicamento({ medicamento }: { medicamento: Medicamento }) {
  const periodo = [
    medicamento.inicio ? `desde ${formatarDataBr(medicamento.inicio)}` : null,
    medicamento.fim ? `até ${formatarDataBr(medicamento.fim)}` : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[13.5px] font-medium text-foreground">{medicamento.nome}</span>
        {medicamento.dose && <span className="text-[12.5px] text-muted-foreground">{medicamento.dose}</span>}
      </div>
      <span className="text-xs text-muted-foreground">
        {[medicamento.prescritor ? `prescrito por ${medicamento.prescritor}` : null, periodo || null]
          .filter(Boolean)
          .join(' · ') || 'sem período informado'}
      </span>
      {medicamento.observacao && <span className="text-xs text-muted-foreground italic">{medicamento.observacao}</span>}
    </div>
  )
}

/**
 * Duas listas a partir de uma coluna só: `fim = null` é "em uso" (D44).
 * Encerrar é preencher `fim`, com rótulo próprio — nunca "excluir", que é
 * outra coisa (registro errado, não tratamento terminado).
 */
export function MedicamentosBloco({ medicamentos, onCriar, onAtualizar, onRemover }: MedicamentosBlocoProps) {
  const [criando, setCriando] = useState(false)
  const [novo, setNovo] = useState<MedicamentoInput>(inputVazio())
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<MedicamentoInput>(inputVazio())
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null)
  const [dataFim, setDataFim] = useState(hojeLocal())
  const [salvando, setSalvando] = useState(false)

  const emUso = medicamentos.filter((m) => !m.fim)
  const encerrados = medicamentos.filter((m) => m.fim)

  async function handleCriar(): Promise<void> {
    setSalvando(true)
    const ok = await onCriar(novo)
    setSalvando(false)
    if (ok) {
      setNovo(inputVazio())
      setCriando(false)
    }
  }

  function abrirEdicao(medicamento: Medicamento): void {
    setEditandoId(medicamento.id)
    setEdicao(paraInput(medicamento))
  }

  async function handleAtualizar(): Promise<void> {
    if (!editandoId) return
    setSalvando(true)
    const ok = await onAtualizar(editandoId, edicao)
    setSalvando(false)
    if (ok) setEditandoId(null)
  }

  function abrirEncerramento(medicamento: Medicamento): void {
    setEncerrandoId(medicamento.id)
    setDataFim(hojeLocal())
  }

  async function handleEncerrar(medicamento: Medicamento): Promise<void> {
    setSalvando(true)
    const ok = await onAtualizar(medicamento.id, { ...paraInput(medicamento), fim: dataFim })
    setSalvando(false)
    if (ok) setEncerrandoId(null)
  }

  function acoes(medicamento: Medicamento, encerrado: boolean) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(medicamento)}>
          Editar
        </Button>
        {!encerrado && encerrandoId !== medicamento.id && (
          <Button type="button" variant="outline" size="sm" onClick={() => abrirEncerramento(medicamento)}>
            Marcar como encerrada
          </Button>
        )}
        <ConfirmarAcao
          rotulo="Excluir"
          titulo="Excluir medicação"
          descricao="Use isto só quando o registro está errado. Se o tratamento terminou, o certo é marcar como encerrada — assim o histórico continua visível."
          rotuloConfirmar="Sim, excluir"
          onConfirmar={() => onRemover(medicamento.id)}
        />
      </div>
    )
  }

  function item(medicamento: Medicamento, encerrado: boolean) {
    if (editandoId === medicamento.id) {
      return (
        <div key={medicamento.id} className="flex flex-col gap-2 rounded-md bg-muted p-3">
          <CamposMedicamento valor={edicao} onChange={setEdicao} idPrefixo={`med-edit-${medicamento.id}`} />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={salvando || !edicao.nome.trim()} onClick={handleAtualizar}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoId(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div key={medicamento.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <LinhaMedicamento medicamento={medicamento} />
          {acoes(medicamento, encerrado)}
        </div>
        {encerrandoId === medicamento.id && (
          <div className="flex items-end gap-2 rounded-md bg-muted p-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`med-fim-${medicamento.id}`}>Encerrada em</Label>
              <Input
                id={`med-fim-${medicamento.id}`}
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <Button type="button" size="sm" disabled={salvando} onClick={() => void handleEncerrar(medicamento)}>
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEncerrandoId(null)}>
              Cancelar
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Medicações</h3>
        {!criando && (
          <Button type="button" className="h-[30px]" onClick={() => setCriando(true)}>
            Adicionar medicação
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-[20px_18px]">
        {criando && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
            <CamposMedicamento valor={novo} onChange={setNovo} idPrefixo="med-novo" />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={salvando || !novo.nome.trim()} onClick={handleCriar}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {medicamentos.length === 0 && !criando && (
          <p className="text-sm text-muted-foreground">
            Nenhuma medicação registrada. O que for relatado pela paciente ou pelo psiquiatra entra aqui — o app
            registra, nunca prescreve.
          </p>
        )}

        {emUso.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium text-muted-foreground">Em uso</span>
              <Badge variant="success">{emUso.length}</Badge>
            </div>
            {emUso.map((medicamento) => item(medicamento, false))}
          </div>
        )}

        {encerrados.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium text-muted-foreground">Já utilizadas</span>
              <Badge variant="neutral">{encerrados.length}</Badge>
            </div>
            {encerrados.map((medicamento) => item(medicamento, true))}
          </div>
        )}
      </div>
    </div>
  )
}
