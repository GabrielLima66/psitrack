import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { BackupItem } from './BackupItem'
import { DestinoBackupSection } from './DestinoBackupSection'
import { formatarDataHoraBr } from './formatters'
import { HistoricoAutomaticoSection } from './HistoricoAutomaticoSection'
import { RetencaoSection } from './RetencaoSection'
import { useConfiguracoesStore } from './store'

/** Tela "Configurações" (Etapas 17-21): backup manual local + destino externo, retenção/purga, restore e scheduler automático, com snapshot de segurança automático antes de sobrescrever, e informações do app. */
export function ConfiguracoesScreen() {
  const store = useConfiguracoesStore()

  useEffect(() => {
    void store.carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 overflow-y-auto p-8">
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Backup local</h2>
            <p className="text-xs text-muted-foreground">Cópia cifrada do banco e dos anexos, salva no computador.</p>
          </div>
          <Button type="button" disabled={store.criando} onClick={() => void store.criarBackup()}>
            {store.criando ? 'Criando…' : 'Criar backup agora'}
          </Button>
        </div>

        {store.ultimaRestauracao && (
          <p className="text-xs text-muted-foreground">
            Última restauração: {formatarDataHoraBr(store.ultimaRestauracao.restauradoEm)}
          </p>
        )}

        {store.avisoDestino && (
          <p className="text-sm text-warn-foreground">{store.avisoDestino}</p>
        )}

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

      <RetencaoSection
        preview={store.previewPurga}
        purgando={store.purgando}
        error={store.purgaError}
        ultimaPurga={store.ultimaPurga}
        onPurgar={() => void store.executarPurga()}
      />

      <HistoricoAutomaticoSection historico={store.historico} />

      <div className="flex flex-col gap-2">
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

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Sobre</h2>
        <p className="text-xs text-muted-foreground">PsiTrack{store.versao ? ` · versão ${store.versao}` : ''}</p>
      </div>
    </div>
  )
}
