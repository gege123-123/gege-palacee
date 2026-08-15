@echo off
chcp 65001 >nul
title 格格的宫殿 - 一键切换API模式（真实支付）

echo ╔══════════════════════════════════════════════╗
echo ║     格格的宫殿 · 一键切换API生产模式         ║
echo ╠══════════════════════════════════════════════╣
echo ║  API模式特点：                               ║
echo ║  ✅ 真实扫码支付                             ║
echo ║  ✅ 支付后金币自动到账                       ║
echo ║  ✅ 对接码支付/BufPay等平台                  ║
echo ╚══════════════════════════════════════════════╝
echo.

:: 切换到API模式
echo ⚙️ 切换到API模式...
node -e "const fs=require('fs');const config=JSON.parse(fs.readFileSync('payment_config.json','utf8')||'{}');config.paymentMethod='api';config.testMode=false;fs.writeFileSync('payment_config.json',JSON.stringify(config,null,2));console.log('✅ API模式已启用');"

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  ⚠️  重要提醒：                              ║
echo ║                                              ║
echo ║  1. 请在格格控制殿填写API Key和Secret        ║
echo ║  2. 配置回调地址                              ║
echo ║  3. 电脑需保持开机（或部署到云服务器）      ║
echo ║                                              ║
echo ║  获取API Key：                               ║
echo ║  - 访问码支付/BufPay官网                     ║
echo ║  - 注册账号并完成实名认证                     ║
echo ║  - 在API管理页面获取Key和Secret              ║
echo ╚══════════════════════════════════════════════╝
echo.

pause
