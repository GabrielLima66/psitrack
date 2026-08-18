import { create } from 'zustand'
import { hojeLocal } from '../agenda/tempo'
import type {
  ConflitoRecorrencia,
  ContratoPreco,
  ContratoPrecoInput,
  EstornarPagamentoInput,
  Lancamento,
  LancamentoAjusteInput,
  MarcarReciboEmitidoInput,
  Pagamento,
  Recorrencia,
  RecorrenciaInput
} from '../agenda/types'
import type {
  AlterarStatusInput,
  Anexo,
  AnexarViaDialogoInput,
  Anotacao,
  AnotacaoInput,
  CriarEvolucaoComSessaoRetroativaInput,
  CriarEvolucaoInput,
  Diagnostico,
  DiagnosticoInput,
  Encaminhamento,
  EncaminhamentoInput,
  Evolucao,
  FichaClinica,
  FichaClinicaInput,
  ListarPacientesOptions,
  Medicamento,
  MedicamentoInput,
  Paciente,
  PacienteComUltimaSessao,
  PacienteInput,
  RetificarEvolucaoInput,
  Responsavel,
  ResponsavelInput
} from './types'

export type PacientesScreen = 'lista' | 'form'

function contratoRascunhoVazio(): ContratoPrecoInput {
  return { modalidade: 'avulso', valorCentavos: 0, politicaFalta: 'cobra_sem_aviso', vigenciaInicio: hojeLocal() }
}

/** Rascunho do quadro clínico durante o cadastro (SPEC-fase-5.md, revisão de D49) — string simples, nunca null, pra controlar o Input direto. */
export interface FichaRascunho {
  demandaInicial: string
  abordagem: string
}

function fichaRascunhoVazia(): FichaRascunho {
  return { demandaInicial: '', abordagem: '' }
}

interface PacientesStoreState {
  screen: PacientesScreen
  pacientes: PacienteComUltimaSessao[]
  loading: boolean
  listError: string | null

  filtroStatus: ListarPacientesOptions['status'] | undefined
  filtroArquivados: boolean
  busca: string

  pacienteEmEdicao: Paciente | null // null = criando um novo
  responsaveis: Responsavel[]
  evolucoes: Evolucao[]
  anotacoes: Anotacao[]
  formError: string | null
  formBusy: boolean

  carregarPacientes: () => Promise<void>
  setFiltroStatus: (status: ListarPacientesOptions['status'] | undefined) => void
  setFiltroArquivados: (arquivados: boolean) => void
  setBusca: (busca: string) => void

  abrirNovoPaciente: () => void
  abrirEdicaoPaciente: (paciente: Paciente) => Promise<void>
  voltarParaLista: () => void

  salvarPaciente: (input: PacienteInput) => Promise<boolean>
  alterarStatus: (input: AlterarStatusInput) => Promise<boolean>
  arquivar: (id: string) => Promise<void>
  restaurar: (id: string) => Promise<void>

  criarResponsavel: (input: ResponsavelInput) => Promise<void>
  atualizarResponsavel: (id: string, input: ResponsavelInput) => Promise<void>
  removerResponsavel: (id: string) => Promise<void>

  criarEvolucao: (input: CriarEvolucaoInput) => Promise<boolean>
  retificarEvolucao: (input: RetificarEvolucaoInput) => Promise<boolean>
  criarEvolucaoComSessaoRetroativa: (input: CriarEvolucaoComSessaoRetroativaInput) => Promise<boolean>
  /** Setado sempre que uma ação de cobrança sinaliza pendência por falta de contrato vigente (Etapa 12). */
  pendenciaFinanceira: string | null

  criarAnotacao: (input: AnotacaoInput) => Promise<void>
  atualizarAnotacao: (id: string, input: AnotacaoInput) => Promise<void>
  excluirAnotacao: (id: string) => Promise<void>

