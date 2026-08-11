Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strDir = "C:\Users\leido\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a745750a04e5bc65d92b6a3"

' ===== Fix PowerShell Execution Policy =====
On Error Resume Next
objShell.RegWrite "HKCU\Software\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell\ExecutionPolicy", "RemoteSigned", "REG_SZ"
On Error GoTo 0

' ===== Start Server =====
objShell.CurrentDirectory = strDir
objShell.Run "cmd /c start ""格格的宫殿"" node server.js", 1, False

WScript.Sleep 5000

' ===== Check Tunnel Tool =====
strTool = ""

objShell.Run "cmd /c where cloudflared > %TEMP%\cf_chk.txt 2>&1", 0, True
If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_chk.txt") Then
    Set f = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_chk.txt", 1)
    c = f.ReadAll
    f.Close
    If InStr(c, "not found") = 0 And InStr(c, "cloudflared") > 0 Then
        strTool = "cloudflared"
    End If
End If

If strTool = "" Then
    objShell.Run "cmd /c where ngrok > %TEMP%\ng_chk.txt 2>&1", 0, True
    If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\ng_chk.txt") Then
        Set f = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\ng_chk.txt", 1)
        c = f.ReadAll
        f.Close
        If InStr(c, "not found") = 0 And InStr(c, "ngrok") > 0 Then
            strTool = "ngrok"
        End If
    End If
End If

If strTool = "" Then
    objShell.Run "cmd /c npm install -g cloudflared > %TEMP%\cf_inst.txt 2>&1", 0, True
    WScript.Sleep 3000
    objShell.Run "cmd /c where cloudflared > %TEMP%\cf_chk2.txt 2>&1", 0, True
    If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_chk2.txt") Then
        Set f = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_chk2.txt", 1)
        c = f.ReadAll
        f.Close
        If InStr(c, "not found") = 0 And InStr(c, "cloudflared") > 0 Then
            strTool = "cloudflared"
        End If
    End If
End If

' ===== Start Tunnel =====
If strTool = "ngrok" Then
    objShell.Run "cmd /c start ""ngrok隧道"" ngrok http 3000", 1, False
    MsgBox "ngrok 隧道已启动！" & vbCrLf & vbCrLf & "请在 ngrok 窗口中查找公网 URL" & vbCrLf & "(格式: https://xxxx.ngrok-free.app)", vbInformation, "格格的宫殿 - 隧道"
ElseIf strTool <> "" Then
    objShell.Run "cmd /c start ""cloudflared隧道"" cloudflared tunnel --url http://localhost:3000", 1, False
    MsgBox "cloudflared 隧道已启动！" & vbCrLf & vbCrLf & "请在 cloudflared 窗口中查找公网 URL" & vbCrLf & "(格式: https://xxxx.trycloudflare.com)", vbInformation, "格格的宫殿 - 隧道"
Else
    MsgBox "未找到任何隧道工具！" & vbCrLf & vbCrLf & "请手动安装 cloudflared 或 ngrok" & vbCrLf & "cloudflared 下载: https://github.com/cloudflare/cloudflared/releases", vbCritical, "错误"
End If