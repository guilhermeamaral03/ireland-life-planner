import { describe, expect, it } from 'vitest'
import { backupOverdue, isIOS } from './storage'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'

describe('isIOS', () => {
  it('detecta iPhone', () => expect(isIOS(IPHONE, 5)).toBe(true))
  it('não confunde Android', () => expect(isIOS(ANDROID, 5)).toBe(false))
  it('detecta iPad que se apresenta como Mac com toque', () => expect(isIOS(MAC, 5)).toBe(true))
  it('Mac de verdade (sem toque) não é iOS', () => expect(isIOS(MAC, 0)).toBe(false))
})

describe('backupOverdue', () => {
  const now = new Date('2026-11-19T12:00:00Z')
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

  it('sem backup → atrasado', () => expect(backupOverdue(null, now)).toBe(true))
  it('15 dias → atrasado', () => expect(backupOverdue(daysAgo(15), now)).toBe(true))
  it('3 dias → em dia', () => expect(backupOverdue(daysAgo(3), now)).toBe(false))
  it('data inválida → atrasado', () => expect(backupOverdue('lixo', now)).toBe(true))
})
