#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
export SMYSL_ROOT="$ROOT"
export PALACE_DIR="${PALACE_DIR:-$ROOT/data/palace}"
export PALACE_INBOX="${PALACE_INBOX:-$PALACE_DIR/inbox}"
export MEMPALACE_BIN="${MEMPALACE_BIN:-$DIR/.venv/bin/mempalace}"

if [[ ! -x "$DIR/.venv/bin/python" ]]; then
  if command -v uv >/dev/null 2>&1; then
    uv venv "$DIR/.venv"
    uv pip install --python "$DIR/.venv/bin/python" -r "$DIR/requirements.txt"
  else
    python3 -m venv "$DIR/.venv"
    "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
  fi
fi

mkdir -p "$PALACE_DIR" "$PALACE_INBOX"
exec "$DIR/.venv/bin/uvicorn" app:app --app-dir "$DIR" --host 127.0.0.1 --port "${PALACE_PORT:-3851}"
