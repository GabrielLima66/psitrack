import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarDataCurta, formatarDiaSemanaAbrev } from '../agenda/formatters'
import type { ModalidadeAtendimento, Recorrencia, RecorrenciaInput } from '../agenda/types'

interface AtendimentoExistenteSectionProps {
  recorrencias: Recorrencia[]
  onAdicionar: (input: RecorrenciaInput) => Promise<void>
  onEncerrar: (id: string, vigenciaFim: string) => Promise<void>
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Gestão dos horários fixos de um paciente já cadastrado. "Encerrar" grava
 * `vigenciaFim` (nunca apaga a série) e cancela só as ocorrências futuras
 * ainda `agendada` — a agenda cuida disso (encerrarSerie), esta tela só
 * dispara a ação.
 */
export function AtendimentoExistenteSection({ recorrencias, onAdicionar, onEncerrar }: AtendimentoExistenteSectionProps) {
  const [diaSemana, setDiaSemana] = useState(1)
  const [horaLocal, setHoraLocal] = useState('14:00')
  const [duracaoMin, setDuracaoMin] = useState(50)
  const [modalidade, setModalidade] = useState<ModalidadeAtendimento>('presencial')
  const [adicionando, setAdicionando] = useState(false)

  const ativas = recorrencias.filter((r) => !r.vigenciaFim || r.vigenciaFim > hoje())
  const encerradas = recorrencias.filter((r) => r.vigenciaFim && r.vigenciaFim <= hoje())

  async function handleAdicionar(): Promise<void> {
    setAdicionando(true)
    await onAdicionar({ diaSemana, horaLocal, duracaoMin, modalidade, vigenciaInicio: hoje() })
    setAdicionando(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Atendimento — horários fixos</h3>

      <div className="flex flex-col gap-2">
        {ativas.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário fixo ativo.</p>}
        {ativas.map((rec) => (
          <div key={rec.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span>
              {formatarDiaSemanaAbrev(rec.diaSemana)} às {rec.horaLocal} · {rec.duracaoMin}min ·{' '}
              {rec.modalidade === 'presencial' ? 'Presencial' : 'Online'} · desde {formatarDataCurta(rec.vigenciaInicio)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEncerrar(rec.id, hoje())}>
              Encerrar
            </Button>
          </div>
        ))}
        {encerradas.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">{encerradas.length} horário(s) encerrado(s)</summary>
            <div className="mt-1 flex flex-col gap-1">
              {encerradas.map((rec) => (
                <span key={rec.id}>
                  {formatarDiaSemanaAbrev(rec.diaSemana)} às {rec.horaLocal} — encerrado em{' '}
                  {rec.vigenciaFim ? formatarDataCurta(rec.vigenciaFim) : ''}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="grid grid-cols-5 items-end gap-2 border-t border-border pt-3">
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
          <Label htmlFor="atendimento-existente-hora">Hora</Label>
          <Input
            id="atendimento-existente-hora"
            type="time"
            value={horaLocal}
            onChange={(event) => setHoraLocal(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="atendimento-existente-duracao">Duração (min)</Label>
          <Input
            id="atendimento-existente-duracao"
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
        <Button type="button" variant="outline" disabled={adicionando} onClick={handleAdicionar}>
          {adicionando ? 'Adicionando…' : 'Adicionar horário'}
        </Button>
      </div>
    </div>
  )
}
