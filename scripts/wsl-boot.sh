#!/usr/bin/env bash
# Boot Смысл inside WSL for the Windows desktop shortcut.
# Must stay in the foreground so WSL does not tear down the session.
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1; then
  NVM_NODE="$(ls -1d "${HOME}/.nvm/versions/node"/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
  [[ -n "${NVM_NODE}" ]] && export PATH="${NVM_NODE}:${PATH}"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="${TMPDIR:-/tmp}/smysl-launch"
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/wsl-boot.log") 2>&1

echo "[$(date -Iseconds)] wsl-boot root=$ROOT"
echo "[$(date -Iseconds)] node=$(command -v node || echo MISSING) npm=$(command -v npm || echo MISSING)"

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found in WSL PATH. Install Node inside Ubuntu, then retry."
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  sleep 30
  exit 1
fi

# Already up?
if curl -sf --max-time 2 "http://127.0.0.1:3847/jarvis" >/dev/null 2>&1 \
  || curl -sf --max-time 2 "http://127.0.0.1:3847/" >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] stack already up — keeping session alive"
  # Keep WSL awake while user uses the app from Windows browser
  while curl -sf --max-time 2 "http://127.0.0.1:3847/" >/dev/null 2>&1; do
    sleep 30
  done
  echo "[$(date -Iseconds)] stack went down — restarting"
fi

echo "[$(date -Iseconds)] ensuring palace venv + embeddinggemma…"
if ! bash "$ROOT/scripts/ensure-embeddinggemma.sh"; then
  echo "[$(date -Iseconds)] ensure failed — running full repair-wsl.sh…"
  if ! bash "$ROOT/scripts/repair-wsl.sh"; then
    echo "ERROR: repair failed. See messages above."
    echo "Fallback: copy repo off /mnt/c into Linux home:"
    echo "  rsync -a --exclude node_modules --exclude services/palace/.venv '$ROOT/' \"\$HOME/know-sense/\""
    echo "  cd \"\$HOME/know-sense\" && bash scripts/repair-wsl.sh && npm run jarvis"
    sleep 90
    exit 1
  fi
fi

echo "[$(date -Iseconds)] starting npm run dev:all"
exec npm run dev:all
