"""
Idempotent patch for mempalace.embedding.EmbeddinggemmaONNX._lazy_load.

Newer onnxruntime rejects HF hub blob/symlink layouts where
model_quantized.onnx_data resolves outside the .onnx directory.
This adds MEMPALACE_EMBEDDINGGEMMA_DIR / flat local_dir download support.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


MARKER = "MEMPALACE_EMBEDDINGGEMMA_DIR"


def find_embedding_py() -> Path:
    spec = importlib.util.find_spec("mempalace.embedding")
    if spec is None or not spec.origin:
        raise SystemExit(
            "mempalace.embedding not installed in this Python.\n"
            "  Fix: rm -rf services/palace/.venv && npm run setup:embed\n"
            "  If the project lives under /mnt/c/..., copy it to ~/know-sense first "
            "(venvs on Windows mounts often break)."
        )
    return Path(spec.origin)


def apply() -> None:
    path = find_embedding_py()
    text = path.read_text(encoding="utf-8")
    if MARKER in text and "local_dir=str(cache_root)" in text:
        print(f"already patched: {path}")
        return

    old = '''            logger.info(
                "Downloading %s/%s (cached after first run)…",
                _EMBEDDINGGEMMA_REPO,
                _EMBEDDINGGEMMA_ONNX,
            )
            model_path = hf_hub_download(
                _EMBEDDINGGEMMA_REPO, subfolder="onnx", filename=_EMBEDDINGGEMMA_ONNX
            )
            hf_hub_download(
                _EMBEDDINGGEMMA_REPO, subfolder="onnx", filename=_EMBEDDINGGEMMA_ONNX + "_data"
            )
            tok_path = hf_hub_download(_EMBEDDINGGEMMA_REPO, filename="tokenizer.json")

            session = ort.InferenceSession(
                model_path,'''

    new = '''            # Prefer a flat local directory (real files side-by-side). Newer
            # onnxruntime rejects HF hub blob/symlink layouts where
            # model_quantized.onnx_data resolves outside the model directory.
            local_dir = os.environ.get("MEMPALACE_EMBEDDINGGEMMA_DIR", "").strip()
            model_path = None
            tok_path = None
            if local_dir:
                from pathlib import Path as _Path

                cand = _Path(local_dir)
                onnx_cand = cand / "onnx" / _EMBEDDINGGEMMA_ONNX
                tok_cand = cand / "tokenizer.json"
                if onnx_cand.is_file() and tok_cand.is_file():
                    model_path = str(onnx_cand)
                    tok_path = str(tok_cand)
                    logger.info("Using local EmbeddingGemma at %s", cand)

            if model_path is None:
                logger.info(
                    "Downloading %s/%s (cached after first run)…",
                    _EMBEDDINGGEMMA_REPO,
                    _EMBEDDINGGEMMA_ONNX,
                )
                # Download into a flat local_dir so onnx + onnx_data sit together.
                from pathlib import Path as _Path

                cache_root = _Path(
                    os.environ.get(
                        "MEMPALACE_EMBEDDINGGEMMA_CACHE",
                        str(_Path.home() / ".cache" / "mempalace" / "embeddinggemma"),
                    )
                )
                cache_root.mkdir(parents=True, exist_ok=True)
                model_path = hf_hub_download(
                    _EMBEDDINGGEMMA_REPO,
                    subfolder="onnx",
                    filename=_EMBEDDINGGEMMA_ONNX,
                    local_dir=str(cache_root),
                )
                hf_hub_download(
                    _EMBEDDINGGEMMA_REPO,
                    subfolder="onnx",
                    filename=_EMBEDDINGGEMMA_ONNX + "_data",
                    local_dir=str(cache_root),
                )
                tok_path = hf_hub_download(
                    _EMBEDDINGGEMMA_REPO,
                    filename="tokenizer.json",
                    local_dir=str(cache_root),
                )

            session = ort.InferenceSession(
                model_path,'''

    if old not in text:
        if MARKER in text:
            print(f"partially patched already: {path}")
            return
        raise SystemExit(f"patch target not found in {path} — mempalace version changed?")

    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {path}")


if __name__ == "__main__":
    apply()
    sys.exit(0)
