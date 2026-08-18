import { DiagnosticosBloco } from './DiagnosticosBloco'
import { EncaminhamentosBloco } from './EncaminhamentosBloco'
import { MedicamentosBloco } from './MedicamentosBloco'
import type { Diagnostico, DiagnosticoInput, Encaminhamento, EncaminhamentoInput, Medicamento, MedicamentoInput } from './types'

interface InformacoesClinicasSectionProps {
  medicamentos: Medicamento[]
  diagnosticos: Diagnostico[]
  encaminhamentos: Encaminhamento[]
  error: string | null
  onCriarMedicamento: (input: MedicamentoInput) => Promise<boolean>
  onAtualizarMedicamento: (id: string, input: MedicamentoInput) => Promise<boolean>
  onRemoverMedicamento: (id: string) => Promise<void>
  onCriarDiagnostico: (input: DiagnosticoInput) => Promise<boolean>
  onAtualizarDiagnostico: (id: string, input: DiagnosticoInput) => Promise<boolean>
  onRemoverDiagnostico: (id: string) => Promise<void>
  onCriarEncaminhamento: (input: EncaminhamentoInput) => Promise<boolean>
  onAtualizarEncaminhamento: (id: string, input: EncaminhamentoInput) => Promise<boolean>
  onRemoverEncaminhamento: (id: string) => Promise<void>
}

/**
 * Aba Informações clínicas (Etapa 23/SPEC-fase-5.md): medicações,
 * diagnósticos e encaminhamentos. O quadro clínico (demanda inicial +
 * abordagem) mora agora na aba Cadastro — ver `QuadroClinicoCard.tsx` — por
 * ser obrigatório no cadastro de paciente novo; o modelo de dados não mudou,
 * só o lugar na tela. Tudo aqui é editável de propósito (D43) e é
 * prontuário, ou seja, entra em export (D48).
 */
export function InformacoesClinicasSection({
  medicamentos,
  diagnosticos,
  encaminhamentos,
  error,
  onCriarMedicamento,
  onAtualizarMedicamento,
  onRemoverMedicamento,
  onCriarDiagnostico,
  onAtualizarDiagnostico,
  onRemoverDiagnostico,
  onCriarEncaminhamento,
  onAtualizarEncaminhamento,
  onRemoverEncaminhamento
}: InformacoesClinicasSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <MedicamentosBloco
        medicamentos={medicamentos}
        onCriar={onCriarMedicamento}
        onAtualizar={onAtualizarMedicamento}
        onRemover={onRemoverMedicamento}
      />

      <DiagnosticosBloco
        diagnosticos={diagnosticos}
        onCriar={onCriarDiagnostico}
        onAtualizar={onAtualizarDiagnostico}
        onRemover={onRemoverDiagnostico}
      />

      <EncaminhamentosBloco
        encaminhamentos={encaminhamentos}
        onCriar={onCriarEncaminhamento}
        onAtualizar={onAtualizarEncaminhamento}
        onRemover={onRemoverEncaminhamento}
      />
    </div>
  )
}
