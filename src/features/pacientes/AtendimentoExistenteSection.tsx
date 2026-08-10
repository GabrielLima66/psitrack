import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarDataCurta, formatarDiaSemanaAbrev } from '../agenda/formatters'
import { hojeLocal as hoje } from '../agenda/tempo'
import type { ConflitoRecorrencia, ModalidadeAtendimento, Recorrencia, RecorrenciaInput } from '../agenda/types'
import { ConflitoRecorrenciaDialog } from './ConflitoRecorrenciaDialog'

interface AtendimentoExistenteSectionProps {
  recorrencias: Recorrencia[]
  onAdicionar: (input: RecorrenciaInput) => Promise<void>
  onEncerrar: (id: string, vigenciaFim: string) => Promise<void>
  onVerificarConflitos: (input: {
    diaSemana: number
    horaLocal: string
    duracaoMin: number
    vigenciaInicio: string
  }) => Promise<ConflitoRecorrencia[]>
}

/**
 * Gestão dos horários fixos de um paciente já cadastrado. "Encerrar" grava
 * `vigenciaFim` (nunca apaga a série) e cancela só as ocorrências futuras
 * ainda `agendada` — a agenda cuida disso (encerrarSerie), esta tela só
 * dispara a ação.
 */
export function AtendimentoExistenteSection({
  recorrencias,
  onAdicionar,
  onEncerrar,
  onVerificarConflitos
}: AtendimentoExistenteSectionProps) {
  const [diaSemana, setDiaSemana] = useState(1)
  const [horaLocal, setHoraLocal] = useState('14:00')
  const [duracaoMin, setDuracaoMin] = useState(50)
  const [modalidade, setModalidade] = useState<ModalidadeAtendimento>('presencial')
  const [adicionando, setAdicionando] = useState(false)
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [encerradasAbertas, setEncerradasAbertas] = useState(false)
  const [conflitos, setConflitos] = useState<ConflitoRecorrencia[]>([])

  const ativas = recorrencias.filter((r) => !r.vigenciaFim || r.vigenciaFim > hoje())
  const encerradas = recorrencias.filter((r) => r.vigenciaFim && r.vigenciaFim <= hoje())

  async function criarRecorrencia(): Promise<void> {
    setAdicionando(true)
    await onAdicionar({ diaSemana, horaLocal, duracaoMin, modalidade, vigenciaInicio: hoje() })
    setAdicionando(false)
    setMostrandoForm(false)
    setConflitos([])
  }

  async function handleAdicionar(): Promise<void> {
    const encontrados = await onVerificarConflitos({ diaSemana, horaLocal, duracaoMin, vigenciaInicio: hoje() })
    if (encontrados.length > 0) {
      setConflitos(encontrados)
      return
    }
    await criarRecorrencia()
  }

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Atendimento</h3>
        {!mostrandoForm && (
          <Button type="button" variant="outline" className="h-[30px]" onClick={() => setMostrandoForm(true)}>
            Adicionar recorrência
          </Button>
        )}
      </div>

      <div className="flex flex-col p-[20px_18px]">
        {ativas.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário fixo ativo.</p>}
        {ativas.map((rec) => (
          <div key={rec.id} className="flex h-11 items-center justify-between gap-3 border-b border-border last:border-0">
            <span className="font-mono text-[13.5px] text-foreground">
              {formatarDiaSemanaAbrev(rec.diaSemana)} · {rec.horaLocal}
            </span>
            <span className="flex-1 text-[13.5px] text-muted-foreground">
              {rec.modalidade === 'presencial' ? 'Presencial' : 'Online'} · {rec.duracaoMin} min · desde {formatarDataCurta(rec.vigenciaInicio)}
            </span>
            <button type="button" className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => onEncerrar(rec.id, hoje())}>
              Encerrar
            </button>
          </div>
        ))}
        {encerradas.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEncerradasAbertas((v) => !v)}
            >
              <ChevronDown className={`size-3.5 transition-transform ${encerradasAbertas ? 'rotate-180' : ''}`} />
              {encerradas.length} horário(s) encerrado(s)
            </button>
            {encerradasAbertas && (
              <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {encerradas.map((rec) => (
                  <span key={rec.id}>
                    {formatarDiaSemanaAbrev(rec.diaSemana)} às {rec.horaLocal} — encerrado em{' '}
                    {rec.vigenciaFim ? formatarDataCurta(rec.vigenciaFim) : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {mostrandoForm && (
          <div className="mt-3 grid grid-cols-5 items-end gap-2 rounded-md bg-muted p-3">
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
            <div className="flex gap-2">
              <Button type="button" disabled={adicionando} onClick={handleAdicionar}>
                {adicionando ? 'Adicionando…' : 'Adicionar'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMostrandoForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {conflitos.length > 0 && (
        <ConflitoRecorrenciaDialog
          conflitos={conflitos}
          onMudarHorario={() => setConflitos([])}
          onCriarMesmoAssim={() => void criarRecorrencia()}
        />
      )}
    </div>
  )
}
