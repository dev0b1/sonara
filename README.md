## Sonara — Windows STT (Tauri + React)

Sonara is a Windows-focused offline speech-to-text app built with:

- **Frontend**: Vite + React (Chakra UI)
- **Desktop shell**: Tauri (Rust)
- **STT engine**: `faster-whisper` (Python)

Your audio stays local.

## Download (Windows .exe)

- **Recommended**: download the latest installer from **GitHub Releases** (then run it):
  - Latest release: `https://github.com/sonara-stt/sonara/releases/latest`
  - Assets: look for a file like `Sonara_0.1.0_x64-setup.exe` (name may vary)
  - If you don’t see an `.exe` there yet, you haven’t published a Release asset (see “Build Windows .exe” below).

If you don’t have Releases set up yet, build locally and share the `.exe`:

```bash
npm install
npm run tauri:build
```

Typical output locations (Tauri v2):

- `src-tauri/target/release/bundle/nsis/*.exe` (Windows installer)
- `src-tauri/target/release/*.exe` (raw executable, if enabled)

## Features

- **Audio upload → transcription**
- **Timestamped transcript blocks** (5‑minute formatting)
- **Export to `.txt`**
- **License key activation** (stored on the user’s machine)

## Pricing rules (current)

- **Free**: up to **20 minutes per day** of audio upload
- **Lifetime Pro ($12)**: up to **30 hours per file** + export for long recordings

### Checkout links (Whop)

- **Lifetime checkout**: `https://whop.com/checkout/plan_DFiMSfhJDR3NR`

## Run locally (dev)

Prereqs:

- Node.js (LTS)
- Python 3.10+
- Rust toolchain (`cargo`)

Install dependencies:

```bash
npm install
pip install -r requirements.txt
```

Run desktop app (recommended):

```bash
npm run tauri:dev
```

Run browser UI preview only (no desktop backend):

```bash
npm run dev
```

## Configuration

Copy `.env.example` to `.env` and tweak:

- `VITE_LIFETIME_PRICE` (default 12)
- `VITE_FREE_DAILY_SECONDS` (default 1200 = 20 min/day)
- `VITE_PRO_UPLOAD_LIMIT_SECONDS` (default 108000 = 30 hours)
- `VITE_EXPORT_PAYWALL_SECONDS` (default 3600 = export paywall after 1 hour)
- `VITE_WHOP_LIFETIME_URL`

## License keys

Keys are persisted locally at:

- `~/.sonara_license.json`

Activation happens in-app via **Upgrade → Activate**. The app remembers the key after activation.

## Web version (separate folder)

`web-version/` contains a standalone HTML/CSS/vanilla JS version using:

- Web Speech API (microphone transcription)
- FileReader API (audio file metadata)

Pricing config for web lives in:

- `web-version/pricing.config.json`

### Test web version

Run a local static server (recommended so `pricing.config.json` loads):

```bash
cd web-version
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Build Windows .exe (Desktop)

This project is built with **Tauri**, so you build the desktop app like this:

```bash
npm install
npm run tauri:build
```

Your Windows installer/executable is created under `src-tauri/target/release/` (see paths above).

Note: MSI packaging may fail if WiX cannot be downloaded (network/DNS). The `.exe` can still be built successfully.

## ⚙️ Model Sizes

Edit `stt_engine.py` → `model_size=` to change:

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny | 75MB | Fastest | Basic |
| base | 145MB | Fast | Good ← default |
| small | 465MB | Medium | Better |
| medium | 1.5GB | Slow | Great |

---

## 📄 License
MIT — free to use and modify.
