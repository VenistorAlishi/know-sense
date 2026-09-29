#!/usr/bin/env bash
# Download EmbeddingGemma ONNX into a flat dir + patch mempalace loader.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/services/palace"
MODEL_DIR="${MEMPALACE_EMBEDDINGGEMMA_DIR:-$ROOT/data/palace/models/embeddinggemma}"
export PATH="${HOME}/.local/bin:/usr/local/bin:/usr/bin:${PATH}"

if [[ "$ROOT" == /mnt/* ]]; then
  echo "WARN: project is on a Windows mount ($ROOT)."
  echo "      Python venvs on /mnt/c are often broken. Prefer:"
  echo "        cp -a /mnt/c/Users/KIRILL/know-sense ~/know-sense && cd ~/know-sense"
fi

ensure_venv() {
  if [[ ! -x "$DIR/.venv/bin/python" ]]; then
    echo "==> Creating palace venv…"
    if command -v uv >/dev/null 2>&1; then
      uv venv "$DIR/.venv"
    else
      python3 -m venv "$DIR/.venv"
    fi
  fi
}

venv_has_mempalace() {
  "$DIR/.venv/bin/python" - <<'PY' 2>/dev/null
import importlib.util
import sys
sys.exit(0 if importlib.util.find_spec("mempalace.embedding") else 1)
PY
}

install_reqs() {
  echo "==> Installing palace requirements (mempalace, fastapi, …)…"
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python "$DIR/.venv/bin/python" -r "$DIR/requirements.txt"
  else
    "$DIR/.venv/bin/pip" install --upgrade pip
    "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
  fi
}

ensure_venv

if ! venv_has_mempalace; then
  echo "==> mempalace missing in venv — (re)installing requirements"
  # Broken partial venv on /mnt/c: recreate
  if [[ "$ROOT" == /mnt/* ]] && [[ -d "$DIR/.venv" ]]; then
    echo "==> Recreating venv on Windows mount (previous one looked incomplete)…"
    rm -rf "$DIR/.venv"
    ensure_venv
  fi
  install_reqs
fi

if ! venv_has_mempalace; then
  echo "ERROR: mempalace still not importable after pip install." >&2
  echo "  Try moving the repo to the Linux filesystem:" >&2
  echo "    rsync -a --exclude node_modules --exclude .git /mnt/c/Users/KIRILL/know-sense/ ~/know-sense/" >&2
  echo "    cd ~/know-sense && rm -rf services/palace/.venv && npm run setup:embed" >&2
  exit 1
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
