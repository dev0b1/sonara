/**
 * Tauri `invoke` may return a string (Rust `String`) or an already-parsed object
 * depending on version/plugins. Normalize before reading fields.
 */
export function parseInvokeJson(out) {
  if (out == null) return null
  if (typeof out === 'object' && !Array.isArray(out)) return out
  const s = String(out).trim()
  if (!s) return null
  return JSON.parse(s)
}
