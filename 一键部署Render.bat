@echo off
chcp 65001 >nul
title 格格的宫殿 - 一键部署到Render云服务器

echo ╔══════════════════════════════════════════════╗
echo ║     格格的宫殿 · 一键部署到Render云平台      ║
echo ╠══════════════════════════════════════════════╣
echo ║  Render是免费的云平台，7x24小时运行          ║
echo ║  部署后无需电脑开机，支付自动到账            ║
echo ╚══════════════════════════════════════════════╝
echo.

:: 检查是否安装了Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js已安装
node --version

:: 检查是否安装了Render CLI
where render >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 正在安装Render CLI...
    npm install -g @render/cli
    if %errorlevel% neq 0 (
        echo ❌ Render CLI安装失败
        pause
        exit /b 1
    )
)

echo ✅ Render CLI已安装

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  接下来的步骤：                              ║
echo ║  1. 在浏览器中打开 https://render.com       ║
echo ║  2. 注册/登录Render账号                     ║
echo ║  3. 创建一个新的Web Service                 ║
echo ║  4. 选择 "Existing Service" → "New from repo"║
echo ║  5. 连接GitHub并选择您的仓库                ║
echo ║  6. Build Command: npm install              ║
echo ║  7. Start Command: node server.js           ║
echo ║  8. 点击 "Create Service"                   ║
echo ║                                              ║
echo ║  或者使用Render CLI:                        ║
echo ║  1. 运行: render login                      ║
echo ║  2. 运行: render deploy                     ║
echo ╚══════════════════════════════════════════════╝
echo.

echo 📖 正在打开Render官网...
start https://render.com

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  配置环境变量（部署后）：                    ║
echo ║                                              ║
echo ║  在Render服务的Environment中添加：           ║
echo ║  MPAY_API_KEY = 您的码支付API Key           ║
echo ║  MPAY_API_SECRET = 您的码支付API Secret     ║
echo ║  PUBLIC_URL = https://您的服务地址.onrender.com║
echo ║  PAYMENT_METHOD = api                       ║
echo ║                                              ║
echo ║  码支付回调地址设置为：                     ║
echo ║  https://您的服务地址.onrender.com/api/payment/notify║
echo ╚══════════════════════════════════════════════╝
echo.

pause
