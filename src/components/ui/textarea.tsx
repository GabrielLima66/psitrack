import * as React from "react"

import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Cresce com o conteúdo até `alturaMaxima`, então rola. */
  autoResize?: boolean
  alturaMaxima?: number
}

/**
 * O auto-resize reage a `value`, não a evento de teclado — é o que faz COLAR
 * um texto longo ajustar a altura também, e não só digitar (SPEC-fase-5.md
 * §4 / SPEC-fase-6.md Etapa 24). Só funciona em uso controlado, que é como
 * todo formulário deste app já usa o componente.
 */
function Textarea({ className, autoResize, alturaMaxima = 420, ref, ...props }: TextareaProps) {
  const interno = React.useRef<HTMLTextAreaElement | null>(null)

  function registrar(el: HTMLTextAreaElement | null): void {
    interno.current = el
    if (typeof ref === "function") ref(el)
    else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = el
  }

  React.useLayoutEffect(() => {
    const el = interno.current
    if (!el || !autoResize) return
    // Zera antes de medir: sem isso `scrollHeight` nunca diminui ao apagar texto.
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, alturaMaxima)}px`
    el.style.overflowY = el.scrollHeight > alturaMaxima ? "auto" : "hidden"
  }, [autoResize, alturaMaxima, props.value])

  return (
    <textarea
      data-slot="textarea"
      ref={registrar}
      className={cn(
        "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
