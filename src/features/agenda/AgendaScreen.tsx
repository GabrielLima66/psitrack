import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatarDataCurta, formatarDiaSemanaAbrev, formatarHoraLocal, formatarIntervaloDatas } from './formatters'
import { alturaGrade, posY, rotulosHora } from './grade'
import { NovaSessaoForm } from './NovaSessaoForm'
import { PainelSessao } from './PainelSessao'
import { SessaoCard } from './SessaoCard'
import { useAgendaStore } from './store'
import { diaSemanaLocal, hojeLocal, inicioDaSemana, somarDias, utcParaDataLocal } from './tempo'

/**
 * Agenda do consultório inteiro — não é vinculada a um paciente específico
 * (visão semanal é o padrão, diária é alternativa). Só mostra logística
 * (horário, nome, modalidade, status): nenhum conteúdo clínico aparece aqui
 * (critério de aceite da Etapa 11).
 *
 * Grade de horário real (Etapa 5 do redesign) — antes era uma lista de
 * cards empilhados por coluna, sem eixo de tempo.
 */
export function AgendaScreen() {
  const store = useAgendaStore()
  const [agoraHHMM, setAgoraHHMM] = useState(() => formatarHoraLocal(new Date().toISOString()))

  useEffect(() => {
    void store.carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = setInterval(() => setAgoraHHMM(formatarHoraLocal(new Date().toISOString())), 60_000)
    return () => clearInterval(id)
  }, [])

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(store.dataReferencia), i))
  const diasVisiveis = store.visao === 'semana' ? diasDaSemana : [store.dataReferencia]
  const sessaoSelecionada = store.sessoes.find((s) => s.id === store.sessaoSelecionadaId) ?? null
  const hoje = hojeLocal()
  const semanaContemHoje = diasVisiveis.includes(hoje)
  const rotulos = rotulosHora()
  const altura = alturaGrade()

  function sessoesDoDia(dataYMD: string) {
    return store.sessoes.filter((s) => utcParaDataLocal(s.inicioUtc) === dataYMD)
  }

  const contexto =
    store.visao === 'semana'
      ? `${formatarIntervaloDatas(diasDaSemana[0]!, diasDaSemana[6]!)} · ${store.sessoes.length} sessões`
      : `${formatarDiaSemanaAbrev(diaSemanaLocal(store.dataReferencia))} ${formatarDataCurta(store.dataReferencia)} · ${store.sessoes.length} sessões`

  return (
    <div className="flex h-full flex-col overflow-hidden px-7 py-6">
      <div className="flex flex-col gap-1 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Agenda</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{contexto}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex h-[34px] items-stretch overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => store.mudarVisao('semana')}
                className={cn(
                  'px-3 text-[13px] font-medium transition-colors',
                  store.visao === 'semana' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => store.mudarVisao('dia')}
                className={cn(
                  'border-l border-border px-3 text-[13px] font-medium transition-colors',
                  store.visao === 'dia' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                Dia
              </button>
            </div>

            <div className="inline-flex h-[34px] items-stretch overflow-hidden rounded-md border border-border">
              <button type="button" onClick={store.voltar} className="flex items-center px-2 text-muted-foreground hover:bg-accent" aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={store.irParaHoje}
                className="border-x border-border px-3 text-[13px] font-medium text-foreground hover:bg-accent"
              >
                Hoje
              </button>
              <button type="button" onClick={store.avancar} className="flex items-center px-2 text-muted-foreground hover:bg-accent" aria-label="Próxima">
                <ChevronRight className="size-4" />
              </button>
            </div>

            <Button type="button" className="h-[34px]" onClick={() => void store.abrirNovaSessao()}>
              Nova sessão avulsa
            </Button>
          </div>
        </div>

        {store.error && <p className="text-sm text-destructive">{store.error}</p>}
        {store.pendenciaFinanceira && (
          <Alert variant="warn">
            <AlertDescription>{store.pendenciaFinanceira}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[0.625rem] border border-border">
        <div className="flex">
          <div className="sticky left-0 z-10 w-[58px] shrink-0 border-r border-border bg-card">
            <div className="sticky top-0 z-20 h-[42px] border-b border-border bg-muted" />
            <div className="relative" style={{ height: altura }}>
              {rotulos.map((rotulo, i) => (
                <span
                  key={rotulo}
                  className="absolute right-[9px] font-mono text-[11px] text-muted-foreground"
                  style={{ top: i * 48 + 8 - 6 }}
                >
                  {rotulo}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-1">
            {diasVisiveis.map((dia) => {
              const ehHoje = dia === hoje
              return (
                <div key={dia} className="flex flex-1 flex-col border-r border-border last:border-r-0">
                  <div
                    className={cn(
                      'sticky top-0 z-20 flex h-[42px] flex-col items-center justify-center gap-0.5 border-b border-border',
                      ehHoje ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    )}
                  >
                    <span className="text-[11.5px] font-medium tracking-[0.06em] uppercase">{formatarDiaSemanaAbrev(diaSemanaLocal(dia))}</span>
                    <span className="font-mono text-[13.5px] font-medium">{formatarDataCurta(dia)}</span>
                  </div>

                  <div className={cn('relative', ehHoje && 'bg-muted/40')} style={{ minHeight: altura }}>
                    {rotulos.map((rotulo, i) => (
                      <div key={rotulo} className="absolute right-0 left-0 h-px bg-border" style={{ top: i * 48 + 8 }} />
                    ))}

                    {ehHoje && semanaContemHoje && (
                      <>
                        <div className="pointer-events-none absolute right-0 left-0 z-[3] h-0.5 bg-primary" style={{ top: posY(agoraHHMM) }} />
                        <div
                          className="pointer-events-none absolute z-[4] size-[7px] rounded-full bg-primary"
                          style={{ top: posY(agoraHHMM) - 3, left: -3 }}
                        />
                      </>
                    )}

                    {sessoesDoDia(dia).map((sessao) => (
                      <SessaoCard
                        key={sessao.id}
                        sessao={sessao}
                        selecionada={sessao.id === store.sessaoSelecionadaId}
                        onSelecionar={() => store.selecionarSessao(sessao.id)}
                        top={posY(formatarHoraLocal(sessao.inicioUtc))}
                        height={Math.max((sessao.duracaoMin / 60) * 48 - 3, 18)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {store.novaSessaoAberta && (
        <div className="mt-4">
          <NovaSessaoForm pacientes={store.pacientesDisponiveis} onCriar={store.criarSessaoAvulsa} onCancelar={store.fecharNovaSessao} />
        </div>
      )}

      {sessaoSelecionada && (
        <div className="mt-4">
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
        </div>
      )}
    </div>
  )
}
