import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hojeLocal } from '../agenda/tempo'
import { formatarDataBr } from './formatters'
import type { Encaminhamento, EncaminhamentoInput } from './types'

interface EncaminhamentosBlocoProps {
  encaminhamentos: Encaminhamento[]
  onCriar: (input: EncaminhamentoInput) => Promise<boolean>
  onAtualizar: (id: string, input: EncaminhamentoInput) => Promise<boolean>
  onRemover: (id: string) => Promise<void>
}

function inputVazio(): EncaminhamentoInput {
  return { paraQuem: '', especialidade: null, data: hojeLocal(), motivo: null, observacao: null }
}

function Campos({
  valor,
  onChange,
  idPrefixo
}: {
  valor: EncaminhamentoInput
  onChange: (valor: EncaminhamentoInput) => void
  idPrefixo: string
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-paraQuem`}>Para quem</Label>
        <Input
          id={`${idPrefixo}-paraQuem`}
          value={valor.paraQuem}
          onChange={(e) => onChange({ ...valor, paraQuem: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-especialidade`}>Especialidade</Label>
        <Input
          id={`${idPrefixo}-especialidade`}
          placeholder="psiquiatria, neuro…"
          value={valor.especialidade ?? ''}
          onChange={(e) => onChange({ ...valor, especialidade: e.target.value || null })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-data`}>Data</Label>
        <Input
          id={`${idPrefixo}-data`}
          type="date"
          value={valor.data}
          onChange={(e) => onChange({ ...valor, data: e.target.value })}
        />
      </div>
      <div className="col-span-3 flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-motivo`}>Motivo</Label>
        <Input
          id={`${idPrefixo}-motivo`}
          value={valor.motivo ?? ''}
          onChange={(e) => onChange({ ...valor, motivo: e.target.value || null })}
        />
      </div>
    </div>
  )
}

/** Encaminhamento de saída (D47) — quem indicou a paciente pra ela é o campo `origem`, na aba Cadastro. */
export function EncaminhamentosBloco({ encaminhamentos, onCriar, onAtualizar, onRemover }: EncaminhamentosBlocoProps) {
  const [criando, setCriando] = useState(false)
  const [novo, setNovo] = useState<EncaminhamentoInput>(inputVazio())
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<EncaminhamentoInput>(inputVazio())
  const [salvando, setSalvando] = useState(false)

  async function handleCriar(): Promise<void> {
    setSalvando(true)
    const ok = await onCriar(novo)
    setSalvando(false)
    if (ok) {
      setNovo(inputVazio())
      setCriando(false)
    }
  }

  async function handleAtualizar(): Promise<void> {
    if (!editandoId) return
    setSalvando(true)
    const ok = await onAtualizar(editandoId, edicao)
    setSalvando(false)
    if (ok) setEditandoId(null)
  }

  const valido = (input: EncaminhamentoInput): boolean => !!input.paraQuem.trim() && !!input.data

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Encaminhamentos</h3>
        {!criando && (
          <Button type="button" className="h-[30px]" onClick={() => setCriando(true)}>
            Registrar encaminhamento
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 p-[20px_18px]">
        {criando && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
            <Campos valor={novo} onChange={setNovo} idPrefixo="enc-novo" />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={salvando || !valido(novo)} onClick={handleCriar}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {encaminhamentos.length === 0 && !criando && (
          <p className="text-sm text-muted-foreground">
            Nenhum encaminhamento registrado. Aqui ficam os encaminhamentos que você faz para outros profissionais —
            quem indicou a paciente para você é o campo Origem, na aba Cadastro.
          </p>
        )}

        {encaminhamentos.map((encaminhamento) =>
          editandoId === encaminhamento.id ? (
            <div key={encaminhamento.id} className="flex flex-col gap-2 rounded-md bg-muted p-3">
              <Campos valor={edicao} onChange={setEdicao} idPrefixo={`enc-edit-${encaminhamento.id}`} />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={salvando || !valido(edicao)} onClick={handleAtualizar}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={encaminhamento.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium text-foreground">{encaminhamento.paraQuem}</span>
                  {encaminhamento.especialidade && (
                    <span className="text-[12.5px] text-muted-foreground">{encaminhamento.especialidade}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatarDataBr(encaminhamento.data)}</span>
                {encaminhamento.motivo && <span className="text-xs text-muted-foreground italic">{encaminhamento.motivo}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditandoId(encaminhamento.id)
                    setEdicao({
                      paraQuem: encaminhamento.paraQuem,
                      especialidade: encaminhamento.especialidade,
                      data: encaminhamento.data,
                      motivo: encaminhamento.motivo,
                      observacao: encaminhamento.observacao
                    })
                  }}
                >
                  Editar
                </Button>
                <ConfirmarAcao
                  rotulo="Excluir"
                  titulo="Excluir encaminhamento"
                  descricao="Remove este encaminhamento da ficha. A evolução clínica não é afetada."
                  rotuloConfirmar="Sim, excluir"
                  onConfirmar={() => onRemover(encaminhamento.id)}
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
