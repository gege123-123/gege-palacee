@echo off
chcp 65001 >nul
title 格格的宫殿 - 一键部署到Railway云服务器

echo ╔══════════════════════════════════════════════╗
echo ║     格格的宫殿 · 一键部署到Railway云平台     ║
echo ╠══════════════════════════════════════════════╣
echo ║  Railway是免费的云平台，支持Node.js应用      ║
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

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  方式一：Git一键部署（推荐）                 ║
echo ║                                              ║
echo ║  1. 将代码推送到GitHub                       ║
echo ║  2. 访问 https://railway.app                ║
echo ║  3. 注册/登录Railway账号                     ║
echo ║  4. 点击 "New Project" → "Deploy from GitHub"║
echo ║  5. 选择您的GitHub仓库                       ║
echo ║  6. Railway自动检测Node.js并部署             ║
echo ║                                              ║
echo ║  方式二：CLI部署                             ║
echo ║  1. 运行: npm install -g @railway/cli      ║
echo ║  2. 运行: railway login                      ║
echo ║  3. 运行: railway init                       ║
echo ║  4. 运行: railway up                         ║
echo ╚══════════════════════════════════════════════╝
echo.

echo 📖 正在打开Railway官网...
start https://railway.app

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  配置环境变量（部署后）：                    ║
echo ║                                              ║
echo ║  在Railway项目的Variables中添加：            ║
echo ║  MPAY_API_KEY = 您的码支付API Key           ║
echo ║  MPAY_API_SECRET = 您的码支付API Secret     ║
echo ║  PUBLIC_URL = https://您的项目地址.up.railway.app║
echo ║  PAYMENT_METHOD = api                       ║
echo ║                                              ║
echo ║  码支付回调地址设置为：                     ║
echo ║  https://您的项目地址.up.railway.app/api/payment/notify║
echo ╚══════════════════════════════════════════════╝
echo.

:: 创建railway配置文件
echo {
echo   "$schema": "https://railway.com/railway.toml",
echo   "deploy": {
echo     "startCommand": "node server.js",
echo     "buildCommand": "npm install"
echo   }
echo } > railway.toml

echo ✅ 已创建 railway.toml 配置文件
echo.

pause
