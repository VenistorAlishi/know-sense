# Смысл Desktop (Tauri 2)

Нативное окно вокруг Next.js Jarvis (`/jarvis`).

## Требования

- Node 20+
- Rust (`rustup`)
- Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`

## Dev

Из корня репозитория:

```bash
npm run dev:all       # Next :3847 + palace
npm run desktop:dev   # Tauri → http://127.0.0.1:3847/jarvis
```

Или из этой папки: `npm install && npm run dev`.

## Build

```bash
npm run desktop:build
```

Бинарник ожидает, что Next доступен на `127.0.0.1:3847` (см. `dist/index.html` redirect).
