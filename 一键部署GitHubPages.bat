@echo off
chcp 65001 >nul
title 格格宫殿 - GitHub Pages 一键部署

echo ========================================
echo   格格宫殿 · GitHub Pages 一键部署
echo ========================================
echo.

cd /d "%~dp0"

:: 检查 Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Git！
    echo 请先安装: https://git-scm.com/download/win
    pause
    exit /b
)

echo [1/5] 准备上传文件...
echo.

:: 添加和提交
git add www/ 2>nul
git add .github/ 2>nul
git commit -m "deploy: github pages" 2>nul

echo [2/5] 配置远程仓库...
echo.

:: 配置远程（使用用户名密码）
git remote remove origin 2>nul
git remote add origin https://gege123-123:zhubo19910629@github.com/gege123-123/gege-palacee.git

echo [3/5] 推送到 GitHub...
echo [提示] 正在推送，请稍候...
echo.

:: 推送到 main 分支
git branch -M main
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [警告] 推送失败！
    echo.
    echo 可能原因：
    echo 1. 网络无法连接 GitHub
    echo 2. 密码已过期
    echo.
    echo 如果是密码问题，请：
    echo 1. 访问 https://github.com/settings/tokens
    echo 2. 创建新的 Token (classic)
    echo 3. 复制 Token 后运行:
    echo    git remote set-url origin https://gege123-123:新token@github.com/gege123-123/gege-palacee.git
    echo.
    pause
    exit /b
)

echo.
echo [4/5] 推送成功！
echo.
echo [5/5] 接下来请完成 GitHub Pages 配置：
echo.
echo ============================================
echo   手动配置步骤（需在浏览器中操作）
echo ============================================
echo.
echo 1. 打开：
echo    https://github.com/gege123-123/gege-palacee/settings/pages
echo.
echo 2. 找到 "Source" 下拉菜单
echo    选择 "GitHub Actions"
echo.
echo 3. 打开：
echo    https://github.com/gege123-123/gege-palacee/actions
echo.
echo 4. 点击 "Deploy to GitHub Pages"
echo    然后点击 "Run workflow"
echo.
echo 5. 等待 2-3 分钟
echo    您的网站地址：
echo    https://gege123-123.github.io/gege-palacee/
echo.
echo ============================================
echo.

echo 按回车键打开 GitHub Pages 设置页面...
pause >nul
start https://github.com/gege123-123/gege-palacee/settings/pages
