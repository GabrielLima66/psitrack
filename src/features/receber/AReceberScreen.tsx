import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { formatarCompetencia } from '../pacientes/formatters'
import { PacientePendenteGrupo } from './PacientePendenteGrupo'
import { RelatorioMensalSection } from './RelatorioMensalSection'
import { useReceberStore } from './store'

/** Tela "A receber" (Etapa 13) — pendentes agrupados por paciente, whole-consultório, não vinculada a uma ficha específica. */
export function AReceberScreen() {
  const store = useReceberStore(
    useShallow((s) => ({
      carregar: s.carregar,
      competenciaRelatorio: s.competenciaRelatorio,
      error: s.error,
      loading: s.loading,
      pendentes: s.pendentes,
      contratos: s.contratos,
      selecionados: s.selecionados
    }))
  )

  useEffect(() => {
    void store.carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const porPaciente = new Map<string, { pacienteNome: string; lancamentos: typeof store.pendentes }>()
  for (const l of store.pendentes) {
    const grupo = porPaciente.get(l.pacienteId) ?? { pacienteNome: l.pacienteNome, lancamentos: [] }
    grupo.lancamentos.push(l)
    porPaciente.set(l.pacienteId, grupo)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1040px] flex-col gap-6 overflow-y-auto px-8 py-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">A receber</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Competência <span className="font-mono">{formatarCompetencia(store.competenciaRelatorio)}</span>
        </p>
      </div>

      <RelatorioMensalSection />

      {store.error && <p className="text-sm text-destructive">{store.error}</p>}
      {store.loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!store.loading && porPaciente.size === 0 && <p className="text-sm text-muted-foreground">Nada pendente.</p>}

      <div className="flex flex-col gap-4">
        {[...porPaciente.entries()].map(([pacienteId, grupo]) => (
          <PacientePendenteGrupo
            key={pacienteId}
            pacienteId={pacienteId}
            pacienteNome={grupo.pacienteNome}
            lancamentos={grupo.lancamentos}
            contrato={store.contratos[pacienteId] ?? null}
            selecionados={store.selecionados[pacienteId] ?? []}
          />
        ))}
      </div>
    </div>
  )
}
