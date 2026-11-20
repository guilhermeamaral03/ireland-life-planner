import { describe, expect, it } from 'vitest'
import { sharedTextFromSearch } from './share'

describe('sharedTextFromSearch (botão Compartilhar do Android)', () => {
  it('junta título, texto e link recebidos', () => {
    const q = '?title=Room+in+Carrigaline&text=%E2%82%AC900+per+month&url=https%3A%2F%2Fwww.daft.ie%2Fshare%2Fcork-road-carrigaline-co-cork%2F6716531'
    expect(sharedTextFromSearch(q)).toBe('Room in Carrigaline\n€900 per month\nhttps://www.daft.ie/share/cork-road-carrigaline-co-cork/6716531')
  })
  it('sem nada compartilhado → null', () => {
    expect(sharedTextFromSearch('')).toBeNull()
    expect(sharedTextFromSearch('?v=2')).toBeNull()
  })
})
