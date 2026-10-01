# Смысл — domain glossary

Ubiquitous language for agents (see skill `domain-modeling`).

| Term | Meaning |
|---|---|
| **Смысл** | This product / repo: personal vector knowledge base for Kirill |
| **Self** | Person node for Кирилл (`isSelf`, `relationToSelf: self`) |
| **Close** | High-trust peer (`relationToSelf: close`), e.g. personal TG chats |
| **Source** | Ingested corpus unit (TG chat, note, meeting, file) |
| **Chunk** | Searchable text window or media_ref / future transcript |
| **Attachment** | Binary/media from TG export with optional derivedText |
| **Fact** | Distilled claim with status + evidence chunk ids |
| **Palace** | MemPalace sidecar drawers for verbatim recall |
| **Jarvis** | Primary HUD at `/jarvis` (map + command bar) |
| **ChatExport** | Telegram Desktop JSON export folder (`result.json` + media dirs) |
| **deriveStatus** | Pipeline state for ASR/OCR on an Attachment |
| **Connector** | Live integration (calendar, mail, drive, voice) with tokens + sync jobs |

## Non-goals (for now)

- Multi-tenant auth
- Full multimodal embedding of raw video bytes
- Cloud-only LLM requirement (Ollama / extractive fallback OK)
- Replacing Obsidian as a writing vault (coexist / import later)
