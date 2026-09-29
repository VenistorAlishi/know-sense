@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Smysl Jarvis launcher
cd /d "%~dp0.."
set "ROOT=%CD%"
set "JARVIS=http://127.0.0.1:3847/jarvis"
set "LOG=%TEMP%\smysl-launch.log"
set "WSL_DISTRO=Ubuntu"

echo ==== Smysl launch %DATE% %TIME% ==== > "%LOG%"
echo ROOT=%ROOT%>> "%LOG%"
echo.
echo Smysl Jarvis launcher
echo Log: %LOG%
echo.

where wsl >nul 2>&1
if errorlevel 1 (
  echo ERROR: wsl.exe not found. Install WSL / Ubuntu first.
  echo ERROR: wsl.exe not found>> "%LOG%"
  pause
  exit /b 1
)

REM Resolve Windows path → WSL path
set "WSLROOT="
for /f "delims=" %%i in ('wsl -d %WSL_DISTRO% wslpath -a "%ROOT%" 2^>nul') do set "WSLROOT=%%i"
if not defined WSLROOT (
  REM fallback: any default distro
  for /f "delims=" %%i in ('wsl wslpath -a "%ROOT%" 2^>nul') do set "WSLROOT=%%i"
)
if not defined WSLROOT (
  echo ERROR: could not map %ROOT% into WSL. Is distro "%WSL_DISTRO%" installed?
  echo ERROR: wslpath failed>> "%LOG%"
  wsl -l -v
  pause
  exit /b 1
)
echo WSLROOT=%WSLROOT%>> "%LOG%"
echo WSL path: %WSLROOT%

REM Health check from Windows (curl.exe or PowerShell)
call :is_up
if not errorlevel 1 goto OPEN

echo Starting stack in WSL (%WSL_DISTRO%)...
echo Starting wsl-boot.sh>> "%LOG%"
REM Visible window — must stay open; wsl-boot runs dev:all in foreground
start "Smysl stack (WSL)" wsl -d %WSL_DISTRO% -e bash -lc "export PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH; cd '%WSLROOT%' && bash scripts/wsl-boot.sh"

echo Waiting for %JARVIS% ...
set /a n=0
:wait_loop
call :is_up
if not errorlevel 1 goto OPEN
set /a n+=1
if %n% geq 180 (
  echo.
  echo Timed out after 3 minutes.
  echo Check the "Smysl stack (WSL)" window and:
  echo   %LOG%
  echo   Inside WSL: /tmp/smysl-launch/wsl-boot.log
  echo Timed out>> "%LOG%"
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_loop

:OPEN
echo Opening %JARVIS%
echo OPEN %JARVIS%>> "%LOG%"
start "" "%JARVIS%"
echo.
echo Stack should stay running in the "Smysl stack (WSL)" window.
echo You can close THIS launcher window.
timeout /t 4 /nobreak >nul
exit /b 0

REM ---------- helpers ----------
:is_up
where curl.exe >nul 2>&1
if not errorlevel 1 (
  curl.exe -sf --max-time 2 "%JARVIS%" >nul 2>&1
  if not errorlevel 1 exit /b 0
  curl.exe -sf --max-time 2 "http://127.0.0.1:3847/" >nul 2>&1
  if not errorlevel 1 exit /b 0
  exit /b 1
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%JARVIS%'; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:3847/'; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 } }"
exit /b %ERRORLEVEL%
