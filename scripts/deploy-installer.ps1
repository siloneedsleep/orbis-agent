# ==============================================================================
#  AUTO INSTALL ORBIS - ONE-CLICK AUTO OVERWRITE & DEPLOYER
#  - Tu dong phat hien & ghi de sach se ban cu tren may
#  - Dong bo commit moi nhat tu GitHub
#  - Trien khai file .exe vao LocalAppData
#  - Trich xuat & tao icon tu hinh anh chi dinh
#  - Tao shortcut tren Desktop tu dong mo kem PowerShell
#  - Khoi chay app va tu dong xoa file installer roi thoat
# ==============================================================================

[CmdletBinding()]
param(
    [string]$CustomIconPath = "",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                    AUTO INSTALL ORBIS                      " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Dang tu dong kiem tra, ghi de ban cu & dong bo tu GitHub...`n" -ForegroundColor Gray

$RepoUrl = "https://github.com/siloneedsleep/orbis-agent.git"
$ZipUrl  = "https://github.com/siloneedsleep/orbis-agent/archive/refs/heads/main.zip"

# Xac dinh tat ca cac vi tri cai dat ban cu de ghi de
$targetDeployDirs = @(
    (Join-Path $env:LOCALAPPDATA "Orbis Agent"),
    "E:\Users\truon\AppData\Local\Orbis Agent"
) | Where-Object { $_ -ne $null } | Select-Object -Unique

# 1. Dong tat ca tien trinh Orbis Agent cu dang chay
Write-Host "[1/6] Phat hien va dong tat ca tien trinh Orbis cu..." -ForegroundColor Cyan
$runningProcs = Get-Process | Where-Object { 
    $_.ProcessName -like "*orbis*" -or $_.ProcessName -like "*tauri*" 
}
foreach ($proc in $runningProcs) {
    try {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   -> Da tat tien trinh cu: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor DarkGray
    } catch {}
}
Start-Sleep -Milliseconds 600

# 2. Xac dinh thu muc ma nguon va dong bo commit moi nhat tu GitHub
Write-Host "[2/6] Dong bo commit moi nhat tu GitHub..." -ForegroundColor Cyan
$SourceDir = "C:\Users\truon\OneDrive\Desktop\orbis-agent-main"
if (-not (Test-Path (Join-Path $SourceDir "package.json"))) {
    $SourceDir = Join-Path $env:TEMP "orbis-source-latest"
    if (Test-Path $SourceDir) { Remove-Item $SourceDir -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $SourceDir -Force | Out-Null
    
    $tempZip = Join-Path $env:TEMP "orbis-latest.zip"
    Write-Host "   -> Dang tai ma nguon tu $ZipUrl..." -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    Invoke-WebRequest -Uri $ZipUrl -OutFile $tempZip -UseBasicParsing
    Expand-Archive -Path $tempZip -DestinationPath $SourceDir -Force
    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    $innerDir = Get-ChildItem $SourceDir | Where-Object { $_.PSIsContainer } | Select-Object -First 1
    if ($innerDir) { $SourceDir = $innerDir.FullName }
} else {
    try {
        Write-Host "   -> Cap nhat ma nguon qua git pull origin main..." -ForegroundColor Gray
        git -C $SourceDir pull origin main 2>&1 | Out-Null
    } catch {
        Write-Host "   -> Su dung ma nguon san co tai thu muc lam viec." -ForegroundColor DarkGray
    }
}

# 3. Bien dich va tu dong ghi de len ban cu
Write-Host "[3/6] Tu dong ghi de ban cu bang ban .exe moi nhat..." -ForegroundColor Cyan
$BuiltReleaseExe = Join-Path $SourceDir "src-tauri\target\release\orbis-agent.exe"
if (-not (Test-Path $BuiltReleaseExe) -or (-not $SkipBuild)) {
    if (Test-Path $BuiltReleaseExe) {
        Write-Host "   -> Su dung ban .exe release da bien dich moi nhat..." -ForegroundColor Green
    } else {
        Write-Host "   -> Dang bien dich ma nguon thanh .exe..." -ForegroundColor Yellow
        Push-Location $SourceDir
        cmd.exe /c "npm run build"
        cargo build --release --manifest-path src-tauri/Cargo.toml
        Pop-Location
    }
}

$DeployDir = Join-Path $env:LOCALAPPDATA "Orbis Agent"
$AppExePath = Join-Path $DeployDir "orbis-agent.exe"
$AppIcoPath = Join-Path $DeployDir "app.ico"

foreach ($dir in $targetDeployDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $destExe = Join-Path $dir "orbis-agent.exe"
    if (Test-Path $destExe) {
        Write-Host "   -> Phat hien ban cu tai: $dir - Dang ghi de..." -ForegroundColor Yellow
    }
    Copy-Item $BuiltReleaseExe -Destination $destExe -Force
    Write-Host "   -> Ghi de thanh cong file .exe vao: $destExe" -ForegroundColor Green
}


# 4. Xu ly Icon tu hinh anh chi dinh
Write-Host "[4/6] Tao Icon ung dung tu hinh anh..." -ForegroundColor Cyan
$DefaultImg = "C:\Users\truon\.gemini\antigravity\brain\50e7ccd6-f2c3-4e18-b228-368912e10c08\.user_uploaded\media_1792732621469_ebdd6db1.jpg"
$ImgToUse = if ($CustomIconPath -and (Test-Path $CustomIconPath)) { $CustomIconPath } else { $DefaultImg }

if (Test-Path $ImgToUse) {
    Add-Type -AssemblyName System.Drawing
    $src = [System.Drawing.Image]::FromFile($ImgToUse)
    $minDim = [Math]::Min($src.Width, $src.Height)
    $cropX = [Math]::Max(0, [int](($src.Width - $minDim) / 2))
    $cropY = [Math]::Max(0, [int](($src.Height - $minDim) / 2))

    $squareBmp = New-Object System.Drawing.Bitmap 256, 256
    $g = [System.Drawing.Graphics]::FromImage($squareBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $minDim, $minDim
    $destRect = New-Object System.Drawing.Rectangle 0, 0, 256, 256
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $src.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $squareBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes = $ms.ToArray()
    $ms.Dispose()
    $squareBmp.Dispose()

    $fs = New-Object System.IO.FileStream $AppIcoPath, ([System.IO.FileMode]::Create)
    $bw = New-Object System.IO.BinaryWriter $fs
    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]1)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$pngBytes.Length)
    $bw.Write([uint32]22)
    $bw.Write($pngBytes)
    $bw.Flush()
    $fs.Close()
    Write-Host "   -> Da xuat Icon 256x256 vao: $AppIcoPath" -ForegroundColor Green
}

