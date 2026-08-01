import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VaultFlow } from '@/features/vault/VaultFlow'

/**
 * Placeholder do que vem depois do desbloqueio — ainda não é uma feature
 * real (Fase 0 proíbe tela de paciente/agenda/financeiro). Só prova que o
 * pipeline renderer → preload → IPC → main está de pé.
 */
function App() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    window.psitrack.app.getVersion().then(setVersion)
  }, [])

  return (
    <VaultFlow>
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>PsiTrack</CardTitle>
            <CardDescription>Fase 0 — fundação (shell, cripto, backup)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Versão do app: {version ?? 'carregando…'}
            </p>
            <Button onClick={() => window.psitrack.app.getVersion().then(setVersion)}>
              Recarregar versão
            </Button>
          </CardContent>
        </Card>
      </div>
    </VaultFlow>
  )
}

export default App
