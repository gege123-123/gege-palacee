Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cloudflared tunnel --url http://localhost:3000", 1, False