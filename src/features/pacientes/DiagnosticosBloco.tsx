import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatarDataBr } from './formatters'
import type { Diagnostico, DiagnosticoInput } from './types'

interface DiagnosticosBlocoProps {
  diagnosticos: Diagnostico[]
  onCriar: (input: DiagnosticoInput) => Promise<boolean>
  onAtualizar: (id: string, input: DiagnosticoInput) => Promise<boolean>
  onRemover: (id: string) => Promise<void>
}

function inputVazio(): DiagnosticoInput {
  return { descricao: '', cid: null, data: null, profissional: null, observacao: null }
}

function Campos({
  valor,
  onChange,
  idPrefixo
}: {
  valor: DiagnosticoInput
  onChange: (valor: DiagnosticoInput) => void
  idPrefixo: string
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="col-span-2 flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-descricao`}>Diagnóstico</Label>
        <Input
          id={`${idPrefixo}-descricao`}
          value={valor.descricao}
          onChange={(e) => onChange({ ...valor, descricao: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-cid`}>CID (opcional)</Label>
        <Input
          id={`${idPrefixo}-cid`}
          className="font-mono"
          value={valor.cid ?? ''}
          onChange={(e) => onChange({ ...valor, cid: e.target.value || null })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-data`}>Data</Label>
        <Input
          id={`${idPrefixo}-data`}
          type="date"
          value={valor.data ?? ''}
          onChange={(e) => onChange({ ...valor, data: e.target.value || null })}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <Label htmlFor={`${idPrefixo}-profissional`}>Quem diagnosticou</Label>
        <Input
          id={`${idPrefixo}-profissional`}
          value={valor.profissional ?? ''}
          onChange={(e) => onChange({ ...valor, profissional: e.target.value || null })}
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

export function DiagnosticosBloco({ diagnosticos, onCriar, onAtualizar, onRemover }: DiagnosticosBlocoProps) {
  const [criando, setCriando] = useState(false)
  const [novo, setNovo] = useState<DiagnosticoInput>(inputVazio())
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<DiagnosticoInput>(inputVazio())
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

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Diagnósticos</h3>
        {!criando && (
          <Button type="button" className="h-[30px]" onClick={() => setCriando(true)}>
            Adicionar diagnóstico
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 p-[20px_18px]">
        {criando && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
            <Campos valor={novo} onChange={setNovo} idPrefixo="diag-novo" />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={salvando || !novo.descricao.trim()} onClick={handleCriar}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {diagnosticos.length === 0 && !criando && (
          <p className="text-sm text-muted-foreground">
            Nenhum diagnóstico registrado. Serve pro que a paciente trouxe de outro profissional e pro que foi
            construído no acompanhamento.
          </p>
        )}

        {diagnosticos.map((diagnostico) =>
          editandoId === diagnostico.id ? (
            <div key={diagnostico.id} className="flex flex-col gap-2 rounded-md bg-muted p-3">
              <Campos valor={edicao} onChange={setEdicao} idPrefixo={`diag-edit-${diagnostico.id}`} />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={salvando || !edicao.descricao.trim()} onClick={handleAtualizar}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div key={diagnostico.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium text-foreground">{diagnostico.descricao}</span>
                  {diagnostico.cid && <span className="font-mono text-[12.5px] text-muted-foreground">{diagnostico.cid}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {[
                    diagnostico.data ? formatarDataBr(diagnostico.data) : null,
                    diagnostico.profissional ? `por ${diagnostico.profissional}` : null
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'sem data informada'}
                </span>
                {diagnostico.observacao && (
                  <span className="text-xs text-muted-foreground italic">{diagnostico.observacao}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditandoId(diagnostico.id)
                    setEdicao({
                      descricao: diagnostico.descricao,
                      cid: diagnostico.cid,
                      data: diagnostico.data,
                      profissional: diagnostico.profissional,
                      observacao: diagnostico.observacao
                    })
                  }}
                >
                  Editar
                </Button>
                <ConfirmarAcao
                  rotulo="Excluir"
                  titulo="Excluir diagnóstico"
                  descricao="Remove este diagnóstico da ficha. A evolução clínica não é afetada."
                  rotuloConfirmar="Sim, excluir"
                  onConfirmar={() => onRemover(diagnostico.id)}
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
