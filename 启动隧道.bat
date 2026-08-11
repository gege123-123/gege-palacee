@echo off
chcp 65001 >nul
title 格格的宫殿 - 服务器 + 隧道 一键启动

echo.
echo ╔══════════════════════════════════════════════╗
echo ║     格格的宫殿 - 服务器 + 隧道 一键启动      ║
echo ╚══════════════════════════════════════════════╝
echo.

cd /d "C:\Users\leido\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6a745750a04e5bc65d92b6a3"

REM ===== 步骤 0: 检查 Node.js =====
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js 已就绪

REM ===== 步骤 1: 安装依赖（如需要） =====
if not exist "node_modules" (
    echo [安装] 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [OK] 依赖已安装
)

REM ===== 步骤 2: 启动 Node.js 服务器 =====
echo.
echo [启动] 正在启动 Node.js 服务器 (端口 3000)...
start "格格的宫殿 - 服务器" cmd /k "node server.js"

echo [等待] 等待服务器启动 (3秒)...
timeout /t 3 /nobreak >nul

REM ===== 步骤 3: 检查隧道工具 =====
echo.
echo [检查] 正在检查隧道工具...

set "TUNNEL_TOOL="

REM 检查 cloudflared
where cloudflared >nul 2>nul
if %errorlevel% equ 0 (
    set "TUNNEL_TOOL=cloudflared"
    echo [OK] 找到 cloudflared
)

REM 如果没有 cloudflared，检查 ngrok
if "%TUNNEL_TOOL%"=="" (
    where ngrok >nul 2>nul
    if %errorlevel% equ 0 (
        set "TUNNEL_TOOL=ngrok"
        echo [OK] 找到 ngrok
    )
)

REM ===== 步骤 4: 安装 cloudflared（如需要） =====
if "%TUNNEL_TOOL%"=="" (
    echo.
    echo [安装] 未找到隧道工具，正在安装 cloudflared...
    
    REM 尝试 npm 安装
    call npm install -g cloudflared 2>nul
    where cloudflared >nul 2>nul
    if %errorlevel% equ 0 (
        set "TUNNEL_TOOL=cloudflared"
        echo [OK] cloudflared 安装成功 (via npm)
    )
    
    REM 如果 npm 安装失败，尝试下载
    if "%TUNNEL_TOOL%"=="" (
        echo [下载] 正在从 GitHub 下载 cloudflared...
        curl -L -o "%~dp0cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" 2>nul
        if exist "%~dp0cloudflared.exe" (
            set "TUNNEL_TOOL=%~dp0cloudflared.exe"
            echo [OK] cloudflared 下载成功
        )
    )
)

REM ===== 步骤 5: 创建隧道 =====
echo.
echo ╔══════════════════════════════════════════════╗
echo ║           创建隧道 - 暴露端口 3000           ║
echo ╠══════════════════════════════════════════════╣

if "%TUNNEL_TOOL%"=="" (
    echo ║  [错误] 未找到任何隧道工具                    ║
    echo ║  请手动安装 cloudflared 或 ngrok              ║
    echo ╚══════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

if "%TUNNEL_TOOL%"=="ngrok" (
    echo ║  正在使用 ngrok 创建隧道...                   ║
    echo ║  请在新窗口中查看公网 URL                     ║
    echo ╚══════════════════════════════════════════════╝
    start "ngrok 隧道" cmd /k "ngrok http 3000"
) else (
    echo ║  正在使用 cloudflared 创建隧道...              ║
    echo ║  请在新窗口中查看公网 URL                     ║
    echo ║  URL 格式: https://xxxx.trycloudflare.com     ║
    echo ╚══════════════════════════════════════════════╝
    start "cloudflared 隧道" cmd /k "%TUNNEL_TOOL% tunnel --url http://localhost:3000"
)

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  服务器和隧道已启动！                         ║
echo ╠══════════════════════════════════════════════╣
echo ║  本机访问:  http://localhost:3000              ║
echo ║  公网访问:  请查看隧道窗口中的 URL             ║
echo ║                                              ║
echo ║  关闭方式:                                    ║
echo ║    1. 关闭服务器窗口                          ║
echo ║    2. 关闭隧道窗口                            ║
echo ╚══════════════════════════════════════════════╝
echo.
echo 按任意键退出此窗口（服务器和隧道将继续运行）...
pause >nul