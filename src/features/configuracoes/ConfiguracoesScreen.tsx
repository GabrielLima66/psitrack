import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type Aparencia, useThemeStore } from '@/store/theme'
import { BackupItem } from './BackupItem'
import { DestinoBackupSection } from './DestinoBackupSection'
import { formatarBytes, formatarDataHoraBr } from './formatters'
import { HistoricoAutomaticoSection } from './HistoricoAutomaticoSection'
import { RetencaoSection } from './RetencaoSection'
import { useConfiguracoesStore } from './store'
import { TemplatesSection } from '../mensagens/TemplatesSection'

type AbaConfiguracoes = 'backup' | 'retencao' | 'seguranca' | 'mensagens' | 'sobre'

const OPCOES_APARENCIA: { value: Aparencia; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' }
]

const ABAS: { id: AbaConfiguracoes; label: string; subtitulo: string }[] = [
  { id: 'backup', label: 'Backup', subtitulo: 'Local, destino externo e restauração' },
  { id: 'retencao', label: 'Retenção', subtitulo: 'Política GFS e purga' },
  { id: 'seguranca', label: 'Segurança', subtitulo: 'Senha mestra, bloqueio, recuperação' },
  { id: 'mensagens', label: 'Mensagens', subtitulo: 'Modelos de confirmação de sessão' },
  { id: 'sobre', label: 'Sobre', subtitulo: 'Versão e execuções automáticas' }
]

