#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
export SMYSL_ROOT="$ROOT"
export PALACE_DIR="${PALACE_DIR:-$ROOT/data/palace}"
export PALACE_INBOX="${PALACE_INBOX:-$PALACE_DIR/inbox}"
export MEMPALACE_BIN="${MEMPALACE_BIN:-$DIR/.venv/bin/mempalace}"
# Multilingual embeddings (incl. Russian). MiniLM is English-only.
export MEMPALACE_EMBEDDING_MODEL="${MEMPALACE_EMBEDDING_MODEL:-embeddinggemma}"
export MEMPALACE_CONFIG_DIR="${MEMPALACE_CONFIG_DIR:-$PALACE_DIR/config}"
export MEMPALACE_LANG="${MEMPALACE_LANG:-ru}"
export MEMPALACE_ENTITY_LANGUAGES="${MEMPALACE_ENTITY_LANGUAGES:-ru,en}"
export MEMPALACE_EMBEDDINGGEMMA_DIR="${MEMPALACE_EMBEDDINGGEMMA_DIR:-$PALACE_DIR/models/embeddinggemma}"
mkdir -p "$MEMPALACE_CONFIG_DIR"

# Ensure venv + flat EmbeddingGemma ONNX (avoids ORT symlink bug)
bash "$ROOT/scripts/ensure-embeddinggemma.sh"

# Persist embedding choice for CLI/search parity with this process
python3 - <<PY
import json
from pathlib import Path
p = Path("$MEMPALACE_CONFIG_DIR") / "config.json"
data = {}
if p.exists():
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        data = {}
model = "$MEMPALACE_EMBEDDING_MODEL"
if data.get("embedding_model") != model or data.get("lang") != "$MEMPALACE_LANG":
    data["embedding_model"] = model
    data["lang"] = "$MEMPALACE_LANG"
    data["entity_languages"] = [s for s in "$MEMPALACE_ENTITY_LANGUAGES".split(",") if s]
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

mkdir -p "$PALACE_DIR" "$PALACE_INBOX"
exec "$DIR/.venv/bin/uvicorn" app:app --app-dir "$DIR" --host 127.0.0.1 --port "${PALACE_PORT:-3851}"