  // Aba Informações clínicas (Etapa 22/SPEC-fase-5.md): retrato clínico
  // estável, editável — ao contrário da evolução, que é append-only.
  fichaClinica: FichaClinica | null
  medicamentos: Medicamento[]
  diagnosticos: Diagnostico[]
  encaminhamentos: Encaminhamento[]
  clinicoError: string | null
  carregarClinico: () => Promise<void>
  salvarFichaClinica: (input: FichaClinicaInput) => Promise<boolean>
  criarMedicamento: (input: MedicamentoInput) => Promise<boolean>
  atualizarMedicamento: (id: string, input: MedicamentoInput) => Promise<boolean>
  removerMedicamento: (id: string) => Promise<void>
  criarDiagnostico: (input: DiagnosticoInput) => Promise<boolean>
  atualizarDiagnostico: (id: string, input: DiagnosticoInput) => Promise<boolean>
  removerDiagnostico: (id: string) => Promise<void>
  criarEncaminhamento: (input: EncaminhamentoInput) => Promise<boolean>
  atualizarEncaminhamento: (id: string, input: EncaminhamentoInput) => Promise<boolean>
  removerEncaminhamento: (id: string) => Promise<void>

  // Aba Documentos (Etapa 16): ativos e lixeira carregados juntos, mesmo
  // padrão de carregarFinanceiro. `anexosError` é só pra falha real de IPC —
  // diálogo cancelado pela usuária nunca vira erro.
  anexos: Anexo[]
  anexosLixeira: Anexo[]
  anexosBusy: boolean
  anexosError: string | null
  carregarAnexos: () => Promise<void>
  anexarDocumento: (input: AnexarViaDialogoInput) => Promise<boolean>
  excluirAnexo: (id: string) => Promise<void>
  restaurarAnexo: (id: string) => Promise<void>
  lerAnexoParaPreview: (id: string) => Promise<{ bytes: Uint8Array; mime: string; nomeOriginal: string } | null>
  salvarCopiaAnexo: (id: string) => Promise<void>

  // Atendimento (Etapa 11/D24): horários fixos + contrato inicial, só existem
  // como rascunho ENQUANTO o paciente ainda não foi salvo — depois de salvo,
  // viram `recorrenciasPaciente` (persistidas) e o contrato não é mais
  // editado por aqui (reajuste é Etapa 12, aba Financeiro).
  recorrenciasRascunho: RecorrenciaInput[]
  contratoRascunho: ContratoPrecoInput
  recorrenciasPaciente: Recorrencia[]
  /** Quadro clínico (demanda inicial + abordagem) — obrigatório só no cadastro novo (SPEC-fase-5.md, revisão de D49). */
  fichaRascunho: FichaRascunho

  adicionarRecorrenciaRascunho: (input: RecorrenciaInput) => void
  removerRecorrenciaRascunho: (index: number) => void
  setContratoRascunho: (contrato: ContratoPrecoInput) => void
  setFichaRascunho: (ficha: FichaRascunho) => void

  adicionarRecorrenciaExistente: (input: RecorrenciaInput) => Promise<void>
  encerrarRecorrenciaExistente: (id: string, vigenciaFim: string) => Promise<void>
  /** Aviso, não bloqueio — chamado ANTES de adicionar um horário fixo (rascunho ou existente) pra avisar se outro paciente já ocupa aquele dia/hora. */
  verificarConflitosRecorrencia: (
    input: { diaSemana: number; horaLocal: string; duracaoMin: number; vigenciaInicio: string },
    excludingRecorrenciaId?: string
  ) => Promise<ConflitoRecorrencia[]>

  // Atalho "registrar evolução" clicado a partir da agenda (Etapa 11).
  prefillEvolucao: { sessaoId: string; dataSessao: string } | null
  abrirParaRegistrarEvolucao: (pacienteId: string, sessaoId: string, dataSessaoLocal: string) => Promise<void>
  limparPrefillEvolucao: () => void

  // Aba Financeiro (Etapa 12): contrato vigente + histórico de vigências +
  // lançamentos. Carregados só quando a aba é aberta (carregarFinanceiro),
  // não junto com o resto da ficha.
  contratoVigente: ContratoPreco | null
  historicoContratos: ContratoPreco[]
  lancamentos: Lancamento[]
  pagamentos: Pagamento[]
  financeiroBusy: boolean
  financeiroError: string | null

