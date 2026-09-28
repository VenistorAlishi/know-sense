@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title Смысл Jarvis

where npm >nul 2>&1
if errorlevel 1 (
  echo Нужен Node.js / npm в PATH.
  pause
  exit /b 1
)

echo Запуск Смысл…
start "smysl-dev" /min cmd /c "npm run dev:all"
echo Жду http://127.0.0.1:3847 …
:wait
timeout /t 1 /nobreak >nul
curl -sf http://127.0.0.1:3847/jarvis >nul 2>&1
if errorlevel 1 goto wait

start "" "http://127.0.0.1:3847/jarvis"
exit /b 0
