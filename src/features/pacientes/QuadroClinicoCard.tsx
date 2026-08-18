import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FichaClinica, FichaClinicaInput } from './types'

export interface FichaRascunhoValor {
  demandaInicial: string
  abordagem: string
}

type QuadroClinicoCardProps =
  | {
      /** Cadastro de paciente novo: campos OBRIGATÓRIOS, controlados pelo formulário pai — sem botão de salvar próprio, entra no submit geral. */
      modo: 'criacao'
      valor: FichaRascunhoValor
      onChange: (valor: FichaRascunhoValor) => void
    }
  | {
      /** Paciente já existente: edição livre, com botão de salvar próprio (campo vazio é permitido — só o cadastro exige). */
      modo: 'edicao'
      ficha: FichaClinica | null
      onSalvar: (input: FichaClinicaInput) => Promise<boolean>
    }

/**
 * Quadro clínico (demanda inicial + abordagem) — SPEC-fase-5.md, revisão de
 * D49: nasce no Cadastro, e obrigatório só ali, porque é o ponto de partida
 * do prontuário e cadastrar sem ele cria uma ficha que ninguém volta pra
 * completar. Continua vivendo em `paciente_ficha_clinica`, nunca em
 * `pacientes` (D1/D2) — só o LUGAR na tela mudou, não o modelo.
 */
export function QuadroClinicoCard(props: QuadroClinicoCardProps) {
  if (props.modo === 'criacao') {
    const { valor, onChange } = props
    return (
      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
        <div className="border-b border-border px-[18px] py-[14px]">
          <h3 className="text-[14.5px] font-semibold text-foreground">Quadro clínico</h3>
        </div>
        <div className="flex flex-col gap-4 p-[20px_18px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clinico-demanda">
              Demanda inicial <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="clinico-demanda"
              autoResize
              rows={3}
              required
              placeholder="O que a trouxe, nas palavras dela e na sua leitura."
              value={valor.demandaInicial}
              onChange={(e) => onChange({ ...valor, demandaInicial: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clinico-abordagem">
              Abordagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="clinico-abordagem"
              autoResize
              rows={2}
              required
              placeholder="TCC, psicanálise, ACT… e como está sendo conduzido."
              value={valor.abordagem}
              onChange={(e) => onChange({ ...valor, abordagem: e.target.value })}
            />
          </div>
        </div>
      </div>
    )
  }

  return <QuadroClinicoEdicao ficha={props.ficha} onSalvar={props.onSalvar} />
}

function QuadroClinicoEdicao({ ficha, onSalvar }: { ficha: FichaClinica | null; onSalvar: (input: FichaClinicaInput) => Promise<boolean> }) {
  const [demandaInicial, setDemandaInicial] = useState(ficha?.demandaInicial ?? '')
  const [abordagem, setAbordagem] = useState(ficha?.abordagem ?? '')
  const [salvando, setSalvando] = useState(false)

  // A ficha chega depois do primeiro render (carregarClinico é assíncrono),
  // e troca ao mudar de paciente.
  useEffect(() => {
    setDemandaInicial(ficha?.demandaInicial ?? '')
    setAbordagem(ficha?.abordagem ?? '')
  }, [ficha?.id, ficha?.demandaInicial, ficha?.abordagem])

  const sujo = (ficha?.demandaInicial ?? '') !== demandaInicial || (ficha?.abordagem ?? '') !== abordagem

  async function handleSalvar(): Promise<void> {
    setSalvando(true)
    await onSalvar({ demandaInicial: demandaInicial.trim() || null, abordagem: abordagem.trim() || null })
    setSalvando(false)
  }

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Quadro clínico</h3>
        <Button type="button" className="h-[30px]" disabled={salvando || !sujo} onClick={handleSalvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-[20px_18px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clinico-demanda">Demanda inicial</Label>
          <Textarea
            id="clinico-demanda"
            autoResize
            rows={3}
            placeholder="O que a trouxe, nas palavras dela e na sua leitura."
            value={demandaInicial}
            onChange={(e) => setDemandaInicial(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clinico-abordagem">Abordagem</Label>
          <Textarea
            id="clinico-abordagem"
            autoResize
            rows={2}
            placeholder="TCC, psicanálise, ACT… e como está sendo conduzido."
            value={abordagem}
            onChange={(e) => setAbordagem(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
