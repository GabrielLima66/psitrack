import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarDiaSemanaAbrev } from '../agenda/formatters'
import type { ContratoPrecoInput, ModalidadeAtendimento, PoliticaFalta, RecorrenciaInput } from '../agenda/types'

interface AtendimentoInicialSectionProps {
  recorrencias: RecorrenciaInput[]
  onAdicionar: (input: RecorrenciaInput) => void
  onRemover: (index: number) => void
  contrato: ContratoPrecoInput
  onContratoChange: (contrato: ContratoPrecoInput) => void
}

const POLITICA_OPTIONS: { value: PoliticaFalta; label: string }[] = [
  { value: 'cobra_sempre', label: 'Cobra sempre' },
  { value: 'cobra_sem_aviso', label: 'Cobra só sem aviso prévio' },
  { value: 'nunca_cobra', label: 'Nunca cobra falta' }
]

/**
 * Só aparece ENQUANTO o paciente ainda não foi salvo (D24): horários fixos +
 * preço inicial entram na mesma transação da criação do paciente. Depois de
 * salvo, a gestão de horários passa para AtendimentoExistenteSection.
 */
export function AtendimentoInicialSection({
  recorrencias,
  onAdicionar,
  onRemover,
  contrato,
  onContratoChange
}: AtendimentoInicialSectionProps) {
  const [diaSemana, setDiaSemana] = useState(1)
  const [horaLocal, setHoraLocal] = useState('14:00')
  const [duracaoMin, setDuracaoMin] = useState(50)
  const [modalidade, setModalidade] = useState<ModalidadeAtendimento>('presencial')

  function handleAdicionar(): void {
    // vigenciaInicio = hoje: a série começa no dia do cadastro, não é campo editável aqui.
    onAdicionar({ diaSemana, horaLocal, duracaoMin, modalidade, vigenciaInicio: new Date().toISOString().slice(0, 10) })
  }

  const valorReais = contrato.valorCentavos > 0 ? (contrato.valorCentavos / 100).toFixed(2) : ''

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Atendimento</h3>
      </div>

      <div className="flex flex-col gap-3 p-[20px_18px]">
      <div className="flex flex-col gap-2">
        <Label>Horários fixos (opcional)</Label>
        {recorrencias.map((rec, index) => (
          <div key={index} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span>
              <span className="font-mono">
                {formatarDiaSemanaAbrev(rec.diaSemana)} às {rec.horaLocal}
              </span>{' '}
              · {rec.duracaoMin ?? 50}min · {rec.modalidade === 'presencial' ? 'Presencial' : 'Online'}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemover(index)}>
              Remover
            </Button>
          </div>
        ))}
        <div className="grid grid-cols-5 items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label>Dia</Label>
            <Select value={String(diaSemana)} onValueChange={(value) => setDiaSemana(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6].map((dia) => (
                  <SelectItem key={dia} value={String(dia)}>
                    {formatarDiaSemanaAbrev(dia)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="atendimento-hora">Hora</Label>
            <Input id="atendimento-hora" type="time" value={horaLocal} onChange={(event) => setHoraLocal(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="atendimento-duracao">Duração (min)</Label>
            <Input
              id="atendimento-duracao"
              type="number"
              min={1}
              value={duracaoMin}
              onChange={(event) => setDuracaoMin(Number(event.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Modalidade</Label>
            <Select value={modalidade} onValueChange={(value) => setModalidade(value as ModalidadeAtendimento)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={handleAdicionar}>
            Adicionar horário
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="atendimento-valor">Valor por sessão (R$)</Label>
          <Input
            id="atendimento-valor"
            type="number"
            min={0}
            step="0.01"
            value={valorReais}
            onChange={(event) =>
              onContratoChange({ ...contrato, valorCentavos: Math.round(Number(event.target.value || 0) * 100) })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Modalidade de cobrança</Label>
          <Select
            value={contrato.modalidade}
            onValueChange={(value) => onContratoChange({ ...contrato, modalidade: value as 'avulso' | 'mensal' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avulso">Avulso (por sessão)</SelectItem>
              <SelectItem value="mensal">Mensal (competência)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Política de falta</Label>
          <Select
            value={contrato.politicaFalta ?? 'cobra_sem_aviso'}
            onValueChange={(value) => onContratoChange({ ...contrato, politicaFalta: value as PoliticaFalta })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLITICA_OPTIONS.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      </div>
    </div>
  )
}
