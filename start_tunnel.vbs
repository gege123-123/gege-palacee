Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strDir = "C:\Users\leido\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a745750a04e5bc65d92b6a3"
objShell.CurrentDirectory = strDir

' ===== 步骤 1: 启动 Node.js 服务器 =====
WScript.Echo "正在启动 Node.js 服务器..."
objShell.Run "node server.js", 1, False

' 等待服务器启动
WScript.Echo "等待服务器启动 (5秒)..."
WScript.Sleep 5000

' ===== 步骤 2: 检查 cloudflared 是否可用 =====
WScript.Echo vbCrLf & "正在检查 cloudflared..."

strCloudflared = ""
' 检查 cloudflared 是否在 PATH 中
objShell.Run "cmd /c where cloudflared > %TEMP%\cf_check.txt 2>&1", 0, True

If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_check.txt") Then
    Set objFile = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_check.txt", 1)
    strContent = objFile.ReadAll
    objFile.Close
    If InStr(strContent, "cloudflared") > 0 And InStr(strContent, "not found") = 0 Then
        strCloudflared = "cloudflared"
        WScript.Echo "找到 cloudflared"
    End If
End If

' 如果没有 cloudflared，检查 ngrok
If strCloudflared = "" Then
    WScript.Echo "正在检查 ngrok..."
    objShell.Run "cmd /c where ngrok > %TEMP%\ngrok_check.txt 2>&1", 0, True
    If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\ngrok_check.txt") Then
        Set objFile = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\ngrok_check.txt", 1)
        strContent = objFile.ReadAll
        objFile.Close
        If InStr(strContent, "ngrok") > 0 And InStr(strContent, "not found") = 0 Then
            strCloudflared = "ngrok"
            WScript.Echo "找到 ngrok"
        End If
    End If
End If

' ===== 步骤 3: 如果没有隧道工具，安装 cloudflared =====
If strCloudflared = "" Then
    WScript.Echo vbCrLf & "未找到 cloudflared 或 ngrok，正在安装 cloudflared..."
    WScript.Echo "尝试通过 npm 安装..."
    
    objShell.Run "cmd /c npm install -g cloudflared > %TEMP%\cf_install.txt 2>&1", 0, True
    
    If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_install.txt") Then
        Set objFile = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_install.txt", 1)
        strContent = objFile.ReadAll
        objFile.Close
        WScript.Echo "安装输出: " & strContent
        
        ' 再次检查
        objShell.Run "cmd /c where cloudflared > %TEMP%\cf_check2.txt 2>&1", 0, True
        If objFSO.FileExists(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_check2.txt") Then
            Set objFile = objFSO.OpenTextFile(objShell.ExpandEnvironmentStrings("%TEMP%") & "\cf_check2.txt", 1)
            strContent = objFile.ReadAll
            objFile.Close
            If InStr(strContent, "cloudflared") > 0 And InStr(strContent, "not found") = 0 Then
                strCloudflared = "cloudflared"
                WScript.Echo "cloudflared 安装成功！"
            End If
        End If
    End If
    
    If strCloudflared = "" Then
        WScript.Echo vbCrLf & "npm 安装失败，尝试下载 cloudflared..."
        ' 下载 cloudflared
        objShell.Run "cmd /c curl -L -o """ & strDir & "\cloudflared.exe"" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe > %TEMP%\cf_dl.txt 2>&1", 0, True
        If objFSO.FileExists(strDir & "\cloudflared.exe") Then
            strCloudflared = """" & strDir & "\cloudflared.exe"""
            WScript.Echo "cloudflared 下载成功！"
        End If
    End If
End If

' ===== 步骤 4: 创建隧道 =====
WScript.Echo vbCrLf & "=============================================="
WScript.Echo "正在创建隧道，暴露端口 3000..."
WScript.Echo "=============================================="
WScript.Echo vbCrLf & "隧道窗口即将打开，请在该窗口中查找公网 URL。"
WScript.Echo "URL 格式类似: https://xxxx.trycloudflare.com" & vbCrLf

If strCloudflared = "ngrok" Then
    objShell.Run "ngrok http 3000", 1, False
ElseIf strCloudflared <> "" Then
    objShell.Run strCloudflared & " tunnel --url http://localhost:3000", 1, False
Else
    WScript.Echo "错误: 未找到任何隧道工具（cloudflared / ngrok）。"
    WScript.Echo "请手动安装其中一个后重试。"
End If

WScript.Echo vbCrLf & "服务器和隧道已启动！"
WScript.Echo "请查看新打开的命令行窗口获取公网访问 URL。"
WScript.Echo vbCrLf & "提示: cloudflared URL 类似 https://xxxx.trycloudflare.com"
WScript.Echo "      ngrok URL 类似 https://xxxx.ngrok-free.app"

WScript.Sleep 2000
WScript.Echo vbCrLf & "完成！您可以关闭此窗口。"