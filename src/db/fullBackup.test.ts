import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../services/__fixtures__/cja11-mini.json'
import { parseCja11, saveStations } from '../services/cso'
import { emptyProperty } from '../domain/properties'
import { clearAllData, exportBackup, importBackup, parseBackup } from './backup'
import { db, ensureSeeded, saveSettings, TABLE_NAMES } from './db'

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
  await ensureSeeded()
})

/** Uso completo: todos os módulos preenchidos → backup → apagar → importar → tudo igual. */
describe('backup de ponta a ponta', () => {
  it('preserva os dados de todos os módulos', async () => {
    await saveSettings({ grossAnnual: 52000, taxYear: 2027, taxStatus: 'casado_duas_rendas', spouseGrossAnnual: 30000, initialReserve: 8000 })
    const aluguel = (await db.categories.where('name').equals('Aluguel').first())!.id!
    await db.expenses.add({ name: 'Quarto', categoryId: aluguel, amount: 950, frequency: 'mensal', kind: 'fixa' })
    await db.categories.add({ name: 'Academia', group: 'outros', builtIn: false })
    // cenários saíram da tela, mas dados antigos continuam no backup
    await db.scenarios.add({ name: 'Com carro', grossAnnual: 60000, taxStatus: null, spouseGrossAnnual: null, initialReserve: null, amounts: { aluguel: 0, contas: 0, alimentacao: 0, transporte: 0, pessoais: 0, outros: 0 } })
    const bal = (await db.locations.where('name').equals('Ballincollig').first())!
    await db.locations.update(bal.id!, {
      favorite: true,
      notes: 'Perto do parque',
      rentRange: { value: { min: 1200, max: 1500 }, source: 'Daft', date: '2026-11-01' },
      gardaStation: { code: '31201', origin: 'nome' },
    })
    await db.properties.add({ ...emptyProperty(), title: 'Apto Ballincollig', rent: 1100, locationId: bal.id!, lat: 51.89, lng: -8.59 })
    await saveStations(parseCja11(fixture, '2026-11-19T12:00:00.000Z'))
    await db.safetyRecords.add({ locationId: bal.id!, area: 'Ballincollig', periodStart: '2025-01-01', periodEnd: '2025-12-31', category: '07', count: 12, source: 'teste', updatedAt: '2026-11-19', limitations: '' })

    const snapshot = Object.fromEntries(await Promise.all(TABLE_NAMES.map(async (t) => [t, await db.table(t).toArray()])))
    // cada tabela precisa ter dado, senão o teste não prova nada para ela
    for (const t of TABLE_NAMES) expect((snapshot[t] as unknown[]).length, `tabela ${t} vazia no teste`).toBeGreaterThan(0)
    const text = JSON.stringify(await exportBackup())

    await clearAllData()
    expect(await db.properties.count()).toBe(0)

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importBackup(parsed.data)

    for (const t of TABLE_NAMES) {
      const now = await db.table(t).toArray()
      if (t === 'settings') {
        // o arquivo carrega a própria data de backup; o resto é igual
        const { lastBackupAt: _a, ...before } = (snapshot[t] as Record<string, unknown>[])[0]
        const { lastBackupAt: _b, ...after } = now[0] as Record<string, unknown>
        expect(after, t).toEqual(before)
      } else {
        expect(now, t).toEqual(snapshot[t])
      }
    }
  })
})
