import { describe, expect, it } from 'vitest'
import { ALTURA_CICLO, alturaTotal, COPIAS, posYCiclico, posYNoCiclo, rotulosHora, scrollInicial, scrollRealocado, TOPO } from './grade'

describe('posYNoCiclo', () => {
  it('00:00 fica em 0', () => {
    expect(posYNoCiclo('00:00')).toBe(0)
  })

  it('01:00 fica uma hora abaixo (48px)', () => {
    expect(posYNoCiclo('01:00')).toBe(48)
  })

  it('14:30 fica na metade da hora', () => {
    expect(posYNoCiclo('14:30')).toBe(14.5 * 48)
  })

  it('23:00, última hora do ciclo, ainda cabe antes do fim', () => {
    expect(posYNoCiclo('23:00')).toBeLessThan(ALTURA_CICLO)
  })
})

describe('posYCiclico', () => {
  it('cópia 0 é igual a posYNoCiclo + TOPO', () => {
    expect(posYCiclico('09:00', 0)).toBe(TOPO + posYNoCiclo('09:00'))
  })

  it('cópia 1 vem um ciclo inteiro abaixo da cópia 0, no mesmo horário', () => {
    expect(posYCiclico('09:00', 1)).toBe(posYCiclico('09:00', 0) + ALTURA_CICLO)
  })

  it('00:00 da cópia N+1 é exatamente onde 24:00 da cópia N estaria — sem emenda', () => {
    expect(posYCiclico('00:00', 1)).toBe(posYCiclico('00:00', 0) + ALTURA_CICLO)
  })
})

describe('alturaTotal', () => {
  it('soma as COPIAS cópias mais a folga do topo', () => {
    expect(alturaTotal()).toBe(TOPO + ALTURA_CICLO * COPIAS)
  })
})

describe('scrollInicial', () => {
  it('pousa na cópia do meio (índice 1, com 3 cópias)', () => {
    expect(COPIAS).toBe(3)
    expect(scrollInicial()).toBe(posYCiclico('07:00', 1))
  })
})

describe('scrollRealocado — o coração do rolamento infinito', () => {
  it('dentro da cópia do meio, não realoca', () => {
    expect(scrollRealocado(ALTURA_CICLO * 1.5)).toBeNull()
  })

  it('entrando na primeira cópia (rolando pra cima, "antes da meia-noite"), realoca uma cópia pra frente', () => {
    const quaseNoTopo = 10
    expect(scrollRealocado(quaseNoTopo)).toBe(quaseNoTopo + ALTURA_CICLO)
  })

  it('entrando na última cópia (rolando de 23h pra 00h de novo), realoca uma cópia pra trás — é o "23 -> 00 -> 01 -> 02" pedido', () => {
    const entrandoNaUltimaCopia = ALTURA_CICLO * (COPIAS - 1) + 10
    expect(scrollRealocado(entrandoNaUltimaCopia)).toBe(entrandoNaUltimaCopia - ALTURA_CICLO)
  })

  it('o valor realocado sempre cai numa zona segura (não dispara de novo)', () => {
    const realocado = scrollRealocado(10)!
    expect(scrollRealocado(realocado)).toBeNull()
  })
})

describe('rotulosHora', () => {
  it('vai de 00:00 a 23:00, 24 rótulos — sem "24:00" duplicando o "00:00" da cópia seguinte', () => {
    const rotulos = rotulosHora()
    expect(rotulos).toHaveLength(24)
    expect(rotulos[0]).toBe('00:00')
    expect(rotulos.at(-1)).toBe('23:00')
  })
})