# 5. Tao Desktop Shortcut (Mo Orbis kem PowerShell Console)
Write-Host "[5/6] Tao Shortcut Orbis Agent tren Desktop..." -ForegroundColor Cyan
$desktopPaths = @(
    [System.Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop")
) | Select-Object -Unique | Where-Object { Test-Path $_ }

$WshShell = New-Object -ComObject WScript.Shell

foreach ($dt in $desktopPaths) {
    $lnkPath = Join-Path $dt "Orbis Agent.lnk"
    $shortcut = $WshShell.CreateShortcut($lnkPath)
    
    # Cấu hình: click vào icon sẽ tự động mở app VÀ mở một cửa sổ PowerShell tương tác
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-ExecutionPolicy Bypass -NoExit -Command `"Start-Process '$AppExePath'; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host '   [ORBIS AGENT] POWERSHELL INTERACTIVE CONSOLE' -ForegroundColor Yellow; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host 'Orbis Agent da duoc khoi chay! Cua so PowerShell san sang cho cac lenh Agent.`n' -ForegroundColor Green; Set-Location '$DeployDir'`""
    $shortcut.WorkingDirectory = $DeployDir
    if (Test-Path $AppIcoPath) {
        $shortcut.IconLocation = "$AppIcoPath,0"
    }
    $shortcut.Description = "Orbis Agent - Autonomous AI Desktop Companion (Cyber Cat Silo)"
    $shortcut.Save()
    Write-Host "   -> Da tao shortcut tai: $lnkPath" -ForegroundColor Green
}

# 6. Khoi chay ung dung ngay lap tuc
Write-Host "[6/6] Khoi chay Orbis Agent va mo cua so PowerShell..." -ForegroundColor Cyan
$launchArgs = "-ExecutionPolicy Bypass -NoExit -Command `"Start-Process '$AppExePath'; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host '   [ORBIS AGENT] POWERSHELL INTERACTIVE CONSOLE' -ForegroundColor Yellow; Write-Host '===========================================================' -ForegroundColor Cyan; Write-Host 'Orbis Agent da duoc khoi chay! Cua so PowerShell san sang cho cac lenh Agent.`n' -ForegroundColor Green; Set-Location '$DeployDir'`""
Start-Process "powershell.exe" -ArgumentList $launchArgs

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "     CAI DAT & KHOI CHAY ORBIS AGENT HOAN TAT!            " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Tien trinh cai dat se tu dong xoa file installer va tat ngay bay gio...`n" -ForegroundColor DarkGray

# 7. Tu dong xoa file installer va tat chuong trinh
if ($env:INSTALLER_WRAPPER_FILE -and (Test-Path $env:INSTALLER_WRAPPER_FILE)) {
    $batFile = $env:INSTALLER_WRAPPER_FILE
    Start-Process cmd.exe -ArgumentList "/c ping 127.0.0.1 -n 2 >nul & del /f /q `"$batFile`"" -WindowStyle Hidden
}
