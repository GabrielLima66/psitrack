import { describe, expect, it } from 'vitest'
import { alturaGrade, posY, rotulosHora } from './grade'

describe('posY', () => {
  it('08:00 fica no topo (8px de folga)', () => {
    expect(posY('08:00')).toBe(8)
  })

  it('09:00 fica uma hora abaixo (48px)', () => {
    expect(posY('09:00')).toBe(56)
  })

  it('14:30 fica na metade da hora', () => {
    expect(posY('14:30')).toBe((14 + 0.5 - 8) * 48 + 8)
  })

  it('horário fora do expediente ainda calcula uma posição (negativa/além)', () => {
    expect(posY('07:00')).toBe(8 - 48)
    expect(posY('19:00')).toBe((19 - 8) * 48 + 8)
  })
})

describe('alturaGrade', () => {
  it('cobre 08:00–18:00 (10h) mais a folga do topo', () => {
    expect(alturaGrade()).toBe(10 * 48 + 8)
  })
})

describe('rotulosHora', () => {
  it('vai de 08:00 a 18:00 inclusive, 11 rótulos', () => {
    const rotulos = rotulosHora()
    expect(rotulos).toHaveLength(11)
    expect(rotulos[0]).toBe('08:00')
    expect(rotulos.at(-1)).toBe('18:00')
  })
})
