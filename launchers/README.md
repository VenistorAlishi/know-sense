# Ярлыки запуска Смысл

## Windows — ярлык на рабочий стол

С облачной VM агент **не может** записать файл на твой Windows Desktop.  
Сделай один раз у себя на ПК (репозиторий должен лежать локально):

1. Склонируй / открой проект на Windows (лучше через **WSL**, там полный стек).
2. В PowerShell из корня репо:

```powershell
powershell -ExecutionPolicy Bypass -File .\launchers\install-windows-shortcut.ps1
```

3. На рабочем столе появится **«Смысл Jarvis»** — дальше один двойной клик.

Что делает ярлык: поднимает стек (через WSL → `npm run jarvis`, иначе Git Bash / Next) и открывает `http://127.0.0.1:3847/jarvis`.

| Файл | Назначение |
|---|---|
| `install-windows-shortcut.ps1` | ставит `.lnk` на Desktop |
| `Запуск Смысл.vbs` | тихий старт (без мигающей консоли) |
| `Запуск Смысл.bat` / `start-smysl.bat` | логика запуска |
| `smysl-jarvis.desktop` | Linux |

## Linux

```bash
npm run shortcut   # меню + ~/Desktop
npm run jarvis     # запуск
```
