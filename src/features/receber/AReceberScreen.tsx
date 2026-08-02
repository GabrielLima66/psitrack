import { useEffect } from 'react'
import { PacientePendenteGrupo } from './PacientePendenteGrupo'
import { RelatorioMensalSection } from './RelatorioMensalSection'
import { useReceberStore } from './store'

/** Tela "A receber" (Etapa 13) — pendentes agrupados por paciente, whole-consultório, não vinculada a uma ficha específica. */
export function AReceberScreen() {
  const store = useReceberStore()

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
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto p-8">
      <h1 className="text-2xl font-semibold text-foreground">A receber</h1>

      <RelatorioMensalSection />

      {store.error && <p className="text-sm text-destructive">{store.error}</p>}
      {store.loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!store.loading && porPaciente.size === 0 && <p className="text-sm text-muted-foreground">Nada pendente.</p>}

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
  )
}
