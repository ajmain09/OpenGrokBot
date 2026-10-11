Option Explicit

' Starts OpenGrokBot without displaying a terminal window.
Dim shell, fileSystem, root, nodeExe, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

root = fileSystem.GetParentFolderName(WScript.ScriptFullName)
nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fileSystem.FileExists(nodeExe) Then
  nodeExe = "node.exe"
End If

command = Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & root & "\desktop\launch.cjs" & Chr(34)

shell.CurrentDirectory = root
shell.Run command, 0, False
