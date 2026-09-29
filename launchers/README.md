# Ярлыки запуска Смысл

## Windows — ярлык на рабочий стол

1. Репо локально + Node **внутри WSL Ubuntu**.
2. PowerShell из корня репо:

```powershell
git pull origin main
powershell -ExecutionPolicy Bypass -File .\launchers\install-windows-shortcut.ps1
```

3. На Desktop: **Smysl Jarvis** — двойной клик.

Что делает ярлык:
- открывает видимое окно лаунчера + окно **Smysl stack (WSL)** с `npm run dev:all` (сессия не убивается);
- ждёт `http://127.0.0.1:3847/jarvis`;
- открывает браузер Windows.

Если не встало:

```powershell
powershell -ExecutionPolicy Bypass -File .\launchers\diagnose.ps1
```

Логи: `%TEMP%\smysl-launch.log`, в WSL `/tmp/smysl-launch/wsl-boot.log`.

| Файл | Назначение |
|---|---|
| `install-windows-shortcut.ps1` | ставит `.lnk` на Desktop |
| `start-smysl.vbs` | вход ярлыка (консоль видна) |
| `start-smysl-wsl.bat` | WSL boot + wait + browser |
| `diagnose.ps1` | диагностика |
| `../scripts/wsl-boot.sh` | foreground `dev:all` в Ubuntu |
| `smysl-jarvis.desktop` | Linux |

## Linux

```bash
npm run shortcut   # меню + ~/Desktop
npm run jarvis     # запуск
```
