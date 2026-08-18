import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarHoraLocal } from '../agenda/formatters'
import { dadosConfirmacaoDeSessao, preencherTemplate } from './preencherTemplate'
import { useMensagensStore } from './store'
import type { SessaoConfirmacao } from './types'

/**
 * Busca própria, independente da store da Agenda — `sessoes` de lá só
 * contém a janela visível (semana/dia), não necessariamente hoje. Só
 * sessões `agendada` (já filtrado no backend) aparecem aqui.
 */
export function PainelConfirmacoesDoDia() {
  const store = useMensagensStore(
    useShallow((s) => ({
      templates: s.templates,
      confirmacoesHoje: s.confirmacoesHoje,
      templateSelecionadoPorSessao: s.templateSelecionadoPorSessao,
      loading: s.loading,
      error: s.error,
      enviandoSessaoId: s.enviandoSessaoId,
      carregarTemplates: s.carregarTemplates,
      carregarConfirmacoesHoje: s.carregarConfirmacoesHoje,
      selecionarTemplateParaSessao: s.selecionarTemplateParaSessao,
      enviarConfirmacao: s.enviarConfirmacao,
      marcarLembreteManualmente: s.marcarLembreteManualmente,
      desfazerLembrete: s.desfazerLembrete
    }))
  )

  useEffect(() => {
    void store.carregarTemplates()
    void store.carregarConfirmacoesHoje()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const templatePadraoId = store.templates.find((t) => t.padrao)?.id ?? store.templates[0]?.id ?? null

  function templateSelecionado(sessaoId: string) {
    const escolhidoId = store.templateSelecionadoPorSessao[sessaoId] ?? templatePadraoId
    return store.templates.find((t) => t.id === escolhidoId) ?? null
  }

  function textoPara(sessao: SessaoConfirmacao): string {
    const template = templateSelecionado(sessao.id)
    if (!template) return ''
    return preencherTemplate(template.corpo, dadosConfirmacaoDeSessao(sessao))
  }

  const pendentes = store.confirmacoesHoje.filter((s) => !s.lembreteEnviadoEm).length
  const rotuloCabecalho = store.loading
    ? 'Confirmar sessões de hoje'
    : `Confirmar sessões de hoje ${
        store.confirmacoesHoje.length === 0 ? '' : pendentes > 0 ? `(${pendentes} pendente${pendentes > 1 ? 's' : ''})` : '— tudo enviado'
      }`

  return (
    <div className="mb-4 overflow-hidden rounded-[0.625rem] border border-border bg-card">
      <div className="border-b border-border px-[18px] py-[14px]">
        <h3 className="text-[14.5px] font-semibold text-foreground">{rotuloCabecalho}</h3>
      </div>

      {store.error && <p className="px-[18px] pt-3 text-sm text-destructive">{store.error}</p>}

      {store.loading ? (
        <p className="p-[18px] text-sm text-muted-foreground">Carregando…</p>
      ) : store.confirmacoesHoje.length === 0 ? (
        <p className="p-[18px] text-sm text-muted-foreground">Nenhuma sessão agendada pra hoje.</p>
      ) : store.templates.length === 0 ? (
        <p className="p-[18px] text-sm text-muted-foreground">
          Nenhum modelo de mensagem configurado ainda — crie um em Configurações → Mensagens.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {store.confirmacoesHoje.map((sessao) => {
            const enviada = !!sessao.lembreteEnviadoEm
            const enviando = store.enviandoSessaoId === sessao.id
            const nomeExibicao = sessao.pacienteNomeSocial || sessao.pacienteNome

            return (
              <div key={sessao.id} className="flex flex-col gap-2 px-[18px] py-3">
                <div className="flex items-center gap-3">
                  <span className="w-[52px] shrink-0 font-mono text-[13.5px] text-muted-foreground">
                    {formatarHoraLocal(sessao.inicioUtc)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{nomeExibicao}</span>
                  {enviada ? (
                    <Badge variant="success">Enviada</Badge>
                  ) : (
                    <Select value={templateSelecionado(sessao.id)?.id ?? ''} onValueChange={(v) => store.selecionarTemplateParaSessao(sessao.id, v)}>
                      <SelectTrigger className="h-8 w-[180px]">
                        <SelectValue placeholder="Modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {store.templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {!enviada && (
                  <>
                    <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">{textoPara(sessao)}</p>
                    <div className="flex items-center gap-2">
                      {sessao.telefoneContato ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={enviando}
                          onClick={() => void store.enviarConfirmacao(sessao.id, sessao.telefoneContato, textoPara(sessao))}
                        >
                          {enviando ? 'Abrindo…' : 'Abrir WhatsApp'}
                        </Button>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">Sem telefone cadastrado</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => void store.marcarLembreteManualmente(sessao.id)}>
                            Marcar como enviada
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}

                {enviada && (
                  <button
                    type="button"
                    className="self-start text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void store.desfazerLembrete(sessao.id)}
                  >
                    Desfazer
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!store.loading && store.confirmacoesHoje.length > 0 && store.templates.length > 0 && (
        <p className="px-[18px] pb-3 text-xs text-muted-foreground">
          Abre o WhatsApp com a mensagem pronta — o app não envia nada sozinho.
        </p>
      )}
    </div>
  )
}
