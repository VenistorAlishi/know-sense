#Requires -Version 5.1
# ASCII-only script body so Windows PowerShell 5.1 does not choke on UTF-8 Cyrillic.
# Puts "Smysl Jarvis.lnk" on the current user's Desktop.
#
#   powershell -ExecutionPolicy Bypass -File .\launchers\install-windows-shortcut.ps1
$ErrorActionPreference = "Stop"

$Launchers = $PSScriptRoot
$Root = (Resolve-Path (Join-Path $Launchers "..")).Path
$Vbs = Join-Path $Launchers "start-smysl.vbs"
$Bat = Join-Path $Launchers "start-smysl.bat"
$IconPng = Join-Path $Root "desktop\src-tauri\icons\128x128.png"
$IconIco = Join-Path $Launchers "smysl-jarvis.ico"

if (-not (Test-Path $Vbs)) { throw "Missing: $Vbs" }
if (-not (Test-Path $Bat)) { throw "Missing: $Bat" }

if ((Test-Path $IconPng) -and -not (Test-Path $IconIco)) {
  try {
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile($IconPng)
    $bmp = New-Object System.Drawing.Bitmap 32, 32
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, 32, 32)
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    $fs = [System.IO.File]::Create($IconIco)
    $icon.Save($fs)
    $fs.Close()
    $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  } catch {
    Write-Host "Icon convert skipped: $($_.Exception.Message)"
  }
}

$Desktop = [Environment]::GetFolderPath("Desktop")
$LnkPath = Join-Path $Desktop "Smysl Jarvis.lnk"

$Wsh = New-Object -ComObject WScript.Shell
$Sc = $Wsh.CreateShortcut($LnkPath)
$Sc.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$Sc.Arguments = "`"$Vbs`""
$Sc.WorkingDirectory = $Root
$Sc.WindowStyle = 7
$Sc.Description = "Smysl Jarvis - Next + MemPalace + chat"
if (Test-Path $IconIco) {
  $Sc.IconLocation = "$IconIco,0"
} elseif (Test-Path $IconPng) {
  $Sc.IconLocation = "$IconPng,0"
}
$Sc.Save()

Write-Host "OK: $LnkPath"
Write-Host "Double-click Desktop shortcut, or from WSL: npm run jarvis"
Write-Host "Then open http://127.0.0.1:3847/jarvis in Windows browser"
