const defaultConfig = {
  lifetimePrice: 12,
  freeDailySeconds: 20 * 60,
  proUploadLimitSeconds: 30 * 3600,
  lifetimeWhop: "https://whop.com/checkout/plan_DFiMSfhJDR3NR",
};
let cfg = { ...defaultConfig };
let uploadedDurationSeconds = 0;

const transcriptEl = document.getElementById("transcript");
const fileInput = document.getElementById("audioFile");
const fileInfo = document.getElementById("fileInfo");
const transcribeBtn = document.getElementById("transcribeBtn");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");

const pricingModal = document.getElementById("pricingModal");
const upgradeBtn = document.getElementById("upgradeBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const lifetimeBtn = document.getElementById("lifetimeBtn");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const accessKeyInput = document.getElementById("accessKey");
const keyStatus = document.getElementById("keyStatus");
const pricingReason = document.getElementById("pricingReason");
const lifetimePriceLabel = document.getElementById("lifetimePriceLabel");

function openPricing(reason = "Lifetime Pro is a one-time purchase. After checkout you’ll receive a personal unique key.") {
  pricingReason.textContent = reason;
  pricingModal.classList.remove("hidden");
}

function closePricing() {
  pricingModal.classList.add("hidden");
}

function saveAccessKey() {
  const key = accessKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Enter a key first.";
    return;
  }
  localStorage.setItem("sonara_access_key", key);
  keyStatus.textContent = "Access key saved locally.";
}

upgradeBtn.addEventListener("click", () => openPricing());
closeModalBtn.addEventListener("click", closePricing);
saveKeyBtn.addEventListener("click", saveAccessKey);
lifetimeBtn.addEventListener("click", () => window.open(cfg.lifetimeWhop, "_blank"));

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const mb = (file.size / (1024 * 1024)).toFixed(2);
  fileInfo.textContent = `Selected: ${file.name} (${mb} MB)`;

  const reader = new FileReader();
  reader.onload = () => {
    const existing = transcriptEl.value.trim();
    const block =
      `[Upload] ${new Date().toLocaleString()}\n` +
      `File loaded: ${file.name}\n` +
      `Type: ${file.type || "unknown"}\n` +
      `Size: ${mb} MB\n\n`;
    transcriptEl.value = existing ? `${existing}\n\n${block}` : block;
  };
  reader.readAsArrayBuffer(file);

  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.src = URL.createObjectURL(file);
  audio.onloadedmetadata = () => {
    uploadedDurationSeconds = Number(audio.duration || 0);
    URL.revokeObjectURL(audio.src);
    if (uploadedDurationSeconds > cfg.freeDailySeconds) {
      openPricing("Free tier allows 20 minutes per day. Upgrade to Lifetime Pro to continue.");
    }
  };
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognitionListening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += t + " ";
    }
    const base = transcriptEl.value.trimEnd();
    const next = `${base}\n${finalText ? `[Voice] ${finalText.trim()}` : ""}`.trim();
    transcriptEl.value = next ? `${next}\n` : "";
  };

  recognition.onstart = () => {
    recognitionListening = true;
    if (transcribeBtn) transcribeBtn.disabled = true;
  };

  recognition.onend = () => {
    recognitionListening = false;
    if (transcribeBtn) transcribeBtn.disabled = false;
  };

  recognition.onerror = () => {
    recognitionListening = false;
    if (transcribeBtn) transcribeBtn.disabled = false;
  };
} else {
  if (fileInfo) fileInfo.textContent = "Web Speech API not supported in this browser.";
}

transcribeBtn?.addEventListener("click", () => {
  // Browsers cannot transcribe uploaded audio offline; this button uses the mic (Web Speech API).
  if (!recognition) {
    openPricing("This browser doesn’t support web transcription. Use Sonara Desktop for offline audio transcription.");
    return;
  }
  // Do not gate mic transcription on uploaded file duration — upload limits are handled on file select only.
  if (recognitionListening) {
    try {
      recognition.stop();
    } catch (_) {}
    return;
  }
  try {
    recognition.start();
  } catch (err) {
    try {
      recognition.stop();
    } catch (_) {}
    setTimeout(() => {
      try {
        recognition.start();
      } catch (_) {
        openPricing("Could not start microphone transcription. Check mic permission and try again.");
      }
    }, 150);
  }
});

clearBtn.addEventListener("click", () => {
  transcriptEl.value = "";
});

exportBtn.addEventListener("click", () => {
  const text = transcriptEl.value.trim();
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sonara_web_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

async function loadConfig() {
  try {
    const res = await fetch("./pricing.config.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      cfg = { ...defaultConfig, ...data };
    }
  } catch (_) {}
  lifetimePriceLabel.textContent = `$${cfg.lifetimePrice} one-time`;
}

loadConfig();
