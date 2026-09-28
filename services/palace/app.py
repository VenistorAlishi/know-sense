"""
Thin HTTP bridge around MemPalace for Смысл.

Endpoints:
  GET  /health
  GET  /wings
  POST /mine
  POST /search
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(os.environ.get("SMYSL_ROOT", Path(__file__).resolve().parents[2]))
PALACE_DIR = Path(os.environ.get("PALACE_DIR", ROOT / "data" / "palace"))
INBOX_DIR = Path(os.environ.get("PALACE_INBOX", PALACE_DIR / "inbox"))
MEMPALACE_BIN = os.environ.get(
    "MEMPALACE_BIN",
    str(Path(__file__).resolve().parent / ".venv" / "bin" / "mempalace"),
)

_lock = threading.Lock()
_inited = False

app = FastAPI(title="Смысл Palace Bridge", version="0.1.0")


class MineText(BaseModel):
    id: str
    title: str = ""
    body: str
    meta: dict[str, Any] = Field(default_factory=dict)


class MineRequest(BaseModel):
    wing: str
    texts: list[MineText]
    room: str = "general"


class SearchRequest(BaseModel):
    query: str
    wing: str | None = None
    limit: int = 8


def _run(args: list[str], input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("TOKENIZERS_PARALLELISM", "false")
    return subprocess.run(
        args,
        input=input_text,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )


def ensure_palace() -> None:
    global _inited
    with _lock:
        if _inited and (PALACE_DIR / "chroma.sqlite3").exists():
            return
        PALACE_DIR.mkdir(parents=True, exist_ok=True)
        INBOX_DIR.mkdir(parents=True, exist_ok=True)
        seed = PALACE_DIR / "seed"
        seed.mkdir(parents=True, exist_ok=True)
        readme = seed / "README.md"
        if not readme.exists():
            readme.write_text(
                "# Смысл palace seed\nPersonal memory store for Kirill.\n",
                encoding="utf-8",
            )
        if not (PALACE_DIR / ".mempalace").exists() and not (PALACE_DIR / "chroma.sqlite3").exists():
            proc = _run(
                [
                    MEMPALACE_BIN,
                    "--palace",
                    str(PALACE_DIR),
                    "init",
                    str(seed),
                    "--yes",
                    "--no-llm",
                ],
                input_text="n\n",
            )
            if proc.returncode != 0:
                raise RuntimeError(
                    f"mempalace init failed: {proc.stderr or proc.stdout}"
                )
        _inited = True


def slug_wing(name: str) -> str:
    raw = name.strip().lower()
    table = str.maketrans(
        {
            "а": "a",
            "б": "b",
            "в": "v",
            "г": "g",
            "д": "d",
            "е": "e",
            "ё": "e",
            "ж": "zh",
            "з": "z",
            "и": "i",
            "й": "y",
            "к": "k",
            "л": "l",
            "м": "m",
            "н": "n",
            "о": "o",
            "п": "p",
            "р": "r",
            "с": "s",
            "т": "t",
            "у": "u",
            "ф": "f",
            "х": "h",
            "ц": "ts",
            "ч": "ch",
            "ш": "sh",
            "щ": "sch",
            "ъ": "",
            "ы": "y",
            "ь": "",
            "э": "e",
            "ю": "yu",
            "я": "ya",
        }
    )
    translit = raw.translate(table)
    slug = re.sub(r"[^a-z0-9]+", "-", translit).strip("-")
    return slug or "wing"


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^\w.\-]+", "_", value, flags=re.UNICODE)
    return cleaned[:100] or "chunk"


@app.on_event("startup")
def _startup() -> None:
    try:
        ensure_palace()
    except Exception as exc:  # noqa: BLE001
        # Keep server up; /health will report the error.
        app.state.startup_error = str(exc)
    else:
        app.state.startup_error = None


@app.get("/health")
def health() -> dict[str, Any]:
    err = getattr(app.state, "startup_error", None)
    embedding_model = os.environ.get("MEMPALACE_EMBEDDING_MODEL", "embeddinggemma")
    try:
        ensure_palace()
        drawers = 0
        status = _run([MEMPALACE_BIN, "--palace", str(PALACE_DIR), "status"])
        m = re.search(r"(\d+)\s+drawers", status.stdout or "")
        if m:
            drawers = int(m.group(1))
        return {
            "ok": err is None and status.returncode == 0,
            "palaceDir": str(PALACE_DIR),
            "inboxDir": str(INBOX_DIR),
            "drawers": drawers,
            "embeddingModel": embedding_model,
            "error": err,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "palaceDir": str(PALACE_DIR),
            "inboxDir": str(INBOX_DIR),
            "drawers": 0,
            "embeddingModel": embedding_model,
            "error": str(exc),
        }


@app.get("/wings")
def wings() -> dict[str, Any]:
    ensure_palace()
    status = _run([MEMPALACE_BIN, "--palace", str(PALACE_DIR), "status"])
    names: list[str] = []
    for line in (status.stdout or "").splitlines():
        m = re.match(r"\s*WING:\s*(\S+)", line)
        if m:
            names.append(m.group(1))
    # also list inbox folders
    if INBOX_DIR.exists():
        for p in INBOX_DIR.iterdir():
            if p.is_dir() and p.name not in names:
                names.append(p.name)
    return {"wings": names, "rawStatus": status.stdout}


@app.post("/mine")
def mine(req: MineRequest) -> dict[str, Any]:
    ensure_palace()
    if not req.texts:
        raise HTTPException(400, "texts required")
    wing = slug_wing(req.wing)
    target = INBOX_DIR / wing / (req.room or "general")
    target.mkdir(parents=True, exist_ok=True)

    written: list[str] = []
    with _lock:
        for item in req.texts:
            fname = safe_filename(item.id or item.title) + ".md"
            path = target / fname
            meta_block = ""
            if item.meta:
                meta_block = "\n\n<!-- meta: " + json.dumps(item.meta, ensure_ascii=False) + " -->\n"
            title = item.title or item.id
            body = item.body.strip()
            path.write_text(f"# {title}\n\n{body}{meta_block}\n", encoding="utf-8")
            written.append(str(path))

        proc = _run(
            [
                MEMPALACE_BIN,
                "--palace",
                str(PALACE_DIR),
                "mine",
                str(target),
                "--wing",
                wing,
                "--mode",
                "projects",
                "--agent",
                "smysl",
            ]
        )

    if proc.returncode != 0:
        raise HTTPException(
            500,
            detail={
                "error": "mine failed",
                "stdout": proc.stdout,
                "stderr": proc.stderr,
            },
        )

    filed = 0
    m = re.search(r"Drawers filed:\s*(\d+)", proc.stdout or "")
    if m:
        filed = int(m.group(1))

    return {
        "ok": True,
        "wing": wing,
        "files": written,
        "drawersFiled": filed,
        "stdout": proc.stdout[-2000:] if proc.stdout else "",
    }


@app.post("/search")
def search(req: SearchRequest) -> dict[str, Any]:
    ensure_palace()
    if not req.query.strip():
        raise HTTPException(400, "query required")

    from mempalace.searcher import search_memories

    wing = slug_wing(req.wing) if req.wing else None
    try:
        raw = search_memories(
            query=req.query.strip(),
            palace_path=str(PALACE_DIR),
            wing=wing,
            n_results=max(1, min(req.limit, 20)),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"search failed: {exc}") from exc

    results = []
    for hit in raw.get("results") or []:
        results.append(
            {
                "text": hit.get("text") or "",
                "score": float(hit.get("similarity") or 0),
                "wing": hit.get("wing"),
                "room": hit.get("room"),
                "sourceFile": hit.get("source_file"),
                "sourcePath": hit.get("source_path"),
                "drawerId": hit.get("drawer_id"),
                "meta": {
                    "filedAt": hit.get("filed_at"),
                    "matchedVia": hit.get("matched_via"),
                },
            }
        )
    return {"query": req.query, "wing": wing, "results": results}


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "smysl-palace-bridge", "docs": "/docs"}
