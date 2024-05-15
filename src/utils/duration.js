/** Audio duration from API (seconds, number or numeric string). */
export function durationSeconds(value) {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export const THREE_HOURS_SECONDS = 3 * 60 * 60

export function formatDurationHuman(seconds) {
  const s = durationSeconds(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}
