# 格格宫殿 GitHub Pages 一键部署脚本
# 使用方法：右键 → 使用 PowerShell 运行

Write-Host "========================================"
Write-Host "  格格宫殿 · GitHub Pages 一键部署"
Write-Host "========================================"
Write-Host ""

# 检查 Git 是否可用
$gitAvailable = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitAvailable) {
    Write-Host "[错误] 未检测到 Git，请先安装 Git"
    Write-Host "下载地址：https://git-scm.com/download/win"
    Read-Host "按回车键退出"
    exit
}

Write-Host "[1/5] 准备上传文件..."

# 切换到脚本所在目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 确保www目录存在
if (-not (Test-Path "www")) {
    Write-Host "[错误] 未找到 www 目录！"
    Read-Host "按回车键退出"
    exit
}

# 添加所有www目录文件到git
git add www/
git add .github/ 2>$null

# 提交更改
git commit -m "部署格格宫殿到 GitHub Pages" 2>$null

Write-Host "[2/5] 准备推送到 GitHub..."

# 检查远程仓库
$remoteExists = git remote -v 2>$null
if (-not $remoteExists) {
    Write-Host "[提示] 正在配置远程仓库..."
    $repoUrl = "https://github.com/gege123-123/gege-palacee.git"
    git remote add origin $repoUrl
}

# 切换到 main 分支
git branch -M main

Write-Host "[3/5] 正在推送代码..."
Write-Host "[提示] 如果提示输入密码，请输入：zhubo19910629"
Write-Host ""

# 推送（使用凭据）
git push -u origin main 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[失败] 推送失败！可能是网络问题或密码错误。"
    Write-Host ""
    Write-Host "如果是密码问题，请执行以下步骤："
    Write-Host "1. 访问 https://github.com/settings/tokens"
    Write-Host "2. 创建一个新的 Personal Access Token（classic）"
    Write-Host "3. 复制 token 后，运行：git remote set-url origin https://gege123-123:新token@github.com/gege123-123/gege-palacee.git"
    Write-Host "4. 重新运行本脚本"
    Read-Host "按回车键退出"
    exit
}

Write-Host ""
Write-Host "[4/5] 代码已推送到 GitHub！"
Write-Host ""
Write-Host "[5/5] 配置 GitHub Pages..."
Write-Host ""
Write-Host "请手动完成以下步骤："
Write-Host ""
Write-Host "1. 访问：https://github.com/gege123-123/gege-palacee/settings/pages"
Write-Host "2. 在 'Source' 下拉菜单中选择 'GitHub Actions'"
Write-Host "3. 访问：https://github.com/gege123-123/gege-palacee/actions"
Write-Host "4. 点击 'Deploy to GitHub Pages' → 'Run workflow'"
Write-Host "5. 等待 2-3 分钟后，访问网站地址"
Write-Host ""
Write-Host "您的网站地址将是："
Write-Host "  https://gege123-123.github.io/gege-palacee/"
Write-Host ""
Write-Host "========================================"
Write-Host "  部署完成！"
Write-Host "========================================"
Write-Host ""
Write-Host "按回车键打开 GitHub Pages 设置页面..."
Read-Host
Start-Process "https://github.com/gege123-123/gege-palacee/settings/pages"
