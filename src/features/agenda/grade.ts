/**
 * Geometria pura da grade de horário da Agenda (Etapa 5 do redesign) — sem
 * nenhuma dependência de DOM/React, só matemática, pra ficar testável
 * isoladamente. Expediente fixo 08:00–18:00; sessão fora dessa janela ainda
 * é posicionada corretamente (top pode sair do intervalo [0, altura]), só
 * não tem linha de hora de fundo pra referência.
 */

export const HORA_INICIO = 8
export const HORA_FIM = 18
export const PX_HORA = 48
export const TOPO = 8

/** Posição Y (px) de um horário 'HH:MM' dentro da grade. */
export function posY(horaHHMM: string): number {
  const [hora, minuto] = horaHHMM.split(':').map(Number)
  return (hora + minuto / 60 - HORA_INICIO) * PX_HORA + TOPO
}

/** Altura (px) do corpo da grade, do topo do primeiro traço até o fim do expediente. */
export function alturaGrade(): number {
  return (HORA_FIM - HORA_INICIO) * PX_HORA + TOPO
}

/** Rótulos de hora pra régua da esquerda: "08:00" … "18:00". */
export function rotulosHora(): string[] {
  const rotulos: string[] = []
  for (let h = HORA_INICIO; h <= HORA_FIM; h++) rotulos.push(`${String(h).padStart(2, '0')}:00`)
  return rotulos
}
