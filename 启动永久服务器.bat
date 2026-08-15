@echo off
chcp 65001 >nul
title 格格的宫殿 - 永久服务器

echo ============================================
echo   格格的宫殿 - 永久服务器启动中...
echo ============================================
echo.

cd /d "%~dp0"

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit
)

REM 检查依赖
if not exist "node_modules" (
    echo [安装] 正在安装依赖...
    call npm install
    echo.
)

REM 启动服务器（后台运行）
echo [启动] 启动格格的宫殿服务器...
start "格格的宫殿服务器" /min node server.js

REM 等待服务器启动
timeout /t 3 /nobreak >nul

REM 启动 Cloudflare 隧道（后台运行）
echo [启动] 启动 Cloudflare 公网隧道...
start "Cloudflare隧道" /min cloudflared.exe tunnel --url http://localhost:3000 --protocol http2 --no-autoupdate

REM 等待隧道启动
timeout /t 10 /nobreak >nul

echo.
echo ============================================
echo   ✅ 服务器启动完成！
echo ============================================
echo.
echo   本机访问: http://localhost:3000
echo   局域网访问: http://192.168.43.15:3000
echo.
echo   公网访问地址（请看 Cloudflare 隧道窗口）：
echo   https://xxxxxx.trycloudflare.com
echo.
echo   ⚠️ 注意：保持此窗口打开，关闭则停止服务
echo.
echo   按任意键打开浏览器访问...
echo ============================================
pause >nul
start http://localhost:3000
