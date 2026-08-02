import { describe, expect, it } from 'vitest'
import { escolherPagadorPadrao } from './pagador'

describe('escolherPagadorPadrao', () => {
  it('sem responsáveis: usa a própria paciente', () => {
    const resultado = escolherPagadorPadrao({ nome: 'Ana', cpf: '11144477735' }, [])
    expect(resultado).toEqual({ nome: 'Ana', cpf: '11144477735' })
  })

  it('paciente menor com responsável pagador: usa o CPF do responsável', () => {
    const resultado = escolherPagadorPadrao({ nome: 'Ana Menor', cpf: null }, [
      { nome: 'Mãe da Ana', cpf: '11144477735', pagador: true }
    ])
    expect(resultado).toEqual({ nome: 'Mãe da Ana', cpf: '11144477735' })
  })

  it('responsável existe mas não é pagador: usa a própria paciente', () => {
    const resultado = escolherPagadorPadrao({ nome: 'Ana Menor', cpf: null }, [
      { nome: 'Mãe da Ana', cpf: '11144477735', pagador: false }
    ])
    expect(resultado).toEqual({ nome: 'Ana Menor', cpf: null })
  })

  it('mais de um responsável: usa o que tem pagador=true', () => {
    const resultado = escolherPagadorPadrao({ nome: 'Ana Menor', cpf: null }, [
      { nome: 'Pai da Ana', cpf: '22233344456', pagador: false },
      { nome: 'Mãe da Ana', cpf: '11144477735', pagador: true }
    ])
    expect(resultado.nome).toBe('Mãe da Ana')
  })
})
