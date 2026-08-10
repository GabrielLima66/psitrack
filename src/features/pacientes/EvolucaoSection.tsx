import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { hojeLocal } from '../agenda/tempo'
import { formatarDataBr, formatarDataHoraBr, formatarMesAnoAbrevDeData, formatarTipoEvolucao } from './formatters'
import type { CriarEvolucaoComSessaoRetroativaInput, CriarEvolucaoInput, Evolucao, RetificarEvolucaoInput, TipoEvolucao } from './types'

interface EvolucaoSectionProps {
  pacienteId: string
  evolucoes: Evolucao[]
  onCriar: (input: CriarEvolucaoInput) => Promise<boolean>
  onRetificar: (input: RetificarEvolucaoInput) => Promise<boolean>
  /** "Evolução avulsa sem sessão oferece criar a sessão retroativa" (Etapa 12). */
  onCriarComSessaoRetroativa: (input: CriarEvolucaoComSessaoRetroativaInput) => Promise<boolean>
  /** Atalho "registrar evolução" clicado a partir de uma sessão na agenda (Etapa 11/D17). */
  prefill?: { sessaoId: string; dataSessao: string } | null
  onPrefillConsumido?: () => void
  /** Anexo vinculado a uma entrada: força classificação prontuário (D33) — nunca oferece "privado" aqui. */
  onAnexarDocumento: (evolucaoId: string) => Promise<boolean>
}

type Modo = 'fechado' | 'nova' | { retificando: string }

/**
 * Timeline append-only de verdade: não existe editar nem excluir aqui — só
 * "nova entrada" e "retificar" (que também é só uma entrada nova). A
 * retificação NUNCA esconde o original; as duas linhas ficam visíveis, uma
 * apontando pra outra pela data (SPEC-fase-1.md, regra de exibição crítica).
 */
