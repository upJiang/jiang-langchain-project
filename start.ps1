# Windows PowerShell启动脚本

# 检测并释放3000端口（客户端）
Write-Host "检测3000端口占用情况..."
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port3000) {
    Write-Host "发现进程 $port3000 占用了3000端口，正在终止..."
    Stop-Process -Id $port3000 -Force
    Write-Host "3000端口已释放"
} else {
    Write-Host "3000端口未被占用"
}

# 检测并释放3001端口（服务器）
Write-Host "检测3001端口占用情况..."
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($port3001) {
    Write-Host "发现进程 $port3001 占用了3001端口，正在终止..."
    Stop-Process -Id $port3001 -Force
    Write-Host "3001端口已释放"
} else {
    Write-Host "3001端口未被占用"
}

# 检查uploads目录是否存在
if (-Not (Test-Path -Path "server\uploads")) {
    Write-Host "创建uploads目录..."
    New-Item -ItemType Directory -Path "server\uploads" -Force
}

# 启动服务器（后台运行）
Write-Host "启动服务器..."
$serverJob = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    node server/index.js 
}
$serverJobId = $serverJob.Id
Write-Host "服务器作业ID: $serverJobId"

# 等待服务器启动
Write-Host "等待服务器启动完成..."
Start-Sleep -Seconds 3

# 启动客户端（前台运行）
Write-Host "启动客户端..."
try {
    yarn dev
} finally {
    # 当客户端关闭时，终止服务器进程
    Write-Host "客户端已关闭，正在终止服务器..."
    Stop-Job -Id $serverJobId
    Remove-Job -Id $serverJobId
    Write-Host "服务器已终止"
} 