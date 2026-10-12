Option Explicit

' Starts OpenGrokBot Studio without displaying a terminal window.
Dim shell, fileSystem, root, appExe, nodeExe, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

' Ensure ELECTRON_RUN_AS_NODE is stripped so Electron launches GUI instead of Node CLI
On Error Resume Next
shell.Environment("Process").Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0

root = fileSystem.GetParentFolderName(WScript.ScriptFullName)
appExe = root & "\releases\win-unpacked\OpenGrokBot Studio.exe"

If fileSystem.FileExists(appExe) Then
  shell.CurrentDirectory = root
  shell.Run Chr(34) & appExe & Chr(34), 1, False
Else
  nodeExe = "C:\Program Files\nodejs\node.exe"
  If Not fileSystem.FileExists(nodeExe) Then
    nodeExe = "node.exe"
  End If
  command = Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & root & "\desktop\launch.cjs" & Chr(34)
  shell.CurrentDirectory = root
  shell.Run command, 0, False
End If
