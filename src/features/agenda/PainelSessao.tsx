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
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{sessao.pacienteNome}</h3>
          <p className="text-xs text-muted-foreground">
            {formatarDataCurta(utcParaDataLocal(sessao.inicioUtc))} · {formatarHoraLocal(sessao.inicioUtc)} ·{' '}
            {formatarModalidade(sessao.modalidade)} · {formatarStatusSessao(sessao.status)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onFechar}>
          Fechar
        </Button>
      </div>

      {sessao.status === 'remarcada' && (
        <p className="text-xs text-muted-foreground">Esta sessão foi remarcada — não gera cobrança (D22).</p>
      )}

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label>Novo status</Label>
          <Select value={novoStatus} onValueChange={(value) => setNovoStatus(value as StatusSessao)}>
            <SelectTrigger className="w-44">
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
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="painel-motivo">Motivo (opcional)</Label>
          <Input id="painel-motivo" value={motivo} onChange={(event) => setMotivo(event.target.value)} />
        </div>
        <Button type="button" disabled={salvando} onClick={handleAlterarStatus}>
          Salvar
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {!remarcando ? (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setRemarcando(true)}>
            Remarcar (encaixe)
          </Button>
        ) : (
          <div className="flex items-end gap-2">
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

      <div className="border-t border-border pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onRegistrarEvolucao}>
          Registrar evolução
        </Button>
      </div>
    </div>
  )
}
