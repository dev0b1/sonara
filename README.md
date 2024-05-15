# 🎙 Sonara — Local Speech to Text for Windows

> Offline transcription powered by faster-whisper. No internet required. No subscriptions. Your audio never leaves your machine.

---

## ✨ Features

| Feature | Free | Pro ($49 lifetime) |
|---|---|---|
| Microphone recording | ✅ | ✅ |
| Audio file upload (MP3, WAV, M4A…) | ✅ | ✅ |
| Transcription | ✅ 10 min | ✅ Unlimited |
| 5-minute timestamp blocks | ❌ | ✅ |
| Save transcript to .txt | ❌ | ✅ |
| All Whisper model sizes | ❌ | ✅ |

---

## 📦 Download

👉 **[Download Sonara.exe](https://github.com/yourusername/sonara/releases/latest)**

No installation needed. Just run the `.exe`.

---

## Manual Activation (small userbase)

If you prefer not to run a backend, you can use a manual activation flow:

- After purchasing via the in-app Upgrade (opens Whop checkout), email your purchase receipt to support@yourdomain.com (or the address you set) with your order details.
- The developer will verify the purchase and reply with a `SONARA-...` license key.
- Open the app, go to `Upgrade` → `Activate`, paste the received key and press `Activate` to unlock Pro features.

Master key (one-time key for all buyers)
--------------------------------------

If you prefer to issue a single key to all buyers (not recommended for long-term security), you can use a master key. The app checks environment variable `MASTER_LICENSE_KEY` first; if not set it will look for `master_license_key.txt` in the app folder. Put your master key in Whop's post-purchase content or metadata so users receive it after purchase.

Export Unlock
-------------

Transcripts longer than 3 hours require an Export Unlock (`EXPORT`) key. You can either:
- Provide a special export key to the buyer (the app treats keys containing "EXPORT" as export unlocks), or
- Offer an Export product in Whop and deliver the export key manually.

Environment variables for purchase links
---------------------------------------
- `WHOP_CHECKOUT_URL` — default lifetime checkout link
- `WHOP_MONTHLY_URL` — monthly subscription link (app shows $29/month)
- `WHOP_EXPORT_URL` — export unlock purchase link (app shows $99)


This approach avoids hosting a backend and is suitable for low-volume sales (<100 users). It requires manual handling of activations by the developer.


## 🛠 Run from Source

```bash
# 1. Clone repo
git clone https://github.com/yourusername/sonara.git
cd sonara

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
python main.py
```

### Optional: HF token for faster first-time model download
`faster-whisper` may pull model files from Hugging Face Hub. Token is optional, but helps with speed and rate limits.

PowerShell:
```powershell
$env:HF_TOKEN="your_token_here"
python main.py
```

CMD:
```cmd
set HF_TOKEN=your_token_here
python main.py
```

## 📁 Folder Structure

```
sonara/
├── main.py          # Entry point
├── ui.py            # CustomTkinter UI + pricing modal
├── stt_engine.py    # faster-whisper engine + timestamping
├── license.py       # Free/Pro tier management
├── requirements.txt
├── build.bat        # Build .exe on Windows
└── README.md
```

## 🔨 Build .exe

```bash
# Windows: double-click build.bat  OR run:
pyinstaller --onefile --windowed --name "Sonara" main.py
# Output: dist/Sonara.exe
```

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
