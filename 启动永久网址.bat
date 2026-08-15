@echo off
chcp 65001 >nul
title 格格的宫殿 - 永久网址模式

echo ========================================
echo    格格的宫殿 - 永久网址模式
echo    启动本地服务器 + 公网访问
echo ========================================
echo.

cd /d "%~dp0"

REM 使用 PowerShell 启动完整脚本
powershell -ExecutionPolicy Bypass -File "%~dp0启动永久网址.ps1"

if errorlevel 1 (
    echo.
    echo [错误] 启动脚本执行失败
    echo.
    pause
)
