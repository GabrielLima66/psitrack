import { useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatarDataCurta, formatarDiaSemanaAbrev } from './formatters'
import { NovaSessaoForm } from './NovaSessaoForm'
import { PainelSessao } from './PainelSessao'
import { SessaoCard } from './SessaoCard'
import { useAgendaStore } from './store'
import { diaSemanaLocal, inicioDaSemana, somarDias, utcParaDataLocal } from './tempo'

/**
 * Agenda do consultório inteiro — não é vinculada a um paciente específico
 * (visão semanal é o padrão, diária é alternativa). Só mostra logística
 * (horário, nome, modalidade, status): nenhum conteúdo clínico aparece aqui
 * (critério de aceite da Etapa 11).
 */
export function AgendaScreen() {
  const store = useAgendaStore()

  useEffect(() => {
    void store.carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(store.dataReferencia), i))
  const sessaoSelecionada = store.sessoes.find((s) => s.id === store.sessaoSelecionadaId) ?? null

  function sessoesDoDia(dataYMD: string) {
    return store.sessoes
      .filter((s) => utcParaDataLocal(s.inicioUtc) === dataYMD)
      .sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc))
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4 overflow-y-auto p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Agenda</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant={store.visao === 'semana' ? 'default' : 'outline'} size="sm" onClick={() => store.mudarVisao('semana')}>
            Semana
          </Button>
          <Button type="button" variant={store.visao === 'dia' ? 'default' : 'outline'} size="sm" onClick={() => store.mudarVisao('dia')}>
            Dia
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={store.voltar}>
            ← Anterior
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={store.irParaHoje}>
            Hoje
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={store.avancar}>
            Próxima →
          </Button>
        </div>
        <Button type="button" size="sm" onClick={() => void store.abrirNovaSessao()}>
          Nova sessão avulsa
        </Button>
      </div>

      {store.error && <p className="text-sm text-destructive">{store.error}</p>}
      {store.pendenciaFinanceira && (
        <Alert variant="warn">
          <AlertDescription>{store.pendenciaFinanceira}</AlertDescription>
        </Alert>
      )}

      {store.visao === 'semana' ? (
        <div className="grid grid-cols-7 gap-2">
          {diasDaSemana.map((dia) => (
            <div key={dia} className="flex flex-col gap-2">
              <div className="text-center text-xs font-medium text-muted-foreground">
                {formatarDiaSemanaAbrev(diaSemanaLocal(dia))} {formatarDataCurta(dia)}
              </div>
              <div className="flex flex-col gap-1.5">
                {sessoesDoDia(dia).map((sessao) => (
                  <SessaoCard
                    key={sessao.id}
                    sessao={sessao}
                    selecionada={sessao.id === store.sessaoSelecionadaId}
                    onSelecionar={() => store.selecionarSessao(sessao.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-muted-foreground">
            {formatarDiaSemanaAbrev(diaSemanaLocal(store.dataReferencia))} {formatarDataCurta(store.dataReferencia)}
          </div>
          {sessoesDoDia(store.dataReferencia).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma sessão neste dia.</p>
          )}
          {sessoesDoDia(store.dataReferencia).map((sessao) => (
            <SessaoCard
              key={sessao.id}
              sessao={sessao}
              selecionada={sessao.id === store.sessaoSelecionadaId}
              onSelecionar={() => store.selecionarSessao(sessao.id)}
            />
          ))}
        </div>
      )}

      {store.novaSessaoAberta && (
        <NovaSessaoForm pacientes={store.pacientesDisponiveis} onCriar={store.criarSessaoAvulsa} onCancelar={store.fecharNovaSessao} />
      )}

      {sessaoSelecionada && (
        <PainelSessao
          sessao={sessaoSelecionada}
          onFechar={() => store.selecionarSessao(null)}
          onAlterarStatus={async (status, motivo) => {
            await store.alterarStatus(sessaoSelecionada.id, { status, motivo: motivo || null })
          }}
          onRemarcar={async (dataLocal, horaLocal) => {
            await store.remarcar(sessaoSelecionada.id, { dataLocal, horaLocal })
          }}
          onRegistrarEvolucao={() => store.registrarEvolucao(sessaoSelecionada)}
        />
      )}
    </div>
  )
}
