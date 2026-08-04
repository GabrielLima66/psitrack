import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarDataCurta, formatarHoraLocal, formatarModalidade, formatarStatusSessao } from './formatters'
import { hojeLocal, utcParaDataLocal } from './tempo'
import type { SessaoComPaciente, StatusSessao } from './types'

interface PainelSessaoProps {
  sessao: SessaoComPaciente
  onFechar: () => void
  onAlterarStatus: (status: StatusSessao, motivo: string) => Promise<void>
  onRemarcar: (dataLocal: string, horaLocal: string) => Promise<void>
  onRegistrarEvolucao: () => Promise<void>
}

const STATUS_OPCOES: { value: StatusSessao; label: string }[] = [
  { value: 'realizada', label: 'Realizada' },
  { value: 'falta_sem_aviso', label: 'Falta sem aviso' },
  { value: 'falta_com_aviso', label: 'Falta com aviso' },
  { value: 'cancelada_profissional', label: 'Cancelada' }
]

/**
 * Ações de mudança de status são diretas (manuais) nesta etapa — não
 * disparam cobrança ainda (isso é Etapa 12: "via registro de evolução ou
 * direto na agenda"). "Remarcar" é sempre oferecido, não só depois de marcar
 * falta com aviso: mais simples e ainda cobre D22 (origem nunca cobra, quem
 * cobra é o destino).
 *
 * Barra fixa no rodapé da tela (Etapa 5 do redesign) — antes era um card
 * empilhado abaixo da grade.
 */
export function PainelSessao({ sessao, onFechar, onAlterarStatus, onRemarcar, onRegistrarEvolucao }: PainelSessaoProps) {
  const [novoStatus, setNovoStatus] = useState<StatusSessao>('realizada')
  const [motivo, setMotivo] = useState('')
  const [remarcando, setRemarcando] = useState(false)
  const [dataRemarcar, setDataRemarcar] = useState(hojeLocal())
  const [horaRemarcar, setHoraRemarcar] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleAlterarStatus(): Promise<void> {
    setSalvando(true)
    await onAlterarStatus(novoStatus, motivo)
    setSalvando(false)
  }

  async function handleRemarcar(): Promise<void> {
    if (!horaRemarcar) return
    setSalvando(true)
    await onRemarcar(dataRemarcar, horaRemarcar)
    setSalvando(false)
  }

  return (
    <div className="flex flex-col gap-2 rounded-[0.625rem] border border-border bg-card p-[16px_18px] shadow-md">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <h3 className="text-[14.5px] font-semibold text-foreground">{sessao.pacienteNome}</h3>
          <p className="text-[12.5px] text-muted-foreground">
            {formatarDataCurta(utcParaDataLocal(sessao.inicioUtc))} · {formatarHoraLocal(sessao.inicioUtc)} ·{' '}
            {formatarModalidade(sessao.modalidade)} · {formatarStatusSessao(sessao.status)}
          </p>
        </div>

        <div className="h-8 w-px shrink-0 bg-border" />

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select value={novoStatus} onValueChange={(value) => setNovoStatus(value as StatusSessao)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPCOES.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-40"
            placeholder="Motivo (opcional)"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
          />
          <Button type="button" className="h-8" disabled={salvando} onClick={handleAlterarStatus}>
            Salvar status
          </Button>
          {!remarcando && (
            <Button type="button" variant="outline" className="h-8" onClick={() => setRemarcando(true)}>
              Remarcar
            </Button>
          )}
          <Button type="button" variant="outline" className="h-8" onClick={onRegistrarEvolucao}>
            Registrar evolução
          </Button>
        </div>

        <button type="button" className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground" onClick={onFechar}>
          Fechar
        </button>
      </div>

      {sessao.status === 'remarcada' && (
        <p className="text-xs text-muted-foreground">Esta sessão foi remarcada — não gera cobrança (D22).</p>
      )}

      {remarcando && (
        <div className="flex items-end gap-2 border-t border-border pt-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="painel-remarcar-data">Nova data</Label>
            <Input
              id="painel-remarcar-data"
              type="date"
              value={dataRemarcar}
              onChange={(event) => setDataRemarcar(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="painel-remarcar-hora">Nova hora</Label>
            <Input
              id="painel-remarcar-hora"
              type="time"
              value={horaRemarcar}
              onChange={(event) => setHoraRemarcar(event.target.value)}
            />
          </div>
          <Button type="button" disabled={salvando || !horaRemarcar} onClick={handleRemarcar}>
            Confirmar remarcação
          </Button>
          <Button type="button" variant="ghost" onClick={() => setRemarcando(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
