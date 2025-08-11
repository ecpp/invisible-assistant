' Silent launcher for Windows - double-click to run
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get current directory
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Create required directories
appDataPath = objShell.ExpandEnvironmentStrings("%APPDATA%")
dirs = Array("\codeinterviewassist\temp", "\codeinterviewassist\cache", "\codeinterviewassist\screenshots", "\codeinterviewassist\extra_screenshots")

For Each dir in dirs
    fullPath = appDataPath & dir
    If Not objFSO.FolderExists(fullPath) Then
        CreateFolder fullPath
    End If
Next

' Build the app silently
objShell.CurrentDirectory = strPath
objShell.Run "cmd /c npm run build", 0, True

' Launch the app invisibly
objShell.Run "cmd /c set NODE_ENV=production && npx electron dist-electron\main.js", 0, False

' Helper function to create folders recursively
Sub CreateFolder(path)
    Dim parent
    parent = objFSO.GetParentFolderName(path)
    If Not objFSO.FolderExists(parent) Then
        CreateFolder parent
    End If
    If Not objFSO.FolderExists(path) Then
        objFSO.CreateFolder path
    End If
End Sub