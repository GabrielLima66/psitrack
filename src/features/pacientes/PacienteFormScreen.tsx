import { Lock, NotebookText } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MotivoEncerramento, OrigemPaciente, PacienteInput, StatusPaciente } from './types'
import { AnotacoesPrivadasSection } from './AnotacoesPrivadasSection'
import { AtendimentoExistenteSection } from './AtendimentoExistenteSection'
import { AtendimentoInicialSection } from './AtendimentoInicialSection'
import { EvolucaoSection } from './EvolucaoSection'
import { formatarStatus } from './formatters'
import { calcularIdade, isMenorDeIdade } from './idade'
import { ResponsaveisSection } from './ResponsaveisSection'
import { usePacientesStore } from './store'

const ORIGEM_OPTIONS: { value: OrigemPaciente; label: string }[] = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'convenio', label: 'Convênio' },
  { value: 'redes', label: 'Redes sociais' },
  { value: 'outro', label: 'Outro' }
]

const MOTIVO_OPTIONS: { value: MotivoEncerramento; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'abandono', label: 'Abandono' },
  { value: 'encaminhamento', label: 'Encaminhamento' },
  { value: 'outro', label: 'Outro' }
]

function inputVazio(): PacienteInput {
  return { nome: '', nomeSocial: null, dataNascimento: null, cpf: null, telefone: null, email: null, origem: null }
}

export function PacienteFormScreen() {
  const store = usePacientesStore()
  const existente = store.pacienteEmEdicao

  const [form, setForm] = useState<PacienteInput>(() =>
    existente
      ? {
          nome: existente.nome,
          nomeSocial: existente.nomeSocial,
          dataNascimento: existente.dataNascimento,
          cpf: existente.cpf,
          telefone: existente.telefone,
          email: existente.email,
          origem: existente.origem
        }
      : inputVazio()
  )
  const [novoStatus, setNovoStatus] = useState<StatusPaciente>(existente?.status ?? 'ativo')
  const [motivoEncerramento, setMotivoEncerramento] = useState<MotivoEncerramento | null>(existente?.motivoEncerramento ?? null)

  const menor = form.dataNascimento ? isMenorDeIdade(form.dataNascimento) : false

  async function handleSalvar(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    await store.salvarPaciente(form)
  }

  async function handleAlterarStatus(): Promise<void> {
    await store.alterarStatus({ status: novoStatus, motivoEncerramento: novoStatus === 'encerrado' ? motivoEncerramento : null })
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 overflow-y-auto p-8">
      <button
        type="button"
        onClick={store.voltarParaLista}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        ← Voltar para a lista
      </button>

      <h1 className="text-2xl font-semibold text-foreground">{existente ? 'Editar paciente' : 'Novo paciente'}</h1>

      <form onSubmit={handleSalvar} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nomeSocial">Nome social</Label>
            <Input
              id="nomeSocial"
              value={form.nomeSocial ?? ''}
              onChange={(event) => setForm({ ...form, nomeSocial: event.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dataNascimento">Data de nascimento</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={form.dataNascimento ?? ''}
              onChange={(event) => setForm({ ...form, dataNascimento: event.target.value || null })}
            />
            {form.dataNascimento && (
              <span className="text-xs text-muted-foreground">
                {calcularIdade(form.dataNascimento)} anos{menor ? ' · menor de idade' : ''}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={form.cpf ?? ''}
              onChange={(event) => setForm({ ...form, cpf: event.target.value.replace(/\D/g, '') || null })}
              maxLength={11}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={form.telefone ?? ''}
              onChange={(event) => setForm({ ...form, telefone: event.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              value={form.email ?? ''}
              onChange={(event) => setForm({ ...form, email: event.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Como chegou até você</Label>
            <Select
              value={form.origem ?? undefined}
              onValueChange={(value) => setForm({ ...form, origem: value as OrigemPaciente })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_OPTIONS.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {store.formError && <p className="text-sm text-destructive">{store.formError}</p>}

        <Button type="submit" disabled={store.formBusy} className="w-full">
          {store.formBusy ? 'Salvando…' : 'Salvar paciente'}
        </Button>
      </form>

      {!existente && (
        <AtendimentoInicialSection
          recorrencias={store.recorrenciasRascunho}
          onAdicionar={store.adicionarRecorrenciaRascunho}
          onRemover={store.removerRecorrenciaRascunho}
          contrato={store.contratoRascunho}
          onContratoChange={store.setContratoRascunho}
        />
      )}

      {existente && (
        <AtendimentoExistenteSection
          recorrencias={store.recorrenciasPaciente}
          onAdicionar={store.adicionarRecorrenciaExistente}
          onEncerrar={store.encerrarRecorrenciaExistente}
        />
      )}

      {menor && !existente && (
        <p className="text-sm text-muted-foreground">Salve o cadastro para poder adicionar responsáveis legais.</p>
      )}

      {menor && existente && (
        <ResponsaveisSection
          responsaveis={store.responsaveis}
          onCriar={store.criarResponsavel}
          onRemover={store.removerResponsavel}
        />
      )}

      {existente && (
        // Abas separadas de propósito (SPEC-fase-1.md): evolução e anotação
        // privada têm regime jurídico oposto (a paciente tem direito a uma,
        // nunca à outra) — precisam ser distinguíveis à primeira vista, sem
        // ler o texto. Ícone + cor (tokens warn-*) fazem essa distinção.
        <Tabs defaultValue="evolucao">
          <TabsList>
            <TabsTrigger value="evolucao" className="gap-1.5">
              <NotebookText className="size-4" />
              Evolução clínica
            </TabsTrigger>
            <TabsTrigger value="anotacoes" className="gap-1.5 data-[state=active]:text-warn-foreground">
              <Lock className="size-4" />
              Anotações privadas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="evolucao">
            <EvolucaoSection
              pacienteId={existente.id}
              evolucoes={store.evolucoes}
              onCriar={store.criarEvolucao}
              onRetificar={store.retificarEvolucao}
              prefill={store.prefillEvolucao}
              onPrefillConsumido={store.limparPrefillEvolucao}
            />
          </TabsContent>
          <TabsContent value="anotacoes">
            <AnotacoesPrivadasSection
              anotacoes={store.anotacoes}
              onCriar={store.criarAnotacao}
              onAtualizar={store.atualizarAnotacao}
              onExcluir={store.excluirAnotacao}
            />
          </TabsContent>
        </Tabs>
      )}

      {existente && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Status do atendimento</h3>
          <div className="flex items-center gap-3">
            <Select value={novoStatus} onValueChange={(value) => setNovoStatus(value as StatusPaciente)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">{formatarStatus('ativo')}</SelectItem>
                <SelectItem value="pausado">{formatarStatus('pausado')}</SelectItem>
                <SelectItem value="encerrado">{formatarStatus('encerrado')}</SelectItem>
              </SelectContent>
            </Select>

            {novoStatus === 'encerrado' && (
              <Select
                value={motivoEncerramento ?? undefined}
                onValueChange={(value) => setMotivoEncerramento(value as MotivoEncerramento)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Motivo do encerramento…" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVO_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={store.formBusy || (novoStatus === 'encerrado' && !motivoEncerramento)}
              onClick={handleAlterarStatus}
            >
              Atualizar status
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
