import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmarAcao } from '@/components/ui/confirmar-acao'
import { useMensagensStore } from './store'
import { TemplateForm } from './TemplateForm'

/** Aba "Mensagens" de Configurações — CRUD de modelos usados no painel de confirmação de sessão da Agenda. */
export function TemplatesSection() {
  const store = useMensagensStore(
    useShallow((s) => ({
      templates: s.templates,
      error: s.error,
      carregarTemplates: s.carregarTemplates,
      criarTemplate: s.criarTemplate,
      atualizarTemplate: s.atualizarTemplate,
      removerTemplate: s.removerTemplate
    }))
  )

  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  useEffect(() => {
    void store.carregarTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div>
        <h2 className="text-[19px] font-semibold text-foreground">Mensagens</h2>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-foreground">
          Modelos usados no painel de confirmação de sessão da Agenda. Marque um como padrão pra ele ser sugerido
          automaticamente todo dia.
        </p>
      </div>

      {store.error && <p className="text-sm text-destructive">{store.error}</p>}

      <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-[18px] py-[14px]">
          <h3 className="text-[14.5px] font-semibold text-foreground">Modelos</h3>
          {!criando && (
            <Button type="button" className="h-[30px]" onClick={() => setCriando(true)}>
              Novo modelo
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2 p-[20px_18px]">
          {criando && <TemplateForm onSalvar={store.criarTemplate} onCancelar={() => setCriando(false)} />}

          {store.templates.length === 0 && !criando && (
            <p className="text-sm text-muted-foreground">Nenhum modelo ainda — crie o primeiro acima.</p>
          )}

          {store.templates.map((template) =>
            editandoId === template.id ? (
              <TemplateForm
                key={template.id}
                valorInicial={{ nome: template.nome, corpo: template.corpo, padrao: template.padrao }}
                onSalvar={(input) => store.atualizarTemplate(template.id, input)}
                onCancelar={() => setEditandoId(null)}
              />
            ) : (
              <div key={template.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-foreground">{template.nome}</span>
                    {template.padrao && <Badge variant="default">Padrão</Badge>}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{template.corpo}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoId(template.id)}>
                    Editar
                  </Button>
                  <ConfirmarAcao
                    rotulo="Excluir"
                    titulo="Excluir modelo"
                    descricao="Remove este modelo da lista. Não afeta mensagens já mandadas."
                    rotuloConfirmar="Sim, excluir"
                    onConfirmar={() => store.removerTemplate(template.id)}
                  />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}
