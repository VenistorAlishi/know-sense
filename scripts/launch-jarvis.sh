#!/usr/bin/env bash
# One-click launcher: start Next+palace if needed, then open Jarvis.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Resolve common tool paths (nvm / cargo) when launched from a .desktop file
export PATH="${HOME}/.cargo/bin:/usr/local/cargo/bin:/usr/local/bin:${PATH}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
# Fallback: pick newest nvm node bin if present
if ! command -v node >/dev/null 2>&1; then
  NVM_NODE="$(ls -1d "${HOME}/.nvm/versions/node"/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
  [[ -n "${NVM_NODE}" ]] && export PATH="${NVM_NODE}:${PATH}"
fi

cd "$ROOT"
JARVIS_URL="http://127.0.0.1:3847/jarvis"
LOG_DIR="${TMPDIR:-/tmp}/smysl-launch"
mkdir -p "$LOG_DIR"

is_up() {
  curl -sf --max-time 2 "$1" >/dev/null 2>&1
}

start_stack() {
  if is_up "$JARVIS_URL" || is_up "http://127.0.0.1:3847/"; then
    return 0
  fi
  echo "Starting Смысл (Next + palace)…"
  nohup bash "$ROOT/scripts/dev-all.sh" >"$LOG_DIR/dev-all.log" 2>&1 &
  echo $! >"$LOG_DIR/dev-all.pid"
  for _ in $(seq 1 90); do
    if is_up "$JARVIS_URL" || is_up "http://127.0.0.1:3847/"; then
      echo "Stack ready."
      return 0
    fi
    sleep 1
  done
  echo "WARN: Next did not become ready. See $LOG_DIR/dev-all.log" >&2
}

open_native_or_browser() {
  # Prefer a previously built Tauri binary (instant native window)
  local bin=""
  for cand in \
    "$ROOT/desktop/src-tauri/target/release/smysl" \
    "$ROOT/desktop/src-tauri/target/release/smysl-desktop" \
    "$ROOT/desktop/src-tauri/target/debug/smysl" \
    "$ROOT/desktop/src-tauri/target/debug/smysl-desktop"; do
    if [[ -x "$cand" ]]; then
      bin="$cand"
      break
    fi
  done
  # Discover binary name from Cargo.toml if needed
  if [[ -z "$bin" ]]; then
    local name
    name="$(grep -E '^name\s*=' "$ROOT/desktop/src-tauri/Cargo.toml" 2>/dev/null | head -1 | sed -E 's/.*"([^"]+)".*/\1/' || true)"
    if [[ -n "$name" ]]; then
      for cand in \
        "$ROOT/desktop/src-tauri/target/release/$name" \
        "$ROOT/desktop/src-tauri/target/debug/$name"; do
        if [[ -x "$cand" ]]; then
          bin="$cand"
          break
        fi
      done
    fi
  fi

  if [[ -n "$bin" ]]; then
    echo "Opening native window: $bin"
    exec "$bin"
  fi

  echo "Opening browser → $JARVIS_URL"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$JARVIS_URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$JARVIS_URL" || true
  else
    echo "$JARVIS_URL"
  fi
}

start_stack
open_native_or_browser
