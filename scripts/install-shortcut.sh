#!/usr/bin/env bash
# Install desktop shortcut for Смысл Jarvis (Linux .desktop + optional Desktop link).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON_SRC="$ROOT/desktop/src-tauri/icons/128x128.png"
ICON_DST="${XDG_DATA_HOME:-$HOME/.local/share}/icons/smysl-jarvis.png"
DESKTOP_FILE="$APP_DIR/smysl-jarvis.desktop"

mkdir -p "$APP_DIR" "$(dirname "$ICON_DST")"
cp -f "$ICON_SRC" "$ICON_DST"
chmod +x "$ROOT/scripts/launch-jarvis.sh"

cat >"$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Смысл Jarvis
Name[en]=Smysl Jarvis
Comment=Персональный второй мозг — карта памяти и чат
Comment[en]=Personal second brain — memory map and chat
Exec=$ROOT/scripts/launch-jarvis.sh
Icon=$ICON_DST
Terminal=false
Categories=Office;
StartupNotify=true
Keywords=smysl;jarvis;memory;knowledge;
EOF

chmod +x "$DESKTOP_FILE"

# Place on Desktop (create folder if missing)
DESK="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
if [[ -z "$DESK" || "$DESK" == "$HOME" ]]; then
  DESK="$HOME/Desktop"
fi
mkdir -p "$DESK"
cp -f "$DESKTOP_FILE" "$DESK/Смысл Jarvis.desktop"
chmod +x "$DESK/Смысл Jarvis.desktop"
# Mark trusted so GNOME/XFCE allow double-click without "Untrusted" dialog
if command -v gio >/dev/null 2>&1; then
  gio set "$DESK/Смысл Jarvis.desktop" metadata::trusted true 2>/dev/null || true
fi
# Some DEs also look at executable bit + allow-launch flag
chmod u+x "$DESK/Смысл Jarvis.desktop"
echo "Desktop shortcut: $DESK/Смысл Jarvis.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" 2>/dev/null || true
fi

echo "Installed: $DESKTOP_FILE"
echo "Launch: applications menu → «Смысл Jarvis» or: npm run jarvis"
