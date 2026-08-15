#!/usr/bin/env powershell
$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   格格的宫殿 - 永久网址模式" -ForegroundColor Yellow
Write-Host "   本地服务器 + 公网隧道" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未检测到 Node.js，请先安装" -ForegroundColor Red
    Write-Host "请访问 https://nodejs.org 下载安装" -ForegroundColor Yellow
    Read-Host "按回车退出"
    exit 1
}

# 检查 cloudflared
$cloudflaredPath = Join-Path $scriptDir "cloudflared.exe"
if (-not (Test-Path $cloudflaredPath)) {
    $cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cloudflared) {
        $cloudflaredPath = $cloudflared.Source
    } else {
        Write-Host "[错误] 未找到 cloudflared.exe" -ForegroundColor Red
        Read-Host "按回车退出"
        exit 1
    }
}

Write-Host "[1/2] 正在启动本地服务器..." -ForegroundColor Green

# 启动 Node.js 服务器
$serverProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Minimized

# 等待服务器启动
Start-Sleep -Seconds 3

# 检查服务器是否成功启动
if ($serverProcess.HasExited) {
    Write-Host "[错误] 服务器启动失败" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

# 验证服务器是否正常响应
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    if ($healthCheck.success) {
        Write-Host "       ✅ 服务器运行正常" -ForegroundColor Gray
    }
} catch {
    Write-Host "       ⚠️  服务器可能还在启动中..." -ForegroundColor Yellow
}

Write-Host "       服务器进程 PID: $($serverProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "[2/2] 正在创建公网隧道..." -ForegroundColor Green

# 清理旧日志
$stdoutLog = Join-Path $scriptDir "cf_stdout.log"
$stderrLog = Join-Path $scriptDir "cf_stderr.log"
Remove-Item $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue

# 创建 cloudflared quick tunnel（使用 HTTP/2 协议避免 QUIC 问题）
$tunnelProcess = Start-Process -FilePath $cloudflaredPath `
    -ArgumentList @("tunnel", "--url", "http://localhost:3000", "--protocol", "http2", "--no-autoupdate") `
    -PassThru -NoNewWindow -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

# 等待 cloudflared 启动并获取 URL
Write-Host "       正在获取公网地址（约15秒）..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# 从日志中提取 tunnel URL
$tunnelUrl = $null

# 先尝试从 stderr 读取（cloudflared 主要输出到 stderr）
if (Test-Path $stderrLog) {
    $logContent = Get-Content $stderrLog -Raw -ErrorAction SilentlyContinue
    if ($logContent -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
        $tunnelUrl = $Matches[0]
    }
}

# 如果没找到，尝试从 stdout 读取
if (-not $tunnelUrl -and (Test-Path $stdoutLog)) {
    $logContent = Get-Content $stdoutLog -Raw -ErrorAction SilentlyContinue
    if ($logContent -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
        $tunnelUrl = $Matches[0]
    }
}

# 输出结果
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ✅ 格格的宫殿已启动！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($tunnelUrl) {
    # 测试 URL 是否可访问
    Write-Host "   正在验证公网地址..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
    
    $urlWorking = $false
    try {
        $testResponse = Invoke-WebRequest -Uri "$tunnelUrl/api/health" -UseBasicParsing -TimeoutSec 15
        if ($testResponse.StatusCode -eq 200) {
            $urlWorking = $true
        }
    } catch {}
    
    Write-Host "   🌐 公网访问地址:" -ForegroundColor Yellow
    Write-Host "   $tunnelUrl" -ForegroundColor Green
    
    if ($urlWorking) {
        Write-Host "   ✅ 公网地址验证通过，可以正常访问！" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  地址已生成，但可能需要几秒后才能访问" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "   💡 复制上面的地址分享给奴才们" -ForegroundColor Gray
    Write-Host "   📱 手机、平板、电脑均可通过此地址访问" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  未能自动获取公网地址" -ForegroundColor Yellow
    Write-Host "   请查看 cloudflared 窗口中的地址" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   提示: 地址格式应为 https://xxx.trycloudflare.com" -ForegroundColor Gray
}

Write-Host "   💻 本地访问地址: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "   📋 服务器 PID: $($serverProcess.Id)" -ForegroundColor Gray
Write-Host "   📋 隧道 PID: $($tunnelProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "   🔒 保持此窗口打开，关闭则停止所有服务" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 保存进程信息
$infoContent = @"
ServerPID: $($serverProcess.Id)
TunnelPID: $($tunnelProcess.Id)
TunnelURL: $tunnelUrl
StartTime: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@
$infoContent | Out-File -FilePath (Join-Path $scriptDir "running_services.txt") -Encoding UTF8

Write-Host "📝 进程信息已保存到 running_services.txt" -ForegroundColor Gray
Write-Host ""

# 打开本地地址
Start-Process "http://localhost:3000"

# 等待用户按键关闭
Write-Host "按任意键停止所有服务并退出..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 清理：停止进程
Write-Host ""
Write-Host "正在停止服务..." -ForegroundColor Red

if (-not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ 服务器已停止" -ForegroundColor Gray
}

if (-not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ 隧道已停止" -ForegroundColor Gray
}

# 清理临时文件
Remove-Item $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $scriptDir "running_services.txt") -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "👋 服务已完全停止，再见！" -ForegroundColor Green
