@echo off
chcp 65001 >nul
title 格格的宫殿 - 一键生成公网链接
echo.
echo ========================================================
echo   格格的宫殿 - 一键生成公网链接给朋友
echo ========================================================
echo.
cd /d "%~dp0"

REM ========= 查找可用的服务器 =========
echo [1/3] 查找服务器程序...
set "SRV_EXE="
set "SRV_CMD="

for /f "delims=" %%i in ('where python 2^>nul') do if not defined SRV_EXE set "SRV_EXE=%%i"
for /f "delims=" %%i in ('where python3 2^>nul') do if not defined SRV_EXE set "SRV_EXE=%%i"
for /f "delims=" %%i in ('where node 2^>nul') do if not defined SRV_EXE set "SRV_EXE=%%i"

if not defined SRV_EXE (
    if exist "C:\Program Files\nodejs\node.exe" set "SRV_EXE=C:\Program Files\nodejs\node.exe"
)
if not defined SRV_EXE (
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "SRV_EXE=C:\Program Files (x86)\nodejs\node.exe"
)
if not defined SRV_EXE (
    for /d %%d in ("C:\Python*") do if exist "%%~fd\python.exe" set "SRV_EXE=%%~fd\python.exe"
)
if not defined SRV_EXE (
    for /d %%d in ("%LOCALAPPDATA%\Programs\Python\*") do if exist "%%~fd\python.exe" set "SRV_EXE=%%~fd\python.exe"
)

if not defined SRV_EXE (
    echo.
    echo [提示] 电脑上没有找到 Python 或 Node.js
    echo.
    echo 最简单的免费方案：
    echo.
    echo ========================================
    echo   方案一：用在线工具（推荐，不用装任何东西）
    echo ========================================
    echo.
    echo   1. 打开 https://app.netglade.com/ 
    echo   2. 用微信或QQ扫码登录
    echo   3. 点"新建网站"，把这个文件夹拖进去：
    echo      %~dp0
    echo   4. 几秒后生成公网链接，复制发给朋友
    echo.
    echo   或者用：
    echo   - https://vercel.com  (免费，需注册账号)
    echo   - https://pages.cloudflare.com  (免费，需注册账号)
    echo   - https://www.netlify.com  (免费，拖拽即可)
    echo.
    echo ========================================
    echo   方案二：安装 Python 或 Node.js
    echo ========================================
    echo.
    echo   Python: https://www.python.org/downloads/
    echo   安装时勾选 "Add Python to PATH"
    echo.
    echo   Node.js: https://nodejs.org/zh-cn
    echo   选 LTS 版本，一路下一步
    echo.
    echo   装好后重新双击本脚本即可
    echo.
    pause
    exit /b
)

for /f "tokens=1 delims=\" %%a in ("%SRV_EXE%") do (
    if /i "%%a"=="python" set "SRV_CMD=%SRV_EXE% -m http.server 3000"
    if /i "%%a"=="python3" set "SRV_CMD=%SRV_EXE% -m http.server 3000"
    if /i "%%a"=="node" set "SRV_CMD=node server.js"
)

if not defined SRV_CMD set "SRV_CMD=%SRV_EXE% -m http.server 3000"

echo   找到: %SRV_EXE%
echo.

REM ========= 启动服务器 =========
echo [2/3] 启动本地服务器...
start "格格的宫殿_服务器" /min cmd /c "cd /d "%~dp0" && %SRV_CMD%"
echo   等待服务器启动...
timeout /t 3 /nobreak >nul

REM ========= 检查/下载 cloudflared =========
echo [3/3] 准备公网隧道...

set "TUNNEL="
for /f "delims=" %%i in ('where cloudflared 2^>nul') do if not defined TUNNEL set "TUNNEL=%%i"
if not defined TUNNEL if exist "%~dp0cloudflared.exe" set "TUNNEL=%~dp0cloudflared.exe"

if not defined TUNNEL (
    echo   首次使用，正在下载 cloudflared...
    echo   这是 Cloudflare 免费隧道，约 20MB
    
    curl -L -o "%~dp0cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" --connect-timeout 15 --max-time 120 2>nul
    
    if exist "%~dp0cloudflared.exe" (
        set "TUNNEL=%~dp0cloudflared.exe"
        echo   下载成功！
    )
)

if not defined TUNNEL (
    echo.
    echo [下载失败] 请手动下载 cloudflared：
    echo.
    echo   1. 打开: https://github.com/cloudflare/cloudflared/releases
    echo   2. 下载: cloudflared-windows-amd64.exe
    echo   3. 放到: %~dp0
    echo   4. 重本脚本
    echo.
    echo   下载完成后，重新双击本脚本即可
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   正在创建公网隧道...
echo   请等待显示公网地址...
echo ========================================================
echo.
echo   本机已启动: http://localhost:3000
echo.
echo   复制下面的公网链接发给朋友即可！
echo.
echo   按 Ctrl+C 可停止服务器
echo.

"%TUNNEL%" tunnel --url http://localhost:3000 --no-autoupdate

pause
