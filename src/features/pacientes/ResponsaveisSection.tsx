import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ParentescoResponsavel, Responsavel, ResponsavelInput } from './types'
import { formatarParentesco } from './formatters'

interface ResponsaveisSectionProps {
  responsaveis: Responsavel[]
  onCriar: (input: ResponsavelInput) => Promise<void>
  onRemover: (id: string) => Promise<void>
}

const PARENTESCO_OPTIONS: ParentescoResponsavel[] = ['mae', 'pai', 'avo', 'tutor', 'outro']

const NOVO_RESPONSAVEL_VAZIO: ResponsavelInput = {
  nome: '',
  parentesco: 'mae',
  telefone: null,
  email: null,
  cpf: null,
  principal: false,
  pagador: false
}

/** Só aparece quando o paciente é menor de idade (SPEC-fase-1.md, guarda compartilhada é o caso comum). */
export function ResponsaveisSection({ responsaveis, onCriar, onRemover }: ResponsaveisSectionProps) {
  const [novo, setNovo] = useState<ResponsavelInput>(NOVO_RESPONSAVEL_VAZIO)
  const [adicionando, setAdicionando] = useState(false)

  async function handleAdicionar(): Promise<void> {
    if (!novo.nome.trim()) return
    setAdicionando(true)
    await onCriar(novo)
    setAdicionando(false)
    setNovo(NOVO_RESPONSAVEL_VAZIO)
  }

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Responsáveis legais</h3>
      </div>

      <div className="flex flex-col gap-3 p-[20px_18px]">
      {responsaveis.length === 0 && (
        <p className="text-[13px] text-destructive">
          Nenhum responsável cadastrado. O paciente pode ser salvo mesmo assim, mas cadastre um responsável assim que
          possível.
        </p>
      )}

      {responsaveis.map((responsavel) => (
        <div key={responsavel.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <div>
            <span className="font-medium">{responsavel.nome}</span>
            <span className="text-muted-foreground"> · {formatarParentesco(responsavel.parentesco)}</span>
            {responsavel.principal && <span className="ml-2 text-xs text-primary">principal</span>}
            {responsavel.pagador && <span className="ml-2 text-xs text-primary">pagador</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => void onRemover(responsavel.id)}>
            Remover
          </Button>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="resp-nome">Nome</Label>
          <Input id="resp-nome" value={novo.nome} onChange={(event) => setNovo({ ...novo, nome: event.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Parentesco</Label>
          <Select value={novo.parentesco} onValueChange={(value) => setNovo({ ...novo, parentesco: value as ParentescoResponsavel })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARENTESCO_OPTIONS.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {formatarParentesco(opcao)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="resp-telefone">Telefone</Label>
          <Input
            id="resp-telefone"
            value={novo.telefone ?? ''}
            onChange={(event) => setNovo({ ...novo, telefone: event.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="resp-email">E-mail</Label>
          <Input
            id="resp-email"
            value={novo.email ?? ''}
            onChange={(event) => setNovo({ ...novo, email: event.target.value || null })}
          />
        </div>
        <div className="col-span-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="resp-principal"
              checked={novo.principal ?? false}
              onCheckedChange={(value) => setNovo({ ...novo, principal: value === true })}
            />
            <Label htmlFor="resp-principal" className="font-normal">
              Contato principal
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="resp-pagador"
              checked={novo.pagador ?? false}
              onCheckedChange={(value) => setNovo({ ...novo, pagador: value === true })}
            />
            <Label htmlFor="resp-pagador" className="font-normal">
              Pagador (recibo)
            </Label>
          </div>
        </div>
      </div>
      <Button type="button" variant="outline" className="self-start" disabled={adicionando || !novo.nome.trim()} onClick={handleAdicionar}>
        Adicionar responsável
      </Button>
      </div>
    </div>
  )
}
