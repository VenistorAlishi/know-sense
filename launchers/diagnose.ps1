#Requires -Version 5.1
$ErrorActionPreference = "Continue"
Write-Host "=== Smysl diagnose ==="
Write-Host "Repo:" (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "`n-- WSL --"
wsl -l -v

Write-Host "`n-- Windows -> :3847 --"
try {
  $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:3847/jarvis"
  Write-Host "OK" $r.StatusCode $r.StatusDescription
} catch {
  Write-Host "FAIL" $_.Exception.Message
}

Write-Host "`n-- WSL node/npm --"
wsl -d Ubuntu -e bash -lc 'export PATH=/usr/local/bin:/usr/bin:/bin:$PATH; echo node=$(command -v node); echo npm=$(command -v npm); node -v 2>/dev/null; npm -v 2>/dev/null; curl -sI http://127.0.0.1:3847/jarvis 2>/dev/null | head -3'

Write-Host "`n-- Logs --"
if (Test-Path "$env:TEMP\smysl-launch.log") {
  Write-Host "Windows log: $env:TEMP\smysl-launch.log"
  Get-Content "$env:TEMP\smysl-launch.log" -Tail 30
} else {
  Write-Host "No $env:TEMP\smysl-launch.log yet"
}

Write-Host "`nWSL boot log (if any):"
wsl -d Ubuntu -e bash -lc 'tail -30 /tmp/smysl-launch/wsl-boot.log 2>/dev/null || echo "(none)"'
