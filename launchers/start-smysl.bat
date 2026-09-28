@echo off
REM Prefer WSL launcher on Windows; fall back to legacy bat
if exist "%~dp0start-smysl-wsl.bat" (
  where wsl >nul 2>&1
  if not errorlevel 1 (
    call "%~dp0start-smysl-wsl.bat"
    exit /b %ERRORLEVEL%
  )
)
if exist "%~dp0Запуск Смысл.bat" (
  call "%~dp0Запуск Смысл.bat"
  exit /b %ERRORLEVEL%
)
echo No launcher bat found.
pause
exit /b 1
