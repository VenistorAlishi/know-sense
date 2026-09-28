@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"
set "ROOT=%CD%"
set "JARVIS=http://127.0.0.1:3847/jarvis"

REM Prefer WSL full stack
where wsl >nul 2>&1
if errorlevel 1 goto NATIVE

for /f "delims=" %%i in ('wsl wslpath -a "%ROOT%" 2^>nul') do set "WSLROOT=%%i"
if not defined WSLROOT goto NATIVE

curl -sf --max-time 2 "%JARVIS%" >nul 2>&1
if not errorlevel 1 goto OPEN

start "smysl-wsl" /min wsl -d Ubuntu -e bash -lc "export PATH=/usr/bin:$PATH; cd '%WSLROOT%' && npm run jarvis"
goto WAIT

:NATIVE
call "%~dp0start-smysl.bat"
goto :eof

:WAIT
echo Waiting for %JARVIS% ...
set /a n=0
:loop
curl -sf --max-time 2 "%JARVIS%" >nul 2>&1
if not errorlevel 1 goto OPEN
set /a n+=1
if %n% geq 120 (
  echo Timed out. Is WSL running? Try: wsl -d Ubuntu
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto loop

:OPEN
start "" "%JARVIS%"
exit /b 0
