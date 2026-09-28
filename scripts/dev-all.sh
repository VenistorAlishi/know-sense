#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional: load local env (Next also reads .env.local)
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

export MEMPALACE_EMBEDDING_MODEL="${MEMPALACE_EMBEDDING_MODEL:-embeddinggemma}"
export LLM_MODEL="${LLM_MODEL:-${OLLAMA_MODEL:-qwen3.5:9b}}"

# Soft-start Ollama if installed (chat falls back to extractive if down)
if command -v ollama >/dev/null 2>&1; then
  if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
  fi
fi

bash services/palace/run.sh &
PALACE_PID=$!

cleanup() {
  kill "$PALACE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# wait for palace health (embeddinggemma first load can be slow)
for i in $(seq 1 120); do
  if curl -sf http://127.0.0.1:3851/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

npm run dev