  carregarFinanceiro: () => Promise<void>
  reajustarContrato: (input: ContratoPrecoInput) => Promise<number | null> // devolve quantos lançamentos existem no período afetado, ou null se falhou
  criarLancamentoAjuste: (input: LancamentoAjusteInput) => Promise<boolean>
  cancelarLancamento: (id: string) => Promise<void>
  reabrirLancamento: (id: string) => Promise<void>
  marcarReciboEmitido: (pagamentoId: string, input: MarcarReciboEmitidoInput) => Promise<void>
  estornarPagamento: (pagamentoId: string, input: EstornarPagamentoInput) => Promise<boolean>
}

export const usePacientesStore = create<PacientesStoreState>((set, get) => ({
  screen: 'lista',
  pacientes: [],
  loading: false,
  listError: null,

  filtroStatus: 'ativo',
  filtroArquivados: false,
  busca: '',

  pacienteEmEdicao: null,
  responsaveis: [],
  evolucoes: [],
  anotacoes: [],
  formError: null,
  formBusy: false,

  anexos: [],
  anexosLixeira: [],
  anexosBusy: false,
  anexosError: null,

  fichaClinica: null,
  medicamentos: [],
  diagnosticos: [],
  encaminhamentos: [],
  clinicoError: null,

  recorrenciasRascunho: [],
  contratoRascunho: contratoRascunhoVazio(),
  recorrenciasPaciente: [],
  fichaRascunho: fichaRascunhoVazia(),
  prefillEvolucao: null,
  pendenciaFinanceira: null,

  contratoVigente: null,
  historicoContratos: [],
  lancamentos: [],
  pagamentos: [],
  financeiroBusy: false,
  financeiroError: null,

  carregarPacientes: async () => {
    set({ loading: true, listError: null })
    const { filtroStatus, filtroArquivados, busca } = get()
    const result = await window.psitrack.paciente.listar({
      status: filtroArquivados ? undefined : filtroStatus,
      arquivados: filtroArquivados,
      busca: busca.trim() || undefined
    })
    if (result.ok) {
      set({ loading: false, pacientes: result.pacientes })
    } else {
      set({ loading: false, listError: result.error })
    }
  },

  setFiltroStatus: (status) => {
    set({ filtroStatus: status })
    void get().carregarPacientes()
  },
  setFiltroArquivados: (arquivados) => {
    set({ filtroArquivados: arquivados })
    void get().carregarPacientes()
  },
  setBusca: (busca) => {
    set({ busca })
    void get().carregarPacientes()
  },

  abrirNovoPaciente: () =>
    set({
      screen: 'form',
      pacienteEmEdicao: null,
      responsaveis: [],
      evolucoes: [],
      anotacoes: [],
      anexos: [],
      anexosLixeira: [],
      anexosError: null,
      formError: null,
      recorrenciasRascunho: [],
      contratoRascunho: contratoRascunhoVazio(),
      recorrenciasPaciente: [],
      fichaRascunho: fichaRascunhoVazia(),
      prefillEvolucao: null,
      pendenciaFinanceira: null,
      contratoVigente: null,
      historicoContratos: [],
      lancamentos: [],
      pagamentos: [],
      fichaClinica: null,
      medicamentos: [],
      diagnosticos: [],
      encaminhamentos: [],
      clinicoError: null
    }),

  abrirEdicaoPaciente: async (paciente) => {
    set({
      screen: 'form',
      pacienteEmEdicao: paciente,
      responsaveis: [],
      evolucoes: [],
      anotacoes: [],
      anexos: [],
      anexosLixeira: [],
      anexosError: null,
      formError: null,
      recorrenciasPaciente: [],
      prefillEvolucao: null,
      pendenciaFinanceira: null,
      contratoVigente: null,
      historicoContratos: [],
      lancamentos: [],
      pagamentos: [],
      fichaClinica: null,
      medicamentos: [],
      diagnosticos: [],
      encaminhamentos: [],
      clinicoError: null
    })
    // Financeiro/Documentos/Clínico só dependem do id (já setado acima), não
    // do resultado das 4 chamadas abaixo — dispara em paralelo com elas em
    // vez de encadeado depois, senão a ficha paga dois round-trips IPC em
    // série pra só abrir.
    void get().carregarFinanceiro()
    void get().carregarAnexos()
    void get().carregarClinico()
    const [responsaveis, evolucoes, anotacoes, recorrencias] = await Promise.all([
      window.psitrack.responsavel.listar(paciente.id),
      window.psitrack.evolucao.listar(paciente.id),
      window.psitrack.anotacao.listar(paciente.id),
      window.psitrack.recorrencia.listar(paciente.id)
    ])
    if (responsaveis.ok) set({ responsaveis: responsaveis.responsaveis })
    if (evolucoes.ok) set({ evolucoes: evolucoes.evolucoes })
    if (anotacoes.ok) set({ anotacoes: anotacoes.anotacoes })
    if (recorrencias.ok) set({ recorrenciasPaciente: recorrencias.recorrencias })
  },

  voltarParaLista: () => {
    set({ screen: 'lista', pacienteEmEdicao: null, responsaveis: [], evolucoes: [], anotacoes: [], anexos: [], anexosLixeira: [] })
    void get().carregarPacientes()
  },

  salvarPaciente: async (input) => {
    set({ formBusy: true, formError: null })
    const existente = get().pacienteEmEdicao
    const result = existente
      ? await window.psitrack.paciente.atualizar(existente.id, input)
      : await window.psitrack.paciente.criarComAtendimento({
          paciente: input,
          recorrencias: get().recorrenciasRascunho,
          contrato: get().contratoRascunho,
          fichaClinica: {
            demandaInicial: get().fichaRascunho.demandaInicial.trim(),
            abordagem: get().fichaRascunho.abordagem.trim()
          }
        })

    if (result.ok) {
      set({ formBusy: false, pacienteEmEdicao: result.paciente })
      if (!existente) {
        const recorrencias = await window.psitrack.recorrencia.listar(result.paciente.id)
        if (recorrencias.ok) set({ recorrenciasPaciente: recorrencias.recorrencias })
        void get().carregarFinanceiro()
        void get().carregarClinico()
      }
      return true
    }
    set({ formBusy: false, formError: result.error })
    return false
  },

  alterarStatus: async (input) => {
    const existente = get().pacienteEmEdicao
    if (!existente) return false
    set({ formBusy: true, formError: null })
    const result = await window.psitrack.paciente.alterarStatus(existente.id, input)
    if (result.ok) {
      set({ formBusy: false, pacienteEmEdicao: result.paciente })
      return true
    }
    set({ formBusy: false, formError: result.error })
    return false
  },

  arquivar: async (id) => {
    await window.psitrack.paciente.arquivar(id)
    void get().carregarPacientes()
  },

  restaurar: async (id) => {
    await window.psitrack.paciente.restaurar(id)
    void get().carregarPacientes()
  },

  criarResponsavel: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.responsavel.criar(paciente.id, input)
    if (result.ok) {
      const lista = await window.psitrack.responsavel.listar(paciente.id)
      if (lista.ok) set({ responsaveis: lista.responsaveis })
    } else {
      set({ formError: result.error })
    }
  },

  atualizarResponsavel: async (id, input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.responsavel.atualizar(id, input)
    if (result.ok) {
      const lista = await window.psitrack.responsavel.listar(paciente.id)
      if (lista.ok) set({ responsaveis: lista.responsaveis })
    } else {
      set({ formError: result.error })
    }
  },

  removerResponsavel: async (id) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    await window.psitrack.responsavel.remover(id)
    const lista = await window.psitrack.responsavel.listar(paciente.id)
    if (lista.ok) set({ responsaveis: lista.responsaveis })
  },

  criarEvolucao: async (input) => {
    set({ formError: null, pendenciaFinanceira: null })
    const result = await window.psitrack.evolucao.criar(input)
    if (!result.ok) {
      set({ formError: result.error })
      return false
    }
    if (result.pendenciaSemContrato) {
      set({ pendenciaFinanceira: 'Sessão marcada como realizada, mas não há contrato vigente nesta data — cobrança pendente até configurar o preço na aba Financeiro.' })
    }
    const lista = await window.psitrack.evolucao.listar(input.pacienteId)
    if (lista.ok) set({ evolucoes: lista.evolucoes })
    // Entrada tipo=sessao com sessaoId gera lançamento no backend
    // (faturamento.ts) — sem isso a aba Financeiro, se já carregada, fica
    // mostrando o estado de antes da cobrança até a ficha ser reaberta.
    void get().carregarFinanceiro()
    return true
  },

  retificarEvolucao: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    set({ formError: null, pendenciaFinanceira: null })
    const result = await window.psitrack.evolucao.retificar(input)
    if (!result.ok) {
      set({ formError: result.error })
      return false
    }
    if (result.pendenciaSemContrato) {
      set({ pendenciaFinanceira: 'Sessão marcada como realizada, mas não há contrato vigente nesta data — cobrança pendente até configurar o preço na aba Financeiro.' })
    }
    const lista = await window.psitrack.evolucao.listar(paciente.id)
    if (lista.ok) set({ evolucoes: lista.evolucoes })
    void get().carregarFinanceiro()
    return true
  },

  criarEvolucaoComSessaoRetroativa: async (input) => {
    set({ formError: null, pendenciaFinanceira: null })
    const result = await window.psitrack.evolucao.criarComSessaoRetroativa(input)
    if (!result.ok) {
      set({ formError: result.error })
      return false
    }
    if (result.pendenciaSemContrato) {
      set({ pendenciaFinanceira: 'Sessão retroativa criada, mas não há contrato vigente nesta data — cobrança pendente até configurar o preço na aba Financeiro.' })
    }
    const lista = await window.psitrack.evolucao.listar(input.pacienteId)
    if (lista.ok) set({ evolucoes: lista.evolucoes })
    void get().carregarFinanceiro()
    return true
  },

  criarAnotacao: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.anotacao.criar(paciente.id, input)
    if (result.ok) {
      const lista = await window.psitrack.anotacao.listar(paciente.id)
      if (lista.ok) set({ anotacoes: lista.anotacoes })
    } else {
      set({ formError: result.error })
    }
  },

  atualizarAnotacao: async (id, input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.anotacao.atualizar(id, input)
    if (result.ok) {
      const lista = await window.psitrack.anotacao.listar(paciente.id)
      if (lista.ok) set({ anotacoes: lista.anotacoes })
    } else {
      set({ formError: result.error })
    }
  },

  excluirAnotacao: async (id) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    await window.psitrack.anotacao.excluir(id)
    const lista = await window.psitrack.anotacao.listar(paciente.id)
    if (lista.ok) set({ anotacoes: lista.anotacoes })
  },

  carregarClinico: async () => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    set({ clinicoError: null })
    const [ficha, medicamentos, diagnosticos, encaminhamentos] = await Promise.all([
      window.psitrack.clinico.obterFicha(paciente.id),
      window.psitrack.clinico.listarMedicamentos(paciente.id),
      window.psitrack.clinico.listarDiagnosticos(paciente.id),
      window.psitrack.clinico.listarEncaminhamentos(paciente.id)
    ])
    if (ficha.ok) set({ fichaClinica: ficha.ficha })
    if (medicamentos.ok) set({ medicamentos: medicamentos.medicamentos })
    if (diagnosticos.ok) set({ diagnosticos: diagnosticos.diagnosticos })
    if (encaminhamentos.ok) set({ encaminhamentos: encaminhamentos.encaminhamentos })
  },

  salvarFichaClinica: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    const result = await window.psitrack.clinico.salvarFicha(paciente.id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    set({ fichaClinica: result.ficha, clinicoError: null })
    return true
  },

  criarMedicamento: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    const result = await window.psitrack.clinico.criarMedicamento(paciente.id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    await get().carregarClinico()
    return true
  },

  atualizarMedicamento: async (id, input) => {
    const result = await window.psitrack.clinico.atualizarMedicamento(id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    await get().carregarClinico()
    return true
  },

  removerMedicamento: async (id) => {
    const result = await window.psitrack.clinico.removerMedicamento(id)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return
    }
    await get().carregarClinico()
  },

  criarDiagnostico: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    const result = await window.psitrack.clinico.criarDiagnostico(paciente.id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    await get().carregarClinico()
    return true
  },

  atualizarDiagnostico: async (id, input) => {
    const result = await window.psitrack.clinico.atualizarDiagnostico(id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    await get().carregarClinico()
    return true
  },

  removerDiagnostico: async (id) => {
    const result = await window.psitrack.clinico.removerDiagnostico(id)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return
    }
    await get().carregarClinico()
  },

  criarEncaminhamento: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    const result = await window.psitrack.clinico.criarEncaminhamento(paciente.id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    await get().carregarClinico()
    return true
  },

  atualizarEncaminhamento: async (id, input) => {
    const result = await window.psitrack.clinico.atualizarEncaminhamento(id, input)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return false
    }
    await get().carregarClinico()
    return true
  },

  removerEncaminhamento: async (id) => {
    const result = await window.psitrack.clinico.removerEncaminhamento(id)
    if (!result.ok) {
      set({ clinicoError: result.error })
      return
    }
    await get().carregarClinico()
  },

  carregarAnexos: async () => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    set({ anexosBusy: true, anexosError: null })
    const [ativos, lixeira] = await Promise.all([
      window.psitrack.anexo.listar(paciente.id),
      window.psitrack.anexo.listar(paciente.id, { lixeira: true })
    ])
    set({
      anexosBusy: false,
      anexos: ativos.ok ? ativos.anexos : [],
      anexosLixeira: lixeira.ok ? lixeira.anexos : [],
      anexosError: !ativos.ok ? ativos.error : !lixeira.ok ? lixeira.error : null
    })
  },

  anexarDocumento: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    set({ anexosBusy: true, anexosError: null })
    const result = await window.psitrack.anexo.anexarViaDialogo(paciente.id, input)
    if (!result.ok) {
      set({ anexosBusy: false, anexosError: result.error })
      return false
    }
    if (result.cancelado) {
      set({ anexosBusy: false })
      return false
    }
    await get().carregarAnexos()
    return true
  },

  excluirAnexo: async (id) => {
    const result = await window.psitrack.anexo.excluir(id)
    if (!result.ok) {
      set({ anexosError: result.error })
      return
    }
    await get().carregarAnexos()
  },

  restaurarAnexo: async (id) => {
    const result = await window.psitrack.anexo.restaurar(id)
    if (!result.ok) {
      set({ anexosError: result.error })
      return
    }
    await get().carregarAnexos()
  },

  lerAnexoParaPreview: async (id) => {
    const result = await window.psitrack.anexo.ler(id)
    if (!result.ok) {
      set({ anexosError: result.error })
      return null
    }
    return { bytes: result.bytes, mime: result.mime, nomeOriginal: result.nomeOriginal }
  },

  salvarCopiaAnexo: async (id) => {
    const result = await window.psitrack.anexo.salvarCopia(id)
    if (!result.ok) {
      set({ anexosError: result.error })
    }
  },

  adicionarRecorrenciaRascunho: (input) => set((state) => ({ recorrenciasRascunho: [...state.recorrenciasRascunho, input] })),

  removerRecorrenciaRascunho: (index) =>
    set((state) => ({ recorrenciasRascunho: state.recorrenciasRascunho.filter((_, i) => i !== index) })),

  setContratoRascunho: (contrato) => set({ contratoRascunho: contrato }),
  setFichaRascunho: (ficha) => set({ fichaRascunho: ficha }),

  adicionarRecorrenciaExistente: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.recorrencia.criar(paciente.id, input)
    if (result.ok) {
      const lista = await window.psitrack.recorrencia.listar(paciente.id)
      if (lista.ok) set({ recorrenciasPaciente: lista.recorrencias })
    } else {
      set({ formError: result.error })
    }
  },

  encerrarRecorrenciaExistente: async (id, vigenciaFim) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.recorrencia.encerrar(id, vigenciaFim)
    if (result.ok) {
      const lista = await window.psitrack.recorrencia.listar(paciente.id)
      if (lista.ok) set({ recorrenciasPaciente: lista.recorrencias })
    } else {
      set({ formError: result.error })
    }
  },

  verificarConflitosRecorrencia: async (input, excludingRecorrenciaId) => {
    const paciente = get().pacienteEmEdicao
    const result = await window.psitrack.recorrencia.conflitos(paciente?.id ?? null, input, excludingRecorrenciaId)
    return result.ok ? result.conflitos : []
  },

  abrirParaRegistrarEvolucao: async (pacienteId, sessaoId, dataSessaoLocal) => {
    const result = await window.psitrack.paciente.obter(pacienteId)
    if (!result.ok || !result.paciente) return
    await get().abrirEdicaoPaciente(result.paciente)
    set({ prefillEvolucao: { sessaoId, dataSessao: dataSessaoLocal } })
  },

  limparPrefillEvolucao: () => set({ prefillEvolucao: null }),

  carregarFinanceiro: async () => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    set({ financeiroBusy: true, financeiroError: null })
    const hoje = hojeLocal()
    const [vigente, historico, lancamentos, pagamentos] = await Promise.all([
      window.psitrack.contrato.vigente(paciente.id, hoje),
      window.psitrack.contrato.historico(paciente.id),
      window.psitrack.lancamento.listar(paciente.id),
      window.psitrack.pagamento.listar(paciente.id)
    ])
    set({
      financeiroBusy: false,
      contratoVigente: vigente.ok ? vigente.contrato : null,
      historicoContratos: historico.ok ? historico.contratos : [],
      lancamentos: lancamentos.ok ? lancamentos.lancamentos : [],
      pagamentos: pagamentos.ok ? pagamentos.pagamentos : []
    })
    if (!vigente.ok) set({ financeiroError: vigente.error })
  },

  reajustarContrato: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return null
    set({ financeiroBusy: true, financeiroError: null })
    const result = await window.psitrack.contrato.reajustar(paciente.id, input)
    if (!result.ok) {
      set({ financeiroBusy: false, financeiroError: result.error })
      return null
    }
    await get().carregarFinanceiro()
    return result.lancamentosNoPeriodoAfetado
  },

  criarLancamentoAjuste: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    const result = await window.psitrack.lancamento.criarAjuste(paciente.id, input)
    if (!result.ok) {
      set({ financeiroError: result.error })
      return false
    }
    await get().carregarFinanceiro()
    return true
  },

  cancelarLancamento: async (id) => {
    const result = await window.psitrack.lancamento.cancelar(id)
    if (!result.ok) {
      set({ financeiroError: result.error })
      return
    }
    await get().carregarFinanceiro()
  },

  reabrirLancamento: async (id) => {
    const result = await window.psitrack.lancamento.reabrir(id)
    if (!result.ok) {
      set({ financeiroError: result.error })
      return
    }
    await get().carregarFinanceiro()
  },

  marcarReciboEmitido: async (pagamentoId, input) => {
    const result = await window.psitrack.pagamento.marcarReciboEmitido(pagamentoId, input)
    if (!result.ok) {
      set({ financeiroError: result.error })
      return
    }
    await get().carregarFinanceiro()
  },

  estornarPagamento: async (pagamentoId, input) => {
    const result = await window.psitrack.pagamento.estornar(pagamentoId, input)
    if (!result.ok) {
      set({ financeiroError: result.error })
      return false
    }
    await get().carregarFinanceiro()
    return true
  }
}))
