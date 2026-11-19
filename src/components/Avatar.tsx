import { initials } from '../domain/image'

/** Foto do perfil ou, sem foto, as iniciais do nome. */
export function Avatar({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  return photo ? (
    <img className="avatar" src={photo} alt={name ? `Foto de ${name}` : 'Foto do perfil'} style={style} />
  ) : (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  )
}
