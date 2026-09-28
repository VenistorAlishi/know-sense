# Force LF line endings on shell scripts (fixes: set: pipefail / invalid option name on Windows)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

git config core.autocrlf false
git config core.eol lf

Get-ChildItem -Path $Root -Recurse -Include *.sh -File |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\\.venv\\' } |
  ForEach-Object {
    $text = [System.IO.File]::ReadAllText($_.FullName) -replace "`r`n", "`n" -replace "`r", "`n"
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($_.FullName, $text, $utf8)
    Write-Host "LF:" $_.FullName.Substring($Root.Length + 1)
  }

Write-Host "Done. Prefer running setup via WSL or Git Bash:"
Write-Host "  wsl -e bash -lc 'cd /mnt/c/Users/KIRILL/know-sense && npm run setup:embed && npm run setup:ai'"
