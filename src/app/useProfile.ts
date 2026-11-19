import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../db/db'

const EVENT = 'ilp:profile-changed'

export interface Profile {
  name: string
  photo: string | null
}

/** Perfil local (nome e foto) — atualiza todas as telas quando muda. */
export function useProfile() {
  const [profile, setProfile] = useState<Profile>({ name: '', photo: null })
  useEffect(() => {
    const load = () =>
      getSettings()
        .then((s) => setProfile({ name: s.profileName ?? '', photo: s.profilePhoto ?? null }))
        .catch(() => undefined)
    load()
    window.addEventListener(EVENT, load)
    return () => window.removeEventListener(EVENT, load)
  }, [])
  return profile
}

export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  await saveSettings({
    ...(patch.name !== undefined ? { profileName: patch.name.trim() } : {}),
    ...(patch.photo !== undefined ? { profilePhoto: patch.photo } : {}),
  })
  window.dispatchEvent(new Event(EVENT))
}
