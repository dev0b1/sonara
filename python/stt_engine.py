import sounddevice as sd
import numpy as np
import threading
import os
import tempfile
from faster_whisper import WhisperModel
import soundfile as sf

SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = "float32"


def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def group_segments_by_5min(segments):
    """
    Groups transcript segments into 5-minute blocks.
    Returns list of dicts: {range_label, text}
    """
    blocks = {}
    for seg in segments:
        block_index = int(seg["start"] // 300)  # 300 seconds = 5 min
        block_start = block_index * 300
        block_end = block_start + 300
        label = f"{format_timestamp(block_start)} - {format_timestamp(block_end)}"
        if label not in blocks:
            blocks[label] = []
        blocks[label].append(seg["text"])

    return [{"range": label, "text": " ".join(texts)} for label, texts in blocks.items()]


class STTEngine:
    def __init__(self, model_size="base", on_result=None, on_status=None, on_progress=None, on_ready=None):
        self.on_result = on_result
        self.on_status = on_status
        self.on_progress = on_progress
        self.on_ready = on_ready
        self.is_busy = False
        self.model = None
        self.model_size = model_size
        threading.Thread(target=self._load_model, daemon=True).start()

    def _load_model(self):
        if self.on_status:
            self.on_status("Loading Whisper model...")
        try:
            hf_token = os.getenv("HF_TOKEN")
            if hf_token:
                os.environ["HF_TOKEN"] = hf_token
                os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token

            self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            if self.on_status:
                self.on_status("Ready ✓")
            if self.on_ready:
                try:
                    self.on_ready()
                except Exception:
                    pass
        except Exception as e:
            if self.on_status:
                self.on_status(f"Model error: {e}")

    def start_mic_recording(self, duration=60):
        if self.is_busy:
            return
        self.is_busy = True
        threading.Thread(
            target=self._record_mic, args=(duration,), daemon=True
        ).start()

    def _record_mic(self, duration):
        try:
            if self.on_status:
                self.on_status(f"🔴 Recording {duration}s...")
            audio = sd.rec(
                int(duration * SAMPLE_RATE),
                samplerate=SAMPLE_RATE,
                channels=CHANNELS,
                dtype=DTYPE,
            )
            sd.wait()
            audio_np = np.squeeze(audio)
            self._transcribe_array(audio_np)
        except Exception as e:
            if self.on_status:
                self.on_status(f"Error: {e}")
        finally:
            self.is_busy = False

    def transcribe_file(self, file_path: str):
        if self.is_busy:
            return
        self.is_busy = True
        threading.Thread(
            target=self._transcribe_file_worker, args=(file_path,), daemon=True
        ).start()

    def _transcribe_file_worker(self, file_path: str):
        try:
            if self.on_status:
                self.on_status("Transcribing file...")
            hint_duration = None
            try:
                info = sf.info(file_path)
                hint_duration = float(info.frames) / float(info.samplerate)
            except Exception:
                hint_duration = None
            self._transcribe_path(file_path, hint_duration=hint_duration)
        except Exception as e:
            if self.on_status:
                self.on_status(f"Error: {e}")
            if self.on_result:
                self.on_result([], f"[Error: {e}]", 0)
        finally:
            self.is_busy = False

    def _transcribe_array(self, audio_np):
        if self.on_status:
            self.on_status("Transcribing...")
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        sf.write(tmp.name, audio_np, SAMPLE_RATE)
        self._transcribe_path(tmp.name, hint_duration=len(audio_np) / SAMPLE_RATE)
        os.unlink(tmp.name)

    def _transcribe_path(self, path: str, hint_duration: float = None):
        if not self.model:
            if self.on_status:
                self.on_status("Model not loaded yet, please wait...")
            if self.on_result:
                self.on_result([], "Model not loaded", 0)
            return

        if self.on_status:
            self.on_status("Transcribing with Whisper... 0%")

        transcribe_done = threading.Event()

        def _progress_simulator():
            elapsed = 0.0
            pct = 0.0
            interval = 0.5
            total_hint = hint_duration if hint_duration and hint_duration > 0 else 30.0
            while not transcribe_done.is_set():
                elapsed += interval
                pct = min(0.95, (elapsed / total_hint) * 0.9)
                if self.on_progress:
                    try:
                        self.on_progress(pct)
                    except Exception:
                        pass
                if self.on_status:
                    try:
                        percent_text = int(pct * 100)
                        self.on_status(f"Transcribing with Whisper... {percent_text}%")
                    except Exception:
                        pass
                transcribe_done.wait(interval)

        t = threading.Thread(target=_progress_simulator, daemon=True)
        t.start()

        raw_segments, info = self.model.transcribe(path, beam_size=5, word_timestamps=False)
        transcribe_done.set()

        if self.on_progress:
            try:
                self.on_progress(1.0)
            except Exception:
                pass

        segments = []
        for seg in raw_segments:
            segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            })

        total_duration = info.duration if hasattr(info, "duration") else 0
        grouped = group_segments_by_5min(segments)

        if self.on_status:
            self.on_status(f"Done  ·  Lang: {info.language}  ·  {format_timestamp(total_duration)}  ·  Segments: {len(segments)}")

        if self.on_result:
            self.on_result(grouped, None, total_duration)
