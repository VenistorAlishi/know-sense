#!/usr/bin/env bash
# Download EmbeddingGemma ONNX into a flat dir + patch mempalace loader.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/services/palace"
MODEL_DIR="${MEMPALACE_EMBEDDINGGEMMA_DIR:-$ROOT/data/palace/models/embeddinggemma}"
export PATH="${HOME}/.local/bin:${PATH}"

if [[ ! -x "$DIR/.venv/bin/python" ]]; then
  if command -v uv >/dev/null 2>&1; then
    uv venv "$DIR/.venv"
    uv pip install --python "$DIR/.venv/bin/python" -r "$DIR/requirements.txt"
  else
    python3 -m venv "$DIR/.venv"
    "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
  fi
fi

PY="$DIR/.venv/bin/python"
"$PY" "$DIR/patches/embeddinggemma_local_dir.patch.py"

if [[ -f "$MODEL_DIR/onnx/model_quantized.onnx" && -f "$MODEL_DIR/tokenizer.json" ]]; then
  echo "EmbeddingGemma already at $MODEL_DIR"
  exit 0
fi

echo "==> Downloading EmbeddingGemma → $MODEL_DIR"
"$PY" - <<PY
from pathlib import Path
from huggingface_hub import snapshot_download
dest = Path("$MODEL_DIR")
dest.mkdir(parents=True, exist_ok=True)
snapshot_download(
    "onnx-community/embeddinggemma-300m-ONNX",
    local_dir=str(dest),
    allow_patterns=[
        "onnx/model_quantized.onnx",
        "onnx/model_quantized.onnx_data",
        "tokenizer.json",
        "tokenizer_config.json",
        "config.json",
    ],
)
print("ok", dest)
PY
