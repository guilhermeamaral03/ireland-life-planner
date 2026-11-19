import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { saveProfile, useProfile } from '../app/useProfile'
import { resizeToDataUrl } from '../domain/image'
import { Avatar } from './Avatar'

/** Nome e foto de quem usa este aparelho (perfil local, sem login). */
export function ProfileEditor() {
  const profile = useProfile()
  const [name, setName] = useState(profile.name)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => setName(profile.name), [profile.name])

  const saveName = async () => {
    await saveProfile({ name })
    setMessage({ type: 'success', text: 'Nome salvo.' })
  }

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await saveProfile({ photo: await resizeToDataUrl(file) })
      setMessage({ type: 'success', text: 'Foto salva.' })
    } catch (x) {
      setMessage({ type: 'error', text: x instanceof Error ? x.message : 'Não foi possível usar essa imagem.' })
    }
  }

  return (
    <section className="card">
      <h2>Perfil</h2>
      <p className="muted">Fica só neste aparelho (sem login nem senha) e vai junto no backup.</p>
      <div className="profile-row">
        <Avatar name={profile.name} photo={profile.photo} size={72} />
        <div className="row">
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPhoto} />
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            {profile.photo ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {profile.photo && (
            <button type="button" className="btn btn-danger" onClick={() => saveProfile({ photo: null })}>
              Remover foto
            </button>
          )}
        </div>
      </div>
      <div className="row" style={{ marginTop: 'var(--space-4)', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label htmlFor="profile-name">Nome</label>
          <input
            id="profile-name"
            className="input"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={saveName} disabled={name.trim() === profile.name}>
          Salvar nome
        </button>
      </div>
      {message && (
        <div className={`alert alert-${message.type}`} role="status" style={{ marginTop: 'var(--space-3)' }}>
          {message.text}
        </div>
      )}
    </section>
  )
}
