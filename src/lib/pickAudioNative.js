/**
 * Native open-file dialog (Tauri). Requires @tauri-apps/plugin-dialog + Rust plugin.
 * Returns { path, label } or null if cancelled / not in Tauri / error.
 */
import { open } from '@tauri-apps/plugin-dialog'

const AUDIO_FILTERS = [
  {
    name: 'Audio',
    extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac', 'wma'],
  },
]

export async function tryPickAudioPathNative() {
  try {
    const selected = await open({
      multiple: false,
      filters: AUDIO_FILTERS,
    })
    const path =
      typeof selected === 'string'
        ? selected
        : Array.isArray(selected)
          ? selected[0]
          : null
    if (!path) return null
    const label = path.replace(/^.*[/\\]/, '')
    return { path, label }
  } catch {
    return null
  }
}
