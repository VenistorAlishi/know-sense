' Silent wrapper (ASCII name for Windows PowerShell / shortcuts).
Option Explicit
Dim sh, fso, bat, dir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = dir & "\start-smysl.bat"
If Not fso.FileExists(bat) Then
  bat = dir & "\start-smysl-wsl.bat"
End If
sh.Run """" & bat & """", 0, False
