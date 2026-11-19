import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportBackup, importBackup } from '../db/backup'
import { db } from '../db/db'
import fixture from './__fixtures__/cja11-mini.json'
import { fetchCja11, parseCja11, saveStations } from './cso'

const AT = '2026-11-19T12:00:00.000Z'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

describe('parseCja11', () => {
  it('extrai só as estações de Cork, com contagens por ano e ofensa', () => {
    const st = parseCja11(fixture, AT)
    expect(st.map((s) => s.name)).toEqual(['Ballincollig', 'Kinsale'])
    const ball = st[0]
    expect(ball.code).toBe('31201')
    expect(ball.division).toBe('Cork City Division')
    expect(ball.counts['2024']['07']).toBe(12)
    expect(ball.counts['2025']['08']).toBe(225)
    expect(ball.csoUpdated).toBe(fixture.updated)
    expect(ball.fetchedAt).toBe(AT)
  })

  it('preserva ausência de dado como null', () => {
    const kinsale = parseCja11(fixture, AT)[1]
    expect(kinsale.counts['2023']['07']).toBeNull()
  })

  it('formato inesperado → erro', () => {
    expect(() => parseCja11({ id: [] }, AT)).toThrow('Formato inesperado da tabela do CSO.')
    expect(() => parseCja11(null, AT)).toThrow('Formato inesperado da tabela do CSO.')
  })
})

describe('fetchCja11', () => {
  it('sem internet → mensagem clara', async () => {
    const r = await fetchCja11(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(r).toEqual({ ok: false, reason: 'Não foi possível baixar os dados do CSO (sem internet ou serviço fora do ar).' })
  })

  it('resposta válida', async () => {
    const r = await fetchCja11(vi.fn().mockResolvedValue({ ok: true, json: async () => fixture }))
    expect(r.ok && r.stations.length).toBe(2)
  })

  it('resposta em formato errado → mensagem', async () => {
    const r = await fetchCja11(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ x: 1 }) }))
    expect(r).toEqual({ ok: false, reason: 'Formato inesperado da tabela do CSO.' })
  })
})

describe('armazenamento', () => {
  it('saveStations substitui os dados', async () => {
    const st = parseCja11(fixture, AT)
    await saveStations(st)
    await saveStations([st[0]])
    expect((await db.crimeStations.toArray()).map((s) => s.name)).toEqual(['Ballincollig'])
  })

  it('backup antigo sem a tabela importa sem erro', async () => {
    await saveStations(parseCja11(fixture, AT))
    const backup = await exportBackup()
    delete (backup.tables as Record<string, unknown>).crimeStations
    await importBackup(backup)
    expect(await db.crimeStations.count()).toBe(0)
  })
})

describe('OFFENCE_CODES', () => {
  it('em ordem numérica, começando em 03', async () => {
    const { OFFENCE_CODES } = await import('./cso')
    expect(OFFENCE_CODES[0]).toBe('03')
    expect(OFFENCE_CODES[OFFENCE_CODES.length - 1]).toBe('16')
  })
})
