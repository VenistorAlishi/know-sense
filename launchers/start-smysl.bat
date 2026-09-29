@echo off
REM Entry point for Desktop shortcut / VBS.
REM Always use the WSL boot path when wsl exists — never recurse.
setlocal
cd /d "%~dp0"

where wsl >nul 2>&1
if not errorlevel 1 (
  call "%~dp0start-smysl-wsl.bat"
  exit /b %ERRORLEVEL%
)

echo WSL not found. Trying Git Bash / native path via legacy launcher...
if exist "%~dp0Запуск Смысл.bat" (
  call "%~dp0Запуск Смысл.bat"
  exit /b %ERRORLEVEL%
)

echo ERROR: Neither WSL nor legacy launcher available.
pause
exit /b 1
