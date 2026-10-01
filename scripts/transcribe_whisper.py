#!/usr/bin/env python3
"""Local ASR helper: faster-whisper if installed, else exit 1."""
from __future__ import annotations

import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: transcribe_whisper.py <audio-file>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "faster-whisper not installed. pip install faster-whisper",
            file=sys.stderr,
        )
        return 1

    model_size = __import__("os").environ.get("WHISPER_MODEL", "base")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(path, language="ru")
    text = " ".join(seg.text.strip() for seg in segments).strip()
    if not text:
        return 1
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
