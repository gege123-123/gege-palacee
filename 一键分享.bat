@echo off
chcp 65001 >nul
title 格格的宫殿 - 一键分享公网链接

echo.
echo ========================================================
echo   格格的宫殿 - 一键生成公网分享链接
echo ========================================================
echo.

cd /d "%~dp0"

REM ====== 第一步：尝试启动服务器 ======
echo [1/3] 尝试启动本地服务器...

set "SERVER_CMD="
set "SERVER_EXE="

REM 查找 Node.js
for /f "delims=" %%i in ('where node 2^>nul') do set "SERVER_EXE=%%i"
if "%SERVER_EXE%"=="" if exist "C:\Program Files\nodejs\node.exe" set "SERVER_EXE=C:\Program Files\nodejs\node.exe"

if "%SERVER_EXE%" neq "" (
    set "SERVER_CMD=node server.js"
    echo   使用 Node.js 服务器
) else (
    REM 查找 Python
    for /f "delims=" %%i in ('where python 2^>nul') do set "SERVER_EXE=%%i"
    if "%SERVER_EXE%"=="" for /f "delims=" %%i in ('where python3 2^>nul') do set "SERVER_EXE=%%i"
    if "%SERVER_EXE%"=="" if exist "C:\Python314\python.exe" set "SERVER_EXE=C:\Python314\python.exe"
    if "%SERVER_EXE%"=="" if exist "C:\Python313\python.exe" set "SERVER_EXE=C:\Python313\python.exe"
    if "%SERVER_EXE%"=="" if exist "C:\Python312\python.exe" set "SERVER_EXE=C:\Python312\python.exe"
    if "%SERVER_EXE%"=="" if exist "C:\Python311\python.exe" set "SERVER_EXE=C:\Python311\python.exe"
    
    if "%SERVER_EXE%" neq "" (
        set "SERVER_CMD=python -m http.server 3000"
        echo   使用 Python 服务器
    )
)

if "%SERVER_EXE%"=="" (
    echo.
    echo [提示] 没找到 Node.js 或 Python
    echo.
    echo 最简单的方法：直接双击 index.html 用浏览器打开
    echo.
    echo 如果要分享给朋友，请安装：
    echo   Node.js: https://nodejs.org/zh-cn (选LTS版本)
    echo   或 Python: https://www.python.org/downloads/
    echo.
    pause
    exit /b
)

REM 确保依赖安装
if not exist "node_modules" (
    echo   [首次运行] 安装依赖...
    call npm install 2>nul
)

REM 启动服务器（后台运行）
echo   正在启动服务器...
start "格格的宫殿 - 本地服务器" /min cmd /c "cd /d "%~dp0" && %SERVER_CMD%"

echo   等待服务器启动 (3秒)...
timeout /t 3 /nobreak >nul

REM ====== 第二步：检查/下载 cloudflared ======
echo.
echo [2/3] 准备公网隧道...

set "TUNNEL="
for /f "delims=" %%i in ('where cloudflared 2^>nul') do set "TUNNEL=%%i"

if "%TUNNEL%"=="" (
    if exist "%~dp0cloudflared.exe" (
        set "TUNNEL=%~dp0cloudflared.exe"
    )
)

if "%TUNNEL%"=="" (
    echo   首次使用，正在下载 cloudflared...
    echo   (这是 Cloudflare 免费隧道工具，约 20MB)
    echo.
    
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0cloudflared.exe'" 2>nul
    
    if exist "%~dp0cloudflared.exe" (
        set "TUNNEL=%~dp0cloudflared.exe"
        echo   下载成功！
    ) else (
        echo   自动下载失败，请手动下载：
        echo   访问: https://github.com/cloudflare/cloudflared/releases
        echo   下载 cloudflared-windows-amd64.exe 放到本文件夹
        echo.
        pause
        exit /b 1
    )
)

echo [OK] 隧道工具就绪

REM ====== 第三步：创建隧道 ======
echo.
echo [3/3] 正在创建公网隧道...
echo.
echo ========================================================
echo   隧道启动后，会显示一个 https://xxxx.trycloudflare.com
echo   复制那个链接发给朋友即可！
echo ========================================================
echo.
echo 正在启动隧道（首次可能需要几秒钟）...
echo.

"%TUNNEL%" tunnel --url http://localhost:3000 --no-autoupdate

pause
