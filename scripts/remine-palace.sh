#!/usr/bin/env bash
# Wipe Chroma index and re-mine inbox with current MEMPALACE_EMBEDDING_MODEL.
# Keeps inbox markdown; rebuilds drawers in the new embedding space.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PALACE_DIR="${PALACE_DIR:-$ROOT/data/palace}"
INBOX="${PALACE_INBOX:-$PALACE_DIR/inbox}"
MEMPALACE_BIN="${MEMPALACE_BIN:-$ROOT/services/palace/.venv/bin/mempalace}"
export MEMPALACE_EMBEDDING_MODEL="${MEMPALACE_EMBEDDING_MODEL:-embeddinggemma}"
export MEMPALACE_CONFIG_DIR="${MEMPALACE_CONFIG_DIR:-$PALACE_DIR/config}"
export MEMPALACE_LANG="${MEMPALACE_LANG:-ru}"
export MEMPALACE_ENTITY_LANGUAGES="${MEMPALACE_ENTITY_LANGUAGES:-ru,en}"
export MEMPALACE_EMBEDDINGGEMMA_DIR="${MEMPALACE_EMBEDDINGGEMMA_DIR:-$PALACE_DIR/models/embeddinggemma}"
export PATH="${HOME}/.local/bin:${PATH}"

mkdir -p "$MEMPALACE_CONFIG_DIR" "$INBOX"
bash "$ROOT/scripts/ensure-embeddinggemma.sh"

# Persist model choice so CLI/search agree with bridge
python3 - <<'PY'
import json, os
from pathlib import Path
cfg_dir = Path(os.environ["MEMPALACE_CONFIG_DIR"])
cfg_dir.mkdir(parents=True, exist_ok=True)
path = cfg_dir / "config.json"
data = {}
if path.exists():
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {}
data["embedding_model"] = os.environ.get("MEMPALACE_EMBEDDING_MODEL", "embeddinggemma")
data["lang"] = os.environ.get("MEMPALACE_LANG", "ru")
langs = [s.strip() for s in os.environ.get("MEMPALACE_ENTITY_LANGUAGES", "ru,en").split(",") if s.strip()]
data["entity_languages"] = langs or ["ru", "en"]
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {path}: embedding_model={data['embedding_model']}")
PY

echo "==> Stopping palace bridge if running..."
pkill -f "uvicorn app:app --app-dir .*services/palace" 2>/dev/null || true
sleep 1

echo "==> Clearing Chroma index (keeping inbox)..."
# Keep inbox + seed; remove vector store + embedder marker + chroma dirs
find "$PALACE_DIR" -maxdepth 1 -type f \( -name 'chroma.sqlite3*' -o -name 'mempalace_embedder.json' \) -delete
find "$PALACE_DIR" -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9a-f-]{36}' -exec rm -rf {} + 2>/dev/null || true
rm -rf "$PALACE_DIR/.mempalace" 2>/dev/null || true

# Clear mine registries so files are not skipped as already-filed
find "$INBOX" -name '_reg_*' -delete 2>/dev/null || true
find "$PALACE_DIR" -name '_reg_*' -delete 2>/dev/null || true

SEED="$PALACE_DIR/seed"
mkdir -p "$SEED"
[[ -f "$SEED/README.md" ]] || echo -e "# Смысл palace seed\n" > "$SEED/README.md"

echo "==> Init palace with $MEMPALACE_EMBEDDING_MODEL..."
printf 'n\n' | "$MEMPALACE_BIN" --palace "$PALACE_DIR" init "$SEED" --yes --no-llm

echo "==> Mining inbox wings..."
if [[ -d "$INBOX" ]]; then
  for wing_dir in "$INBOX"/*/; do
    [[ -d "$wing_dir" ]] || continue
    wing="$(basename "$wing_dir")"
    echo "  mine wing=$wing"
    "$MEMPALACE_BIN" --palace "$PALACE_DIR" mine "$wing_dir" \
      --wing "$wing" --mode projects --agent smysl || true
  done
fi

echo "==> Status:"
"$MEMPALACE_BIN" --palace "$PALACE_DIR" status || true
echo "Done. Restart with: npm run palace"
