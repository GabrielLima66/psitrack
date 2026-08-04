/**
 * Geometria pura da grade de horário da Agenda (Etapa 5 do redesign, com o
 * ajuste de rolamento infinito) — sem nenhuma dependência de DOM/React, só
 * matemática, pra ficar testável isoladamente.
 *
 * A grade cobre as 24h do dia e rola em loop: passar de 23:00 continua em
 * 00:00 do mesmo dia, sem parar. Pra isso o dia é renderizado em `COPIAS`
 * cópias empilhadas verticalmente (mesmo conteúdo, repetido) — quando o
 * scroll entra na primeira ou na última cópia, é realocado silenciosamente
 * pra cópia do meio, o que é imperceptível porque as cópias são idênticas.
 */

export const PX_HORA = 48
export const TOPO = 8
export const HORAS_POR_DIA = 24
/** Altura de um dia completo, sem a folga do topo (as cópias se encaixam sem emenda). */
export const ALTURA_CICLO = HORAS_POR_DIA * PX_HORA
/** Quantas cópias do dia ficam empilhadas — 3 dá buffer pra rolar pra cima ou pra baixo antes de precisar realocar. */
export const COPIAS = 3
/** Hora que fica no topo da viewport ao abrir a tela — a maioria das sessões cai no horário comercial. */
export const HORA_SCROLL_INICIAL = 7

/** Posição Y (px) de um horário 'HH:MM' dentro de UM ciclo de 24h (0 = meia-noite, ALTURA_CICLO = meia-noite seguinte). */
export function posYNoCiclo(horaHHMM: string): number {
  const [hora, minuto] = horaHHMM.split(':').map(Number)
  return (hora + minuto / 60) * PX_HORA
}

/** Posição Y absoluta na grade empilhada: `copia` é qual repetição do dia (0 … COPIAS-1). */
export function posYCiclico(horaHHMM: string, copia: number): number {
  return TOPO + posYNoCiclo(horaHHMM) + copia * ALTURA_CICLO
}

/** Altura total do conteúdo rolável (as `COPIAS` cópias empilhadas + a folga do topo). */
export function alturaTotal(): number {
  return TOPO + ALTURA_CICLO * COPIAS
}

/** scrollTop inicial: pousa na cópia do meio, na hora de abertura padrão. */
export function scrollInicial(): number {
  return posYCiclico(`${String(HORA_SCROLL_INICIAL).padStart(2, '0')}:00`, Math.floor(COPIAS / 2))
}

/**
 * Se o scroll entrou na primeira ou na última cópia, devolve o valor
 * realocado pra cópia do meio (mesmo conteúdo, pulo imperceptível);
 * `null` se ainda está numa cópia segura e não precisa realocar.
 */
export function scrollRealocado(scrollTop: number): number | null {
  if (scrollTop < ALTURA_CICLO) return scrollTop + ALTURA_CICLO
  if (scrollTop >= ALTURA_CICLO * (COPIAS - 1)) return scrollTop - ALTURA_CICLO
  return null
}

/** Rótulos de um ciclo: "00:00" … "23:00" — "24:00" não entra, seria igual ao "00:00" da cópia seguinte. */
export function rotulosHora(): string[] {
  const rotulos: string[] = []
  for (let h = 0; h < HORAS_POR_DIA; h++) rotulos.push(`${String(h).padStart(2, '0')}:00`)
  return rotulos
}
