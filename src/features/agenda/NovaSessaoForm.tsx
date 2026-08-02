import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hojeLocal } from './tempo'
import type { CriarSessaoAvulsaInput, ModalidadeAtendimento } from './types'

interface NovaSessaoFormProps {
  pacientes: { id: string; nome: string }[]
  onCriar: (input: CriarSessaoAvulsaInput) => Promise<boolean>
  onCancelar: () => void
}

/** Sessão avulsa fora de qualquer recorrência (escopo da Etapa 11). */
export function NovaSessaoForm({ pacientes, onCriar, onCancelar }: NovaSessaoFormProps) {
  const [pacienteId, setPacienteId] = useState(pacientes[0]?.id ?? '')
  const [dataLocal, setDataLocal] = useState(hojeLocal())
  const [horaLocal, setHoraLocal] = useState('14:00')
  const [duracaoMin, setDuracaoMin] = useState(50)
  const [modalidade, setModalidade] = useState<ModalidadeAtendimento>('presencial')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // `pacientes` chega vazio no primeiro render (carrega async em
  // abrirNovaSessao) — sem isto o valor inicial do useState fica travado em
  // '' mesmo depois da lista carregar, e o Select nunca teria um default.
  useEffect(() => {
    if (!pacienteId && pacientes.length > 0) setPacienteId(pacientes[0]!.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacientes])

  async function handleCriar(): Promise<void> {
    if (!pacienteId) {
      setErro('Selecione um paciente.')
      return
    }
    setSalvando(true)
    setErro(null)
    const ok = await onCriar({ pacienteId, dataLocal, horaLocal, duracaoMin, modalidade })
    setSalvando(false)
    if (!ok) setErro('Não foi possível criar a sessão.')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Nova sessão avulsa</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label>Paciente</Label>
          <Select value={pacienteId} onValueChange={setPacienteId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar…" />
            </SelectTrigger>
            <SelectContent>
              {pacientes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div className="flex flex-col gap-1">
          <Label htmlFor="nova-sessao-data">Data</Label>
          <Input id="nova-sessao-data" type="date" value={dataLocal} onChange={(event) => setDataLocal(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nova-sessao-hora">Hora</Label>
          <Input id="nova-sessao-hora" type="time" value={horaLocal} onChange={(event) => setHoraLocal(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="nova-sessao-duracao">Duração (min)</Label>
          <Input
            id="nova-sessao-duracao"
            type="number"
            min={1}
            value={duracaoMin}
            onChange={(event) => setDuracaoMin(Number(event.target.value))}
          />
        </div>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button type="button" disabled={salvando} onClick={handleCriar}>
          {salvando ? 'Criando…' : 'Criar sessão'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
