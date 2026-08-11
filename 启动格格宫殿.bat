@echo off
chcp 65001 >nul
title 格格的宫殿 - 服务器

echo ========================================
echo    格格的宫殿 - 启动本地服务器
echo ========================================
echo.
echo 正在启动服务器...
echo.

cd /d "%~dp0"
start "" http://localhost:8080
python -m http.server 8080

if errorlevel 1 (
    echo.
    echo [错误] Python启动失败，请确认已安装Python
    echo 请访问 https://www.python.org 下载安装
    echo.
    pause
)

echo.
echo ========================================
echo   服务器已启动！
echo   请在浏览器中访问: http://localhost:8080
echo   关闭此窗口将停止服务器
echo ========================================
echo.
pause