export function EvolucaoSection({
  pacienteId,
  evolucoes,
  onCriar,
  onRetificar,
  onCriarComSessaoRetroativa,
  prefill,
  onPrefillConsumido,
  onAnexarDocumento
}: EvolucaoSectionProps) {
  const [modo, setModo] = useState<Modo>('fechado')
  const [conteudo, setConteudo] = useState('')
  const [dataSessao, setDataSessao] = useState(hojeLocal())
  const [tipo, setTipo] = useState<TipoEvolucao>('sessao')
  const [motivoRetificacao, setMotivoRetificacao] = useState('')
  const [sessaoIdAtual, setSessaoIdAtual] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [oferecendoSessaoRetroativa, setOferecendoSessaoRetroativa] = useState(false)
  const [horaSessaoRetroativa, setHoraSessaoRetroativa] = useState('14:00')
  const [anexandoEntradaId, setAnexandoEntradaId] = useState<string | null>(null)

  async function handleAnexarDocumento(entradaId: string): Promise<void> {
    setAnexandoEntradaId(entradaId)
    await onAnexarDocumento(entradaId)
    setAnexandoEntradaId(null)
  }

  useEffect(() => {
    if (!prefill || modo !== 'fechado') return
    setConteudo('')
    setDataSessao(prefill.dataSessao)
    setTipo('sessao')
    setSessaoIdAtual(prefill.sessaoId)
    setModo('nova')
    onPrefillConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  const porId = new Map(evolucoes.map((entrada) => [entrada.id, entrada]))
  const retificadaPor = new Map<string, Evolucao>()
  for (const entrada of evolucoes) {
    if (entrada.retificaId) retificadaPor.set(entrada.retificaId, entrada)
  }

  function abrirNovaEntrada(): void {
    setConteudo('')
    setDataSessao(hojeLocal())
    setTipo('sessao')
    setSessaoIdAtual(null)
    setOferecendoSessaoRetroativa(false)
    setModo('nova')
  }

  function abrirRetificacao(original: Evolucao): void {
    setConteudo(original.conteudo)
    setDataSessao(original.dataSessao)
    setTipo(original.tipo)
    setMotivoRetificacao('')
    setSessaoIdAtual(null)
    setOferecendoSessaoRetroativa(false)
    setModo({ retificando: original.id })
  }

  async function salvarDireto(): Promise<void> {
    setSalvando(true)
    const ok =
      typeof modo === 'object'
        ? await onRetificar({ retificaId: modo.retificando, conteudo, dataSessao, tipo, motivoRetificacao })
        : await onCriar({ pacienteId, conteudo, dataSessao, tipo, sessaoId: sessaoIdAtual })
    setSalvando(false)
    if (ok) {
      setModo('fechado')
      setOferecendoSessaoRetroativa(false)
    }
  }

  /** Entrada nova, tipo=sessao, sem sessão pré-selecionada: pergunta antes de gravar sem cobrança (critério de aceite da Etapa 12). */
  async function handleSalvar(): Promise<void> {
    if (modo === 'nova' && tipo === 'sessao' && !sessaoIdAtual) {
      setOferecendoSessaoRetroativa(true)
      return
    }
    await salvarDireto()
  }

  async function handleConfirmarSessaoRetroativa(): Promise<void> {
    setSalvando(true)
    const ok = await onCriarComSessaoRetroativa({
      pacienteId,
      dataLocal: dataSessao,
      horaLocal: horaSessaoRetroativa,
      modalidade: 'presencial',
      conteudo
    })
    setSalvando(false)
    if (ok) {
      setModo('fechado')
      setOferecendoSessaoRetroativa(false)
    }
  }

  function handleRecusarSessaoRetroativa(): void {
    setOferecendoSessaoRetroativa(false)
    void salvarDireto()
  }

  const retificandoOriginal = typeof modo === 'object' ? porId.get(modo.retificando) : undefined

  return (
    <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">Evolução clínica</h3>
        {modo === 'fechado' && (
          <Button type="button" className="h-[30px]" onClick={abrirNovaEntrada}>
            Nova entrada
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-[20px_18px]">
      {modo !== 'fechado' && (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
          {retificandoOriginal && (
            <p className="text-[13px] text-muted-foreground">
              Retificando a entrada de {formatarDataBr(retificandoOriginal.dataSessao)}. O texto original continua
              visível na timeline — isto grava uma entrada nova, nunca sobrescreve.
            </p>
          )}
          {sessaoIdAtual && (
            <p className="text-[13px] text-muted-foreground">Vinculada à sessão da agenda selecionada.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="evolucao-data">Data da sessão</Label>
              <Input id="evolucao-data" type="date" value={dataSessao} onChange={(event) => setDataSessao(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(value) => setTipo(value as TipoEvolucao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sessao">Sessão</SelectItem>
                  <SelectItem value="contato">Contato</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="evolucao-conteudo">Conteúdo</Label>
            <Textarea
              id="evolucao-conteudo"
              rows={4}
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
            />
          </div>
          {typeof modo === 'object' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="evolucao-motivo">Motivo da retificação</Label>
              <Input
                id="evolucao-motivo"
                value={motivoRetificacao}
                onChange={(event) => setMotivoRetificacao(event.target.value)}
              />
            </div>
          )}
          {oferecendoSessaoRetroativa ? (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
              <p className="text-sm text-foreground">
                Essa entrada é sobre uma sessão, mas não veio da agenda. Quer criar a sessão retroativa agora, pra
                entrar no financeiro? Recusando, esta entrada nunca gera cobrança.
              </p>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="evolucao-hora-retroativa">Hora da sessão</Label>
                  <Input
                    id="evolucao-hora-retroativa"
                    type="time"
                    value={horaSessaoRetroativa}
                    onChange={(event) => setHoraSessaoRetroativa(event.target.value)}
                  />
                </div>
                <Button type="button" disabled={salvando} onClick={handleConfirmarSessaoRetroativa}>
                  Sim, criar sessão e salvar
                </Button>
                <Button type="button" variant="outline" disabled={salvando} onClick={handleRecusarSessaoRetroativa}>
                  Não, salvar sem cobrança
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                disabled={salvando || !conteudo.trim() || (typeof modo === 'object' && !motivoRetificacao.trim())}
                onClick={handleSalvar}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setModo('fechado')}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col">
        {evolucoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrada registrada ainda.</p>}
        {evolucoes.map((entrada, indice) => {
          const retificacao = retificadaPor.get(entrada.id)
          const original = entrada.retificaId ? porId.get(entrada.retificaId) : undefined

          // Timeline é ordenada mais recente primeiro (evolucao.ts). O rótulo
          // de mês só aparece quando se cruza pra um mês diferente do vizinho
          // anterior no array — não precisa de agrupamento à parte.
          const mesAnoAtual = formatarMesAnoAbrevDeData(entrada.dataSessao)
          const mesAnoAnterior = indice > 0 ? formatarMesAnoAbrevDeData(evolucoes[indice - 1]!.dataSessao) : null
          const mostrarRotuloMes = mesAnoAtual !== mesAnoAnterior

          return (
            <div
              key={entrada.id}
              className={`flex gap-4 pb-5 ${indice > 0 ? 'pt-5' : ''} ${indice < evolucoes.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="w-10 shrink-0 pt-0.5 text-right">
                {mostrarRotuloMes && (
                  <span className="font-mono text-[11.5px] tracking-[0.08em] text-muted-foreground uppercase">{mesAnoAtual}</span>
                )}
              </div>

              {/* border-r de cada entrada, empilhadas sem gap entre si, formam uma
                  única linha contínua — a "espinha" da timeline. O quadrado marca
                  cada entrada como um ponto discreto registrado nela (tick de
                  régua, não bolinha de feed). */}
              <div className="relative flex w-[136px] shrink-0 flex-col items-end gap-0.5 border-r border-border pr-4 text-right">
                <span className="absolute top-[4px] right-[-3.5px] size-[7px] rounded-[2px] bg-primary ring-2 ring-card" />
                <span className="font-mono text-[13.5px] font-medium text-foreground">{formatarDataBr(entrada.dataSessao)}</span>
                <span className="text-xs text-muted-foreground">{formatarTipoEvolucao(entrada.tipo)}</span>
                <span className="text-[11.5px] text-muted-foreground">registrado em {formatarDataHoraBr(entrada.createdAt)}</span>
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                {original && (
                  <p className="text-[12.5px] text-muted-foreground italic">
                    ↳ Retifica entrada de {formatarDataBr(original.dataSessao)} — motivo: {entrada.motivoRetificacao}
                  </p>
                )}

                <p className="text-pretty text-[14px] leading-[1.65] whitespace-pre-wrap text-foreground">{entrada.conteudo}</p>

                {retificacao && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Retificada em {formatarDataBr(retificacao.dataSessao)} — o texto corrigido está em outra entrada
                    desta timeline.
                  </p>
                )}

                {modo === 'fechado' && (
                  <div className="flex gap-3 pt-1">
                    {!retificacao && (
                      <button
                        type="button"
                        className="text-[12.5px] text-muted-foreground hover:text-foreground"
                        onClick={() => abrirRetificacao(entrada)}
                      >
                        Retificar
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-[12.5px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                      disabled={anexandoEntradaId === entrada.id}
                      onClick={() => void handleAnexarDocumento(entrada.id)}
                    >
                      {anexandoEntradaId === entrada.id ? 'Anexando…' : 'Anexar documento'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
