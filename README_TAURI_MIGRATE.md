Sonara — Tauri + React migration

Overview

This workspace contains the original Python app and a minimal scaffold for migrating to Tauri + React.
The Python STT engine remains in `python/` and is callable via the Tauri Rust backend using the `transcribe_file` command.

Quick dev steps (requires Node, Rust, Tauri CLI):

1) Install prerequisites

- Node.js (LTS)
- Rust (rustup)
- Tauri CLI: `npm install -g @tauri-apps/cli`

2) Install Python deps

```bash
pip install -r requirements.txt
# ensure faster-whisper, soundfile, sounddevice, numpy are installed
```

3) UI dev (React + Vite)

```bash
npm install
npm run dev
# open the exact URL printed in the terminal (usually http://localhost:5173)
```

**Blank page but tab title says “Sonara”?**

- `vite.config.js` enables the React plugin and pins the dev server to **port 5173** (`strictPort: true`). If something else is already using 5173, **stop the other process** or Vite will exit with “Port 5173 is in use”. Do not keep browsing an old tab on 5173 while Vite moved to 5174 — that tab can look “empty” or wrong.
- Hard-refresh the page (Ctrl+Shift+R) or open DevTools → Console for red errors.

4) Tauri dev (calls Python bridge)

```bash
# in one terminal run Python prerequisites
# in another terminal
npm run tauri:dev
```

Notes

- `python/transcribe.py` is the CLI bridge used by Tauri. It uses `faster-whisper` and reuses helpers from `stt_engine.py`.
- `src-tauri/main.rs` defines a Tauri command `transcribe_file(path)` which spawns the Python process and returns JSON stdout.
- This is a minimal scaffold to verify integration; production packaging requires adding `tauri.conf.json`, icons, and CI build steps.
