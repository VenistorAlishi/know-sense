' Silent wrapper: no console flash on double-click.
Option Explicit
Dim sh, fso, bat
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
bat = fso.GetParentFolderName(WScript.ScriptFullName) & "\Запуск Смысл.bat"
If Not fso.FileExists(bat) Then
  bat = fso.GetParentFolderName(WScript.ScriptFullName) & "\start-smysl.bat"
End If
sh.Run """" & bat & """", 0, False