/** Tela "Configurações" (Etapas 17-21): backup manual local + destino externo, retenção/purga, restore e scheduler automático, com snapshot de segurança automático antes de sobrescrever, e informações do app. */
export function ConfiguracoesScreen() {
  // Exclui de propósito os campos de `avisoBackupAutomatico`/`fechandoComBackup`
  // (e as ações que os mudam) — esses pertencem a `BackupAutomaticoOverlay`,
  // que já assina só os seus próprios campos; sem essa exclusão, o scheduler
  // automático rodando em segundo plano re-renderizaria esta tela à toa.
  const store = useConfiguracoesStore(
    useShallow((s) => ({
      backups: s.backups,
      loading: s.loading,
      error: s.error,
      criando: s.criando,
      verificando: s.verificando,
      verificandoBusy: s.verificandoBusy,
      restaurando: s.restaurando,
      ultimaRestauracao: s.ultimaRestauracao,
      versao: s.versao,
      destino: s.destino,
      ultimoBackupExternoEm: s.ultimoBackupExternoEm,
      configurandoDestino: s.configurandoDestino,
      destinoError: s.destinoError,
      avisoDestino: s.avisoDestino,
      verificacaoDestino: s.verificacaoDestino,
      verificandoDestino: s.verificandoDestino,
      previewPurga: s.previewPurga,
      purgando: s.purgando,
      purgaError: s.purgaError,
      ultimaPurga: s.ultimaPurga,
      historico: s.historico,
      atualizacaoStatus: s.atualizacaoStatus,
      atualizacaoVersaoDisponivel: s.atualizacaoVersaoDisponivel,
      atualizacaoProgresso: s.atualizacaoProgresso,
      atualizacaoError: s.atualizacaoError,
      verificarAtualizacao: s.verificarAtualizacao,
      baixarEInstalarAtualizacao: s.baixarEInstalarAtualizacao,
      registrarProgressoAtualizacao: s.registrarProgressoAtualizacao,
      carregar: s.carregar,
      criarBackup: s.criarBackup,
      verificar: s.verificar,
      restaurar: s.restaurar,
      configurarDestino: s.configurarDestino,
      removerDestino: s.removerDestino,
      verificarDestino: s.verificarDestino,
      executarPurga: s.executarPurga
    }))
  )
  const { aparencia, definirAparencia } = useThemeStore()
  const [aba, setAba] = useState<AbaConfiguracoes>('backup')

  useEffect(() => {
    void store.carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return window.psitrack.app.onProgressoAtualizacao((percentual) => store.registrarProgressoAtualizacao(percentual))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const atualizacaoEmAndamento = store.atualizacaoStatus === 'verificando' || store.atualizacaoStatus === 'baixando'
  const atualizacaoRotulo =
    store.atualizacaoStatus === 'verificando'
      ? 'Buscando…'
      : store.atualizacaoStatus === 'baixando'
        ? `Baixando… ${store.atualizacaoProgresso}%`
        : store.atualizacaoStatus === 'disponivel'
          ? `Baixar e instalar ${store.atualizacaoVersaoDisponivel}`
          : store.atualizacaoStatus === 'erro'
            ? 'Tentar de novo'
            : 'Buscar atualização'

  const ocupadoBytes = store.previewPurga
    ? store.previewPurga.local.totalBytes +
      (store.previewPurga.externo?.totalBytes ?? 0) +
      (store.previewPurga.externo?.poolTotalBytes ?? 0)
    : 0
  const aLiberarBytes = store.previewPurga
    ? store.previewPurga.local.aLiberarBytes +
      (store.previewPurga.externo?.aLiberarBytes ?? 0) +
      (store.previewPurga.externo?.poolALiberarBytes ?? 0)
    : 0

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex w-[250px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-4 py-6">
        <h1 className="mb-3 px-3 text-xl font-semibold text-foreground">Configurações</h1>
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={cn(
              'flex flex-col gap-0.5 rounded-[0.625rem] px-3 py-[11px] text-left transition-colors',
              aba === item.id ? 'bg-accent text-accent-strong' : 'text-foreground hover:bg-accent/50'
            )}
          >
            <span className="text-[13.5px] font-medium">{item.label}</span>
            <span className={cn('text-[12px]', aba === item.id ? 'text-accent-strong/80' : 'text-muted-foreground')}>{item.subtitulo}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="flex max-w-[660px] flex-col gap-5">
          {aba === 'backup' && (
            <>
              <div>
                <h2 className="text-[19px] font-semibold text-foreground">Backup</h2>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-foreground">
                  Cópia cifrada do banco e dos anexos. A local é criada sempre; o destino externo é uma cópia adicional.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[14px] font-semibold text-foreground">Backup local</h3>
                    <p className="text-xs text-muted-foreground">Cópia cifrada do banco e dos anexos, salva no computador.</p>
                  </div>
                  <Button type="button" className="h-[34px]" disabled={store.criando} onClick={() => void store.criarBackup()}>
                    {store.criando ? 'Criando…' : 'Criar backup agora'}
                  </Button>
                </div>
                {store.ultimaRestauracao && (
                  <p className="text-xs text-muted-foreground">Última restauração: {formatarDataHoraBr(store.ultimaRestauracao.restauradoEm)}</p>
                )}
                {store.avisoDestino && <p className="text-sm text-warn-foreground">{store.avisoDestino}</p>}
                {store.error && <p className="text-sm text-destructive">{store.error}</p>}
              </div>

              <DestinoBackupSection
                destino={store.destino}
                ultimoBackupExternoEm={store.ultimoBackupExternoEm}
                configurando={store.configurandoDestino}
                error={store.destinoError}
                verificacao={store.verificacaoDestino}
                verificando={store.verificandoDestino}
                onConfigurar={() => void store.configurarDestino()}
                onRemover={() => void store.removerDestino()}
                onVerificar={() => void store.verificarDestino()}
              />

              <div className="overflow-hidden rounded-[0.625rem] border border-border bg-card">
                <div className="border-b border-border px-[18px] py-[14px]">
                  <h3 className="text-[14.5px] font-semibold text-foreground">Backups guardados</h3>
                </div>
                <div className="flex flex-col gap-2 p-[20px_18px]">
                  {store.loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
                  {!store.loading && store.backups.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum backup ainda — crie o primeiro acima.</p>
                  )}
                  {store.backups.map((backup) => (
                    <BackupItem
                      key={backup.pasta}
                      backup={backup}
                      verificando={store.verificandoBusy === backup.pasta}
                      resultadoVerificacao={store.verificando[backup.pasta] ?? null}
                      restaurando={store.restaurando === backup.pasta}
                      onVerificar={() => void store.verificar(backup.pasta)}
                      onRestaurar={() => store.restaurar(backup.pasta)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {aba === 'retencao' && (
            <>
              <div>
                <h2 className="text-[19px] font-semibold text-foreground">Retenção</h2>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-foreground">
                  Mantém 7 backups diários + 4 semanais + 6 mensais (local e externo) — o resto é purgável.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-[14px]">
                <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                  <p className="text-[12.5px] text-muted-foreground">Espaço ocupado</p>
                  <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{formatarBytes(ocupadoBytes)}</p>
                </div>
                <div className="rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                  <p className="text-[12.5px] text-muted-foreground">Uma purga liberaria</p>
                  <p className="mt-1 font-mono text-[22px] font-medium text-foreground">{formatarBytes(aLiberarBytes)}</p>
                </div>
              </div>

              <RetencaoSection
                preview={store.previewPurga}
                purgando={store.purgando}
                error={store.purgaError}
                ultimaPurga={store.ultimaPurga}
                onPurgar={() => void store.executarPurga()}
              />
            </>
          )}

          {aba === 'seguranca' && (
            <>
              <div>
                <h2 className="text-[19px] font-semibold text-foreground">Segurança</h2>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-foreground">
                  Senha mestra, bloqueio automático e a chave de recuperação do cofre.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">Senha mestra</h3>
                  <p className="text-xs text-muted-foreground">Troca de senha ainda não disponível por aqui — em breve.</p>
                </div>
                <Button type="button" variant="outline" className="h-[34px]" disabled>
                  Trocar senha
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">Bloqueio automático</h3>
                  <p className="text-xs text-muted-foreground">Trava o cofre e zera a chave da memória após ociosidade.</p>
                </div>
                <span className="font-mono text-[13.5px] text-muted-foreground">5 minutos</span>
              </div>

              <Alert variant="warn">
                <Lock className="size-[17px]" />
                <AlertDescription className="flex flex-col gap-2">
                  <p>
                    A recovery key é a única forma de entrar no cofre se você esquecer a senha. Ela não pode ser
                    reexibida — se perdida, só é possível gerar uma nova enquanto o cofre ainda está desbloqueado.
                  </p>
                  <Button type="button" variant="outline" className="h-[30px] w-fit border-warn-border text-warn-foreground hover:bg-warn-background" disabled>
                    Gerar uma nova chave
                  </Button>
                </AlertDescription>
              </Alert>
            </>
          )}

          {aba === 'mensagens' && <TemplatesSection />}

          {aba === 'sobre' && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                <div className="flex items-center gap-3">
                  <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-primary text-[15px] font-semibold text-primary-foreground">
                    P
                  </div>
                  <div>
                    <p className="text-[14.5px] font-semibold text-foreground">PsiTrack{store.versao ? ` · versão ${store.versao}` : ''}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      Este app não faz nenhuma chamada de rede. Todos os dados ficam cifrados no disco desta máquina.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={store.atualizacaoStatus === 'disponivel' ? 'default' : 'outline'}
                  className="h-[34px] shrink-0"
                  disabled={atualizacaoEmAndamento}
                  onClick={() =>
                    void (store.atualizacaoStatus === 'disponivel'
                      ? store.baixarEInstalarAtualizacao()
                      : store.verificarAtualizacao())
                  }
                >
                  {atualizacaoRotulo}
                </Button>
              </div>
              <p className={cn('-mt-2 text-[12px]', store.atualizacaoStatus === 'erro' ? 'text-destructive' : 'text-muted-foreground')}>
                {store.atualizacaoStatus === 'erro' && store.atualizacaoError
                  ? store.atualizacaoError
                  : store.atualizacaoStatus === 'disponivel'
                    ? 'Instalar faz backup de segurança automaticamente, baixa e reinicia o app sozinho.'
                    : 'Verificação manual, nunca automática — só roda quando você clica. Requer internet só nesse momento.'}
              </p>

              <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-card p-[16px_18px]">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">Aparência</h3>
                  <p className="text-xs text-muted-foreground">Tema claro, escuro, ou o mesmo do sistema operacional.</p>
                </div>
                <div className="inline-flex h-[34px] overflow-hidden rounded-md border border-border">
                  {OPCOES_APARENCIA.map((opcao, indice) => (
                    <button
                      key={opcao.value}
                      type="button"
                      onClick={() => definirAparencia(opcao.value)}
                      className={cn(
                        'px-3 text-[13px] font-medium transition-colors',
                        indice > 0 && 'border-l border-border',
                        aparencia === opcao.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </div>

              <HistoricoAutomaticoSection historico={store.historico} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
