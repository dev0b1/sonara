#!/usr/bin/env python3
import os
import sys
import json
import argparse
from faster_whisper import WhisperModel
import soundfile as sf

from python.stt_engine import group_segments_by_5min, format_timestamp


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--file", required=True, help="Path to audio file")
    p.add_argument("--model", default=os.getenv("MODEL_SIZE", "base"))
    args = p.parse_args()
    path = args.file
    model_size = args.model

    # ensure HF token if present
    hf_token = os.getenv("HF_TOKEN")
    if hf_token:
        os.environ["HF_TOKEN"] = hf_token
        os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception as e:
        print(json.dumps({"error": f"failed to load model: {e}"}))
        sys.exit(2)

    try:
        raw_segments, info = model.transcribe(path, beam_size=5, word_timestamps=False)
    except Exception as e:
        print(json.dumps({"error": f"transcription error: {e}"}))
        sys.exit(3)

    segments = []
    for seg in raw_segments:
        segments.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
        })

    total_duration = info.duration if hasattr(info, "duration") else None
    grouped = group_segments_by_5min(segments)

    out = {
        "blocks": grouped,
        "duration": total_duration,
        "language": getattr(info, "language", None),
    }

    print(json.dumps(out))


if __name__ == "__main__":
    main()
