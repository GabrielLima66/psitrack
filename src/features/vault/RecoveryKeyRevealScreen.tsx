import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { AuthLayout } from './AuthLayout'

interface RecoveryKeyRevealScreenProps {
  recoveryKey: string
  onContinue: () => void
}

/** Mostrada uma única vez — a chamadora descarta `recoveryKey` do estado assim que `onContinue` roda. */
export function RecoveryKeyRevealScreen({ recoveryKey, onContinue }: RecoveryKeyRevealScreenProps) {
  const [copied, setCopied] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const blocks = recoveryKey.split('-')

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(recoveryKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sem clipboard disponível: a usuária ainda pode anotar/salvar em .txt.
    }
  }

  function handleSaveTxt(): void {
    const blob = new Blob([recoveryKey], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'psitrack-recovery-key.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AuthLayout
      panel={{
        headline: 'A única cópia de segurança é a que você guarda.',
        subtext:
          'Imprima ou anote esta chave e guarde longe do computador — em uma gaveta com chave, junto de documentos importantes.',
        footer: 'MOSTRADA UMA ÚNICA VEZ'
      }}
    >
      <div className="flex w-full max-w-[480px] flex-col gap-[22px]">
        <h1 className="text-2xl font-semibold text-foreground">Sua chave de recuperação</h1>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted p-[22px]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-center font-mono text-lg font-medium tracking-[0.08em] text-foreground">
            {blocks.map((block, index) => (
              <div key={index}>{block}</div>
            ))}
          </div>
          <div className="flex gap-2.5">
            <Button type="button" variant="outline" className="h-9 flex-1 rounded-lg" onClick={handleCopy}>
              {copied ? 'Copiada' : 'Copiar chave'}
            </Button>
            <Button type="button" variant="outline" className="h-9 flex-1 rounded-lg" onClick={handleSaveTxt}>
              Salvar .txt
            </Button>
          </div>
        </div>

        <Alert variant="warn">
          <AlertDescription className="text-[13.5px] leading-relaxed text-warn-foreground">
            Sem a senha mestra e sem esta chave, os prontuários ficam permanentemente inacessíveis. Não existe
            recuperação por e-mail nem por suporte.
          </AlertDescription>
        </Alert>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="keySaved"
            checked={keySaved}
            onCheckedChange={(value) => setKeySaved(value === true)}
            className="mt-0.5"
          />
          <Label htmlFor="keySaved" className="text-[13.5px] font-normal text-foreground">
            Guardei esta chave em um lugar seguro, fora deste computador.
          </Label>
        </div>

        <Button type="button" disabled={!keySaved} onClick={onContinue} className="h-[42px] w-full rounded-lg">
          Continuar
        </Button>
      </div>
    </AuthLayout>
  )
}
