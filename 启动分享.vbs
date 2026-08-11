Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 检查 Python / Node
strServerCmd = ""
strServerExe = ""

' 尝试 Python
On Error Resume Next
strPy = WshShell.RegRead("HKLM\SOFTWARE\Python\PythonCore\3.14\InstallPath")
If Err.Number <> 0 Then
    strPy = WshShell.RegRead("HKLM\SOFTWARE\Python\PythonCore\3.13\InstallPath")
End If
If Err.Number <> 0 Then
    strPy = WshShell.RegRead("HKLM\SOFTWARE\Python\PythonCore\3.12\InstallPath")
End If
If Err.Number <> 0 Then
    strPy = WshShell.RegRead("HKLM\SOFTWARE\Python\PythonCore\3.11\InstallPath")
End If
Err.Clear
On Error GoTo 0

If strPy <> "" And fso.FileExists(strPy & "python.exe") Then
    strServerExe = strPy & "python.exe"
    strServerCmd = """" & strServerExe & """ -m http.server 3000"
ElseIf fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    strServerExe = "C:\Program Files\nodejs\node.exe"
    strServerCmd = "node server.js"
Else
    MsgBox "电脑上没有找到 Python 或 Node.js。" & vbCrLf & vbCrLf & _
        "请先安装 Python: https://www.python.org/downloads/" & vbCrLf & _
        "安装时勾选 ""Add Python to PATH""" & vbCrLf & vbCrLf & _
        "或者打开 https://netglade.com 在线部署", vbInformation, "格格的宫殿"
    WScript.Quit
End If

' 启动服务器
WshShell.CurrentDirectory = strDir
WshShell.Run strServerCmd, 0, False

' 等待服务器启动
WScript.Sleep 3000

' 检查 cloudflared
strTunnel = ""
If fso.FileExists(strDir & "\cloudflared.exe") Then
    strTunnel = strDir & "\cloudflared.exe"
Else
    ' 尝试下载
    MsgBox "即将下载 cloudflared (约20MB)，用于创建公网隧道。" & vbCrLf & _
        "请稍候...", vbInformation, "格格的宫殿"
    
    strUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    strOut = strDir & "\cloudflared.exe"
    
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Open "GET", strUrl, False
    http.setRequestHeader "User-Agent", "Mozilla/5.0"
    On Error Resume Next
    http.Send
    If Err.Number = 0 And http.Status = 200 Then
        Set stream = CreateObject("ADODB.Stream")
        stream.Type = 1
        stream.Open
        stream.Write http.ResponseBody
        stream.SaveToFile strOut, 2
        stream.Close
        strTunnel = strOut
    End If
    Err.Clear
    On Error GoTo 0
    
    If strTunnel = "" Then
        MsgBox "自动下载失败，请手动下载：" & vbCrLf & vbCrLf & _
            "1. 打开 https://github.com/cloudflare/cloudflared/releases" & vbCrLf & _
            "2. 下载 cloudflared-windows-amd64.exe" & vbCrLf & _
            "3. 放到 " & strDir & vbCrLf & _
            "4. 重新双击本脚本", vbExclamation, "下载失败"
        WScript.Quit
    End If
End If

' 显示信息
MsgBox "服务器已启动！" & vbCrLf & vbCrLf & _
    "本机访问: http://localhost:3000" & vbCrLf & vbCrLf & _
    "即将启动公网隧道..." & vbCrLf & _
    "隧道窗口会显示 https://xxxx.trycloudflare.com" & vbCrLf & _
    "复制那个链接发给朋友即可！", vbInformation, "格格的宫殿"

' 启动隧道
WshShell.CurrentDirectory = strDir
WshShell.Run """" & strTunnel & """ tunnel --url http://localhost:3000 --no-autoupdate", 1, False
