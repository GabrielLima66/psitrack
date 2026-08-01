interface IdentityPanelProps {
  headline: string
  subtext?: string
  footer: string
}

/** Painel fixo à esquerda das telas de auth — marca + promessa de privacidade. Cor invariante ao tema (design handoff). */
export function IdentityPanel({ headline, subtext, footer }: IdentityPanelProps) {
  return (
    <div className="flex w-[440px] flex-none flex-col justify-between bg-panel px-11 py-12 text-panel-foreground">
      <div className="flex items-center gap-3">
        <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-white/12 text-base font-semibold">
          P
        </div>
        <div className="text-[15px] font-semibold tracking-[0.14em] uppercase">PsiTrack</div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="text-balance text-2xl leading-[1.3] font-semibold">{headline}</div>
        {subtext && <div className="text-balance text-sm leading-relaxed text-panel-foreground/66">{subtext}</div>}
      </div>

      <div className="font-mono text-[11.5px] tracking-[0.06em] text-panel-foreground/45">{footer}</div>
    </div>
  )
}
