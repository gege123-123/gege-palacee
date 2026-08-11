@echo off
chcp 65001 >nul
title 格格的宫殿 - 启动服务器

echo.
echo ================================================
echo      格格的宫殿 - 启动本地服务器
echo ================================================
echo.

cd /d "%~dp0"

REM 查找 Node.js
set "NODEEXE="
for /f "delims=" %%i in ('where node 2^>nul') do set "NODEEXE=%%i"

if "%NODEEXE%"=="" (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODEEXE=C:\Program Files\nodejs\node.exe"
    )
)
if "%NODEEXE%"=="" (
    if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        set "NODEEXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    )
)

if "%NODEEXE%"=="" (
    echo [错误] 没有找到 Node.js！
    echo.
    echo 请下载安装：https://nodejs.org/zh-cn
    echo 下载 LTS 版本，安装时一路点"下一步"即可
    echo.
    echo 或者，您可以直接双击 index.html 在浏览器中打开。
    echo.
    pause
    exit /b 1
)

echo [OK] 找到 Node.js: %NODEEXE%
"%NODEEXE%" --version

if not exist "node_modules" (
    echo.
    echo [安装] 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [警告] 依赖安装失败，尝试直接启动...
    )
)

echo.
echo [启动] 正在启动服务器 (端口 3000)...
echo.
echo ----------------------------------------
echo   本机访问: http://localhost:3000
echo ----------------------------------------
echo.
echo 按 Ctrl+C 停止服务器
echo.

"%NODEEXE%" server.js

pause
