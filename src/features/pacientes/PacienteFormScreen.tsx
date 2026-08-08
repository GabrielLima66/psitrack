import { ChevronLeft, Lock, NotebookText, Paperclip, User, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MotivoEncerramento, OrigemPaciente, PacienteInput, StatusPaciente } from './types'
import { AnotacoesPrivadasSection } from './AnotacoesPrivadasSection'
import { AtendimentoExistenteSection } from './AtendimentoExistenteSection'
import { AtendimentoInicialSection } from './AtendimentoInicialSection'
import { DocumentosSection } from './DocumentosSection'
import { EvolucaoSection } from './EvolucaoSection'
import { FinanceiroSection } from './FinanceiroSection'
import { formatarMesAnoBr, formatarStatus } from './formatters'
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

const STATUS_BADGE_VARIANT = {
  ativo: 'success',
  pausado: 'warn',
  encerrado: 'outline'
} as const

const TAB_TRIGGER_CLASS =
  'h-[38px] gap-1.5 rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-1 text-[13.5px] font-medium text-muted-foreground shadow-none after:hidden hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground'

function inputVazio(): PacienteInput {
  return { nome: '', nomeSocial: null, dataNascimento: null, cpf: null, telefone: null, email: null, origem: null }
}

export function PacienteFormScreen() {
  // Exclui de propósito os campos que só a lista usa (pacientes, busca,
  // filtros, ...) — esta tela só existe enquanto uma ficha está aberta
  // (PacientesFlow desmonta uma ao montar a outra), mas selecionar só o que
  // é lido aqui evita reacoplar as duas telas se isso mudar no futuro.
  const store = usePacientesStore(
    useShallow((s) => ({
      pacienteEmEdicao: s.pacienteEmEdicao,
      formError: s.formError,
      formBusy: s.formBusy,
      pendenciaFinanceira: s.pendenciaFinanceira,
      salvarPaciente: s.salvarPaciente,
      alterarStatus: s.alterarStatus,
      voltarParaLista: s.voltarParaLista,

      responsaveis: s.responsaveis,
      criarResponsavel: s.criarResponsavel,
      removerResponsavel: s.removerResponsavel,

      evolucoes: s.evolucoes,
      criarEvolucao: s.criarEvolucao,
      retificarEvolucao: s.retificarEvolucao,
      criarEvolucaoComSessaoRetroativa: s.criarEvolucaoComSessaoRetroativa,
      prefillEvolucao: s.prefillEvolucao,
      limparPrefillEvolucao: s.limparPrefillEvolucao,

      anotacoes: s.anotacoes,
      criarAnotacao: s.criarAnotacao,
      atualizarAnotacao: s.atualizarAnotacao,
      excluirAnotacao: s.excluirAnotacao,

      recorrenciasRascunho: s.recorrenciasRascunho,
      adicionarRecorrenciaRascunho: s.adicionarRecorrenciaRascunho,
      removerRecorrenciaRascunho: s.removerRecorrenciaRascunho,
      contratoRascunho: s.contratoRascunho,
      setContratoRascunho: s.setContratoRascunho,
      recorrenciasPaciente: s.recorrenciasPaciente,
      adicionarRecorrenciaExistente: s.adicionarRecorrenciaExistente,
      encerrarRecorrenciaExistente: s.encerrarRecorrenciaExistente,

      contratoVigente: s.contratoVigente,
      historicoContratos: s.historicoContratos,
      lancamentos: s.lancamentos,
      pagamentos: s.pagamentos,
      reajustarContrato: s.reajustarContrato,
      criarLancamentoAjuste: s.criarLancamentoAjuste,
      cancelarLancamento: s.cancelarLancamento,
      marcarReciboEmitido: s.marcarReciboEmitido,

      anexos: s.anexos,
      anexosLixeira: s.anexosLixeira,
      anexosBusy: s.anexosBusy,
      anexosError: s.anexosError,
      anexarDocumento: s.anexarDocumento,
      excluirAnexo: s.excluirAnexo,
      restaurarAnexo: s.restaurarAnexo,
      lerAnexoParaPreview: s.lerAnexoParaPreview,
      salvarCopiaAnexo: s.salvarCopiaAnexo
    }))
  )
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

  const contextoPartes: ReactNode[] = existente
    ? [
        existente.dataNascimento ? `${calcularIdade(existente.dataNascimento)} anos` : null,
        existente.origem ? (ORIGEM_OPTIONS.find((o) => o.value === existente.origem)?.label ?? null) : null,
        <>
          Em atendimento desde <span className="font-mono">{formatarMesAnoBr(existente.createdAt)}</span>
        </>
      ].filter((parte) => parte !== null)
    : []

  const cadastroConteudo = (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
        <form onSubmit={handleSalvar}>
          <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
            <h3 className="text-[14.5px] font-semibold text-foreground">Dados cadastrais</h3>
            {existente && (
              <Button type="submit" className="h-[30px]" disabled={store.formBusy}>
                {store.formBusy ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-5 p-[20px_18px]">
            <div className="grid grid-cols-3 gap-5">
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
                  className="font-mono"
                  value={form.cpf ?? ''}
                  onChange={(event) => setForm({ ...form, cpf: event.target.value.replace(/\D/g, '') || null })}
                  maxLength={11}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  className="font-mono"
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

            {!existente && (
              <Button type="submit" disabled={store.formBusy} className="w-full">
                {store.formBusy ? 'Salvando…' : 'Salvar paciente'}
              </Button>
            )}
          </div>
        </form>
      </div>

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
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!existente ? (
        <>
          <div className="flex flex-col gap-3 border-b border-border bg-card px-8 pt-5 pb-4">
            <button
              type="button"
              onClick={store.voltarParaLista}
              className="flex w-fit items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-[13px]" />
              Pacientes
            </button>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">Novo paciente</h1>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-[1040px] flex-1 overflow-y-auto px-8 py-6">{cadastroConteudo}</div>
        </>
      ) : (
        <Tabs defaultValue="evolucao" className="flex h-full flex-col overflow-hidden">
          {/* Abas separadas de propósito (SPEC-fase-1.md): evolução e anotação
              privada têm regime jurídico oposto (a paciente tem direito a uma,
              nunca à outra) — precisam ser distinguíveis à primeira vista, sem
              ler o texto. Ícone + cor (tokens warn-*) fazem essa distinção. */}
          <div className="flex flex-col gap-3 border-b border-border bg-card px-8 pt-5">
            <button
              type="button"
              onClick={store.voltarParaLista}
              className="flex w-fit items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-[13px]" />
              Pacientes
            </button>

            <div className="flex items-start justify-between pb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">{existente.nomeSocial || existente.nome}</h1>
                  <Badge variant={STATUS_BADGE_VARIANT[existente.status]}>{formatarStatus(existente.status)}</Badge>
                </div>
                {contextoPartes.length > 0 && (
                  <p className="text-[13px] text-muted-foreground">
                    {contextoPartes.map((parte, indice) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <span key={indice}>
                        {indice > 0 && ' · '}
                        {parte}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={novoStatus} onValueChange={(value) => setNovoStatus(value as StatusPaciente)}>
                  <SelectTrigger className="h-[34px] w-44">
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
                    <SelectTrigger className="h-[34px] w-48">
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
                  className="h-[34px]"
                  disabled={store.formBusy || (novoStatus === 'encerrado' && !motivoEncerramento)}
                  onClick={handleAlterarStatus}
                >
                  Salvar status
                </Button>
              </div>
            </div>

            <TabsList variant="line" className="h-auto gap-6 p-0">
              <TabsTrigger value="cadastro" className={TAB_TRIGGER_CLASS}>
                <User className="size-[14px]" />
                Cadastro
              </TabsTrigger>
              <TabsTrigger value="evolucao" className={TAB_TRIGGER_CLASS}>
                <NotebookText className="size-[14px]" />
                Evolução clínica
              </TabsTrigger>
              <TabsTrigger value="anotacoes" className={`${TAB_TRIGGER_CLASS} data-[state=active]:text-warn-foreground dark:data-[state=active]:text-warn-foreground`}>
                <Lock className="size-[14px]" />
                Anotações privadas
              </TabsTrigger>
              <TabsTrigger value="financeiro" className={TAB_TRIGGER_CLASS}>
                <Wallet className="size-[14px]" />
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="documentos" className={TAB_TRIGGER_CLASS}>
                <Paperclip className="size-[14px]" />
                Documentos
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mx-auto min-h-0 w-full max-w-[1040px] flex-1 overflow-y-auto px-8 py-6">
            <TabsContent value="cadastro">{cadastroConteudo}</TabsContent>

            <TabsContent value="evolucao">
              {store.pendenciaFinanceira && (
                <Alert variant="warn" className="mb-3">
                  <AlertDescription>{store.pendenciaFinanceira}</AlertDescription>
                </Alert>
              )}
              <EvolucaoSection
                pacienteId={existente.id}
                evolucoes={store.evolucoes}
                onCriar={store.criarEvolucao}
                onRetificar={store.retificarEvolucao}
                onCriarComSessaoRetroativa={store.criarEvolucaoComSessaoRetroativa}
                prefill={store.prefillEvolucao}
                onPrefillConsumido={store.limparPrefillEvolucao}
                onAnexarDocumento={(evolucaoId) => store.anexarDocumento({ classificacao: 'prontuario', evolucaoId })}
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
            <TabsContent value="financeiro">
              <FinanceiroSection
                contratoVigente={store.contratoVigente}
                historicoContratos={store.historicoContratos}
                lancamentos={store.lancamentos}
                pagamentos={store.pagamentos}
                onReajustar={store.reajustarContrato}
                onCriarAjuste={store.criarLancamentoAjuste}
                onCancelarLancamento={store.cancelarLancamento}
                onMarcarReciboEmitido={store.marcarReciboEmitido}
              />
            </TabsContent>
            <TabsContent value="documentos">
              <DocumentosSection
                anexos={store.anexos}
                anexosLixeira={store.anexosLixeira}
                busy={store.anexosBusy}
                error={store.anexosError}
                onAnexar={store.anexarDocumento}
                onExcluir={store.excluirAnexo}
                onRestaurar={store.restaurarAnexo}
                onLer={store.lerAnexoParaPreview}
                onSalvarCopia={store.salvarCopiaAnexo}
              />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  )
}
