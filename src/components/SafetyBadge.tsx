import { SAFETY_LABELS, type SafetyLevel } from '../domain/safety'

/** Selo de avaliação — sempre com texto (cor nunca é o único sinal). */
export function SafetyBadge({ level }: { level: SafetyLevel }) {
  return <span className={`badge safety-${level}`}>{SAFETY_LABELS[level]}</span>
}
