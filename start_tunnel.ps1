$ErrorActionPreference = "Continue"
cd "C:\Users\leido\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a745750a04e5bc65d92b6a3"
& ".\cloudflared.exe" tunnel --url http://localhost:3000 --no-autoupdate 2>&1 | ForEach-Object {
    if ($_ -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $url = $matches[0]
        Write-Host "URL_FOUND: $url"
        $url | Out-File -FilePath "tunnel_url.txt" -Encoding UTF8
    }
    Write-Host $_
}
