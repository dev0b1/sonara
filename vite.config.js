import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginDialogEntry = path.resolve(
  __dirname,
  'node_modules/@tauri-apps/plugin-dialog/dist-js/index.js'
)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Explicit file helps Vite on Windows when package exports confuse resolution
      '@tauri-apps/plugin-dialog': pluginDialogEntry,
    },
  },
  optimizeDeps: {
    include: ['@tauri-apps/plugin-dialog', '@tauri-apps/api'],
  },
  // Tauri watches the Rust project; don't restart Vite on every src-tauri change
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  clearScreen: false,
})
