' Desktop shortcut entry: show launcher console (not silent).
' WindowStyle 1 = normal — so PATH/npm errors are visible.
Option Explicit
Dim sh, fso, bat, dir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = dir & "\start-smysl-wsl.bat"
If Not fso.FileExists(bat) Then bat = dir & "\start-smysl.bat"
If Not fso.FileExists(bat) Then
  MsgBox "Launcher not found in:" & vbCrLf & dir, vbCritical, "Smysl Jarvis"
  WScript.Quit 1
End If
sh.CurrentDirectory = fso.GetParentFolderName(dir)
sh.Run """" & bat & """", 1, False
