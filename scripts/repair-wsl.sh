#!/usr/bin/env bash
# One-shot repair for WSL installs (esp. project under /mnt/c/...).
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH}"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Repair Смысл at $ROOT"
echo "    node=$(command -v node || echo MISSING) npm=$(command -v npm || echo MISSING)"

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm missing in WSL. Install Node first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3 python3-pip python3-venv
fi

# python3-venv package on Debian/Ubuntu
if ! python3 -c "import venv" 2>/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3-venv "python3$(python3 -c 'import sys; print(f\"{sys.version_info.major}.{sys.version_info.minor}\")')-venv" || \
    sudo apt-get install -y -qq python3-venv
fi

echo "==> npm install"
npm install

echo "==> Recreate palace venv (clean)"
rm -rf "$ROOT/services/palace/.venv"

echo "==> setup:embed (mempalace + EmbeddingGemma)"
bash "$ROOT/scripts/ensure-embeddinggemma.sh"

echo "==> Verify imports"
"$ROOT/services/palace/.venv/bin/python" - <<'PY'
import mempalace
import mempalace.embedding
print("mempalace OK:", mempalace.__file__)
PY

echo
echo "OK. Start with:"
echo "  npm run jarvis"
echo "Then open http://127.0.0.1:3847/jarvis in Windows browser."
