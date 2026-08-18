import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { MensagemTemplateInput } from './types'

interface TemplateFormProps {
  valorInicial?: MensagemTemplateInput
  onSalvar: (input: MensagemTemplateInput) => Promise<boolean>
  onCancelar: () => void
}

const PLACEHOLDERS = ['{paciente}', '{data}', '{hora}', '{modalidade}']

export function TemplateForm({ valorInicial, onSalvar, onCancelar }: TemplateFormProps) {
  const [nome, setNome] = useState(valorInicial?.nome ?? '')
  const [corpo, setCorpo] = useState(valorInicial?.corpo ?? '')
  const [padrao, setPadrao] = useState(valorInicial?.padrao ?? false)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar(): Promise<void> {
    setSalvando(true)
    const ok = await onSalvar({ nome: nome.trim(), corpo: corpo.trim(), padrao })
    setSalvando(false)
    if (ok) onCancelar()
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="template-nome">Nome</Label>
        <Input id="template-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Confirmação padrão" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="template-corpo">Mensagem</Label>
        <Textarea id="template-corpo" rows={4} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Placeholders disponíveis:{' '}
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="mx-0.5 rounded bg-background px-1 py-0.5 font-mono">
              {p}
            </code>
          ))}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="template-padrao" checked={padrao} onCheckedChange={(v) => setPadrao(v === true)} />
        <Label htmlFor="template-padrao" className="font-normal">
          Usar como padrão nas confirmações do dia
        </Label>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={salvando || !nome.trim() || !corpo.trim()} onClick={handleSalvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
