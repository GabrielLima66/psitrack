import { formatarDataCurta, formatarHoraLocal, formatarModalidade } from '../agenda/formatters'
import { utcParaDataLocal } from '../agenda/tempo'
import type { SessaoConfirmacao } from './types'

export interface DadosConfirmacao {
  paciente: string
  data: string
  hora: string
  modalidade: string
}

/** `nomeSocial || nome` — mesmo idioma de exibição usado em PacienteFormScreen/PacientesListScreen. */
export function dadosConfirmacaoDeSessao(sessao: SessaoConfirmacao): DadosConfirmacao {
  return {
    paciente: sessao.pacienteNomeSocial || sessao.pacienteNome,
    data: formatarDataCurta(utcParaDataLocal(sessao.inicioUtc)),
    hora: formatarHoraLocal(sessao.inicioUtc),
    modalidade: formatarModalidade(sessao.modalidade)
  }
}

/** `.replaceAll` puro — sem regex, sem lib de template. Placeholder desconhecido fica intocado. */
export function preencherTemplate(corpo: string, dados: DadosConfirmacao): string {
  return corpo
    .replaceAll('{paciente}', dados.paciente)
    .replaceAll('{data}', dados.data)
    .replaceAll('{hora}', dados.hora)
    .replaceAll('{modalidade}', dados.modalidade)
}
