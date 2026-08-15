@echo off
chcp 65001 >nul
title 格格的宫殿 - 一键启动测试模式

echo ╔══════════════════════════════════════════════╗
echo ║     格格的宫殿 · 一键启动测试模式            ║
echo ╠══════════════════════════════════════════════╣
echo ║  测试模式特点：                              ║
echo ║  ✅ 无需真实支付，3秒自动到账               ║
echo ║  ✅ 测试完整充值流程                         ║
echo ║  ✅ 验证前端+后端对接正常                    ║
echo ╚══════════════════════════════════════════════╝
echo.

:: 检查Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

:: 安装依赖
echo 📦 检查依赖...
if not exist node_modules (
    echo 📦 正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

:: 切换到测试模式
echo ⚙️ 切换到测试模式...
node -e "const fs=require('fs');const config=JSON.parse(fs.readFileSync('payment_config.json','utf8')||'{}');config.paymentMethod='test';config.testMode=true;fs.writeFileSync('payment_config.json',JSON.stringify(config,null,2));console.log('✅ 测试模式已启用');"

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  服务器即将启动...                           ║
echo ║                                              ║
echo ║  启动后请访问：                              ║
echo ║  本机: http://localhost:3000                ║
echo ║  手机: http://电脑IP:3000                   ║
echo ║                                              ║
echo ║  测试步骤：                                  ║
echo ║  1. 注册/登录奴才账号                        ║
echo ║  2. 点击"金币"→选择金额→生成付款码          ║
echo ║  3. 等待3秒，金币自动到账                    ║
echo ╚══════════════════════════════════════════════╝
echo.
echo 正在启动服务器...
echo.

:: 启动服务器
node server.js
pause
