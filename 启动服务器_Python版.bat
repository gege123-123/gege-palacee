@echo off
chcp 65001 >nul
title 格格的宫殿 - Python版服务器（无需Node.js）

echo.
echo ================================================
echo   格格的宫殿 - Python版启动（最简单）
echo ================================================
echo.

cd /d "%~dp0"

REM 查找 Python
set "PYEXE="
for /f "delims=" %%i in ('where python 2^>nul') do set "PYEXE=%%i"

if "%PYEXE%"=="" (
    for /f "delims=" %%i in ('where python3 2^>nul') do set "PYEXE=%%i"
)

if "%PYEXE%"=="" (
    echo [错误] 没有找到 Python！
    echo.
    echo 两个选择：
    echo 1. 直接双击 index.html 在浏览器中打开（最简单）
    echo 2. 下载 Python：https://www.python.org/downloads/
    echo    安装时勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo [OK] 找到 Python: %PYEXE%
"%PYEXE%" --version

echo.
echo [启动] 正在启动服务器 (端口 3000)...
echo.
echo ----------------------------------------
echo   本机访问: http://localhost:3000
echo ----------------------------------------
echo.
echo 按 Ctrl+C 停止服务器
echo.

"%PYEXE%" -m http.server 3000

pause
