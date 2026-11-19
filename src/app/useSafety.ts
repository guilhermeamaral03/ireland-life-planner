import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, getSettings } from '../db/db'
import type { CrimeStation, Location } from '../db/types'
import { classifyLocation, DEFAULT_SAFETY_CRITERIA, type SafetyCriteria, type SafetyResult } from '../domain/safety'

/** Dados de ocorrências guardados no aparelho + critérios atuais. */
export function useSafety() {
  const [stations, setStations] = useState<CrimeStation[]>([])
  const [criteria, setCriteria] = useState<SafetyCriteria>(DEFAULT_SAFETY_CRITERIA)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const [st, s] = await Promise.all([db.crimeStations.toArray(), getSettings()])
    setStations(st.sort((a, b) => a.name.localeCompare(b.name, 'en')))
    setCriteria(s.safetyCriteria ?? DEFAULT_SAFETY_CRITERIA)
    setLoaded(true)
  }, [])
  useEffect(() => {
    reload()
  }, [reload])

  const byCode = useMemo(() => new Map(stations.map((s) => [s.code, s])), [stations])
  const classify = useCallback(
    (l: Location): SafetyResult => classifyLocation(l, byCode, criteria),
    [byCode, criteria],
  )

  return { stations, byCode, criteria, classify, loaded, reload }
}
