<#
.SYNOPSIS
    Orbis Agent - Tool tự động cập nhật bản mới nhất từ GitHub
.DESCRIPTION
    Tự động tải bản mới nhất từ https://github.com/siloneedsleep/orbis-agent,
    cập nhật đè vào thư mục app có sẵn, đóng tiến trình cũ, biên dịch lại bản mới,
    và tự động xóa chính nó sau khi hoàn tất.
.EXAMPLE
    .\scripts\update-app.ps1
    irm https://raw.githubusercontent.com/siloneedsleep/orbis-agent/main/scripts/update-app.ps1 | iex
#>

[CmdletBinding()]
param (
    [string]$AppDir = "",
    [switch]$NoLaunch = $false,
    [switch]$KeepScript = $false
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " [ORBIS AGENT] TOOL CAP NHAT BAN MOI NHAT TU GITHUB" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Dang chuan bi cap nhat ban moi nhat tu GitHub...`n" -ForegroundColor Gray

# 1. Xac dinh thu muc ung dung
$candidates = @()
if (![string]::IsNullOrWhiteSpace($AppDir) -and (Test-Path $AppDir)) {
    $candidates += (Resolve-Path $AppDir).Path
}

if ($PSScriptRoot) {
    $parent = Split-Path -Parent $PSScriptRoot
    if (Test-Path (Join-Path $parent "package.json")) { $candidates += $parent }
    if (Test-Path (Join-Path $PSScriptRoot "package.json")) { $candidates += $PSScriptRoot }
}

$currentDir = (Get-Location).Path
if (Test-Path (Join-Path $currentDir "package.json")) { $candidates += $currentDir }

$commonPaths = @(
    "C:\Users\truon\OneDrive\Desktop\orbis-agent-main",
    "$HOME\OneDrive\Desktop\orbis-agent-main",
    "$HOME\Desktop\orbis-agent-main",
    "C:\Users\truon\Desktop\orbis-agent-main"
)

foreach ($p in $commonPaths) {
    if (Test-Path (Join-Path $p "package.json")) { $candidates += $p }
}

$targetAppDir = $null
foreach ($c in $candidates) {
    $hasTauri = Test-Path (Join-Path $c "src-tauri")
    $hasPkg = Test-Path (Join-Path $c "package.json")
    if ($hasTauri -or $hasPkg) {
        $targetAppDir = $c
        break
    }
}

if (-not $targetAppDir) {
    Write-Host "Khong tu dong tim thay thu muc Orbis Agent!" -ForegroundColor Yellow
    $userPath = Read-Host "Vui long nhap duong dan thu muc Orbis Agent"
    if (![string]::IsNullOrWhiteSpace($userPath) -and (Test-Path $userPath)) {
        $targetAppDir = (Resolve-Path $userPath).Path
    } else {
        Write-Host "Huy bo cap nhat vi khong tim thay thu muc hop le." -ForegroundColor Red
        return
    }
}

Write-Host "Thu muc ung dung: $targetAppDir" -ForegroundColor Green

# 2. Dong cac tien trinh Orbis Agent dang chay
Write-Host "Kiem tra va dong tien trinh Orbis cu..." -ForegroundColor Gray
$runningProcesses = Get-Process | Where-Object { 
    $_.ProcessName -like "*orbis*" -or $_.ProcessName -like "*tauri*" 
}
foreach ($proc in $runningProcesses) {
    try {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   -> Da dong tien trinh: $($proc.ProcessName)" -ForegroundColor DarkGray
    } catch {}
}
Start-Sleep -Milliseconds 500

# 3. Cap nhat ma nguon tu GitHub
$repoUrl = "https://github.com/siloneedsleep/orbis-agent"
$zipUrl = "https://github.com/siloneedsleep/orbis-agent/archive/refs/heads/main.zip"
$updateSuccess = $false

# Uu tien 1: Dung Git neu thu muc la git repo
if (Test-Path (Join-Path $targetAppDir ".git")) {
    Write-Host "Dong bo ma nguon qua Git..." -ForegroundColor Cyan
    try {
        git -C $targetAppDir fetch origin main 2>&1 | Out-Null
        $gitReset = git -C $targetAppDir reset --hard origin/main 2>&1
        Write-Host "   -> Git Reset: $gitReset" -ForegroundColor DarkGray
        $updateSuccess = $true
    } catch {
        Write-Host "   Git gap loi, chuyen sang tai file ZIP..." -ForegroundColor Yellow
        $updateSuccess = $false
    }
}

# Uu tien 2: Tai truc tiep tu GitHub ZIP
if (-not $updateSuccess) {
    Write-Host "Dang tai ban moi nhat tu GitHub ($zipUrl)..." -ForegroundColor Cyan
    $tempZip = Join-Path $env:TEMP "orbis-update-$([Guid]::NewGuid().ToString().Substring(0,8)).zip"
    $tempExtract = Join-Path $env:TEMP "orbis-extract-$([Guid]::NewGuid().ToString().Substring(0,8))"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
        Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
        Write-Host "Giai nen va cap nhat tep tin..." -ForegroundColor Cyan

        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

        $extractedRoot = Get-ChildItem -Path $tempExtract | Where-Object { $_.PSIsContainer } | Select-Object -First 1
        $sourceDir = if ($extractedRoot) { $extractedRoot.FullName } else { $tempExtract }

        # Chep de tep tin vao thu muc app (giu node_modules)
        Get-ChildItem -Path $sourceDir -Recurse | ForEach-Object {
            $relPath = $_.FullName.Substring($sourceDir.Length).TrimStart('\', '/')
            $destPath = Join-Path $targetAppDir $relPath

            if ($_.PSIsContainer) {
                if (-not (Test-Path $destPath)) {
                    New-Item -ItemType Directory -Path $destPath -Force | Out-Null
                }
            } else {
                Copy-Item -Path $_.FullName -Destination $destPath -Force
            }
        }

        $updateSuccess = $true
        Write-Host "   -> Da cap nhat cac tep tin moi nhat thanh cong!" -ForegroundColor Green
    } catch {
        Write-Host "Loi khi tai/giai nen ban cap nhat: $_" -ForegroundColor Red
        return
    } finally {
        if (Test-Path $tempZip) { Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue }
        if (Test-Path $tempExtract) { Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

# 4. Bien dich lai Frontend
Write-Host "Bien dich lai Frontend (npm run build)..." -ForegroundColor Cyan
try {
    Push-Location $targetAppDir
    cmd.exe /c "npm run build"
    Pop-Location
    Write-Host "   -> Build Frontend hoan tat!" -ForegroundColor Green
} catch {
    Write-Host "   Build frontend co thong bao: $_" -ForegroundColor Yellow
}

# 5. Thong bao hoan tat
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " DA CAP NHAT ORBIS AGENT LEN BAN MOI NHAT THANH CONG!" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Moi tinh nang (Mini Bubble Chat, Pose Bubbles, Treat, Redeem) da duoc dong bo.`n" -ForegroundColor White

# 6. Tu dong xoa script updater ("xong r tu xoa luon")
if (-not $KeepScript) {
    if ($MyInvocation.MyCommand.Path -and (Test-Path $MyInvocation.MyCommand.Path)) {
        $selfScriptPath = $MyInvocation.MyCommand.Path
        Write-Host "Dang don dep va tu dong xoa file updater..." -ForegroundColor Gray
        Start-Process cmd.exe -ArgumentList "/c ping 127.0.0.1 -n 2 >nul & del /f /q `"$selfScriptPath`"" -WindowStyle Hidden
    }
}
