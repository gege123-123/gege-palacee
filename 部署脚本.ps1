# 格格的宫殿 - 一键部署脚本
# 使用方法：右键 -> 使用 PowerShell 运行

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  格格的宫殿 - 永久部署助手" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# 检查 Git
try {
    $env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
    git --version | Out-Null
    Write-Host "✅ Git 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ 请先安装 Git: https://git-scm.com/download/win" -ForegroundColor Red
    exit
}

# 设置 Git 用户信息
Write-Host ""
Write-Host "请输入你的 GitHub 信息：" -ForegroundColor Yellow
$gitUser = Read-Host "GitHub 用户名"
$gitEmail = Read-Host "GitHub 邮箱"

if ($gitUser -and $gitEmail) {
    git config user.name $gitUser
    git config user.email $gitEmail
    Write-Host "✅ Git 配置完成" -ForegroundColor Green
}

# 提交代码
Write-Host ""
Write-Host "正在提交代码..." -ForegroundColor Yellow

git add .
git commit -m "格格的宫殿 v3.0 - 永久部署版"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 代码已提交" -ForegroundColor Green
} else {
    Write-Host "⚠️ 没有新的更改需要提交" -ForegroundColor Yellow
}

# 询问 GitHub 仓库
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  第1步：创建 GitHub 仓库" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 打开浏览器访问: https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name 输入: gege-palace" -ForegroundColor White
Write-Host "3. 选择 Private (私有仓库)" -ForegroundColor White
Write-Host "4. 不要勾选 Initialize with README" -ForegroundColor White
Write-Host "5. 点击 Create repository" -ForegroundColor White
Write-Host ""

$repoUrl = Read-Host "创建完成后，粘贴仓库地址 (https://github.com/用户名/gege-palace.git)"

if ($repoUrl) {
    Write-Host ""
    Write-Host "正在推送到 GitHub..." -ForegroundColor Yellow
    
    git branch -M main
    git remote remove origin 2>$null
    git remote add origin $repoUrl
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 代码已推送到 GitHub" -ForegroundColor Green
    } else {
        Write-Host "❌ 推送失败，请检查仓库地址和权限" -ForegroundColor Red
        Write-Host "如果是首次使用 Git，可能需要配置认证" -ForegroundColor Yellow
        Write-Host "建议安装 Git Credential Manager 或使用 Personal Access Token" -ForegroundColor Yellow
    }
}

# 部署到 Render
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  第2步：部署到 Render.com" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 打开浏览器访问: https://render.com" -ForegroundColor White
Write-Host "2. 使用 GitHub 账号登录" -ForegroundColor White
Write-Host "3. 点击右上角 + 选择 Web Service" -ForegroundColor White
Write-Host "4. 选择你的 gege-palace 仓库" -ForegroundColor White
Write-Host "5. 配置信息（自动检测）:" -ForegroundColor White
Write-Host "   - Build Command: npm install" -ForegroundColor Gray
Write-Host "   - Start Command: node server.js" -ForegroundColor Gray
Write-Host "6. 点击 Create Web Service" -ForegroundColor White
Write-Host ""
Write-Host "等待约 2-3 分钟部署完成后，你会获得一个永久网址：" -ForegroundColor Yellow
Write-Host "   https://gege-palace.onrender.com" -ForegroundColor Cyan
Write-Host ""

# 打开 Render 网站
Start-Process "https://render.com"

Write-Host "============================================" -ForegroundColor Green
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "手机访问永久网址：" -ForegroundColor Yellow
Write-Host "  https://gege-palace.onrender.com" -ForegroundColor Cyan
Write-Host ""

Read-Host "按回车键打开 GitHub 创建仓库页面"
Start-Process "https://github.com/new"
