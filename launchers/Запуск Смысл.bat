@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Смысл Jarvis

set "ROOT=%~dp0.."
cd /d "%ROOT%"
set "ROOT=%CD%"
set "JARVIS=http://127.0.0.1:3847/jarvis"
set "LOG=%TEMP%\smysl-launch.log"

echo [%date% %time%] launch from %ROOT% > "%LOG%"

REM --- already up? ---
curl -sf --max-time 2 "%JARVIS%" >nul 2>&1
if not errorlevel 1 goto OPEN

REM --- prefer WSL (full stack: Next + palace + Ollama) ---
where wsl >nul 2>&1
if errorlevel 1 goto TRY_GITBASH

for /f "delims=" %%i in ('wsl wslpath -a "%ROOT%" 2^>nul') do set "WSLROOT=%%i"
if not defined WSLROOT goto TRY_GITBASH

echo Starting via WSL…
echo wsl root=%WSLROOT% >> "%LOG%"
start "smysl-wsl" /min wsl -e bash -lc "cd '%WSLROOT%' && (test -d node_modules || npm install) && npm run jarvis >> /tmp/smysl-launch.log 2>&1"
goto WAIT

:TRY_GITBASH
if exist "%ProgramFiles%\Git\bin\bash.exe" (
  set "BASH=%ProgramFiles%\Git\bin\bash.exe"
) else if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" (
  set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
) else (
  set "BASH="
)
if not defined BASH goto TRY_NATIVE

echo Starting via Git Bash…
start "smysl-bash" /min "%BASH%" -lc "cd '$ROOT' && npm run jarvis" 
goto WAIT

:TRY_NATIVE
where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo Нужен WSL ^(рекомендуется^), Git Bash или Node.js/npm в PATH.
  echo Лог: %LOG%
  pause
  exit /b 1
)

echo Starting Next only ^(palace через bash недоступен без WSL/Git Bash^)…
start "smysl-next" /min cmd /c "cd /d \"%ROOT%\" && npm run dev"
goto WAIT

:WAIT
echo Жду %JARVIS% …
set /a n=0
:loop
curl -sf --max-time 2 "%JARVIS%" >nul 2>&1
if not errorlevel 1 goto OPEN
curl -sf --max-time 2 "http://127.0.0.1:3847/" >nul 2>&1
if not errorlevel 1 goto OPEN
set /a n+=1
if %n% geq 120 (
  echo Не дождался сервера за 2 мин. Смотри %LOG%
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto loop

:OPEN
echo Opening Jarvis…
start "" "%JARVIS%"
endlocal
exit /b 0
