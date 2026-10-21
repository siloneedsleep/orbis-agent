<#
.SYNOPSIS
    Orbis Agent - Công cụ cấp Redeem Code độc quyền (Creator Tool)
.DESCRIPTION
    Tạo mã ngẫu nhiên dạng orbis-xxxx-yyyy hoặc mã tự chọn.
    Chỉ định phần thưởng: Treats, EXP, và Kỹ năng độc quyền (copy từ app hoặc tạo mới).
    Ghi trực tiếp vào src/data/redeemCodes.json và lưu bản xuất generated-codes.txt.
.EXAMPLE
    .\scripts\issue-code.ps1
    .\scripts\issue-code.ps1 -Count 5 -Treats 200 -Exp 50
    .\scripts\issue-code.ps1 -Code "orbis-pro-silo" -Treats 500 -SkillName "Chế độ Gaming" -SkillPrompt "Tối ưu hiệu năng CPU/GPU"
#>

[CmdletBinding()]
param (
    [string]$Code = "",
    [int]$Count = 1,
    [int]$Treats = 100,
    [int]$Exp = 50,
    [string]$SkillName = "",
    [string]$SkillTrigger = "",
    [string]$SkillPrompt = "",
    [string]$SkillCategory = "macro",
    [switch]$Interactive = $false
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$codesJsonPath = Join-Path $projectRoot "src\data\redeemCodes.json"
$outputTxtPath = Join-Path $projectRoot "generated-codes.txt"

function Generate-RandomCode {
    $chars = "abcdefghjkmnpqrstuvwxyz23456789"
    $part1 = -join ((1..4) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    $part2 = -join ((1..4) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return "orbis-$part1-$part2"
}

# Nếu chạy không tham số hoặc có cờ -Interactive, bật wizard hỏi đáp
if ($PSBoundParameters.Count -eq 0 -or $Interactive) {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " 🐾 ORBIS AGENT - CÔNG CỤ CẤP MÃ REDEEM CODE (CREATOR TOOL) 👑" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Chỉ có bạn (Creator) mới có quyền tạo mã cấp Skill và Treats.`n" -ForegroundColor Gray

    Write-Host "Chọn kiểu tạo mã:" -ForegroundColor White
    Write-Host " [1] Tạo mã ngẫu nhiên dạng 'orbis-xxxx-yyyy' (khuyên dùng khi phát hành hàng loạt)" -ForegroundColor Green
    Write-Host " [2] Nhập mã tự chọn (ví dụ: orbis-vip-2026, silo-special)" -ForegroundColor Yellow
    $modeChoice = Read-Host "Lựa chọn của bạn (1 hoặc 2) [Mặc định: 1]"
    if ([string]::IsNullOrWhiteSpace($modeChoice)) { $modeChoice = "1" }

    if ($modeChoice -eq "2") {
        $customCodeInput = Read-Host "Nhập mã tự chọn của bạn"
        if (![string]::IsNullOrWhiteSpace($customCodeInput)) {
            $Code = $customCodeInput.Trim().ToLower()
        }
    }

    $countInput = Read-Host "Số lượng mã muốn phát hành [Mặc định: 1]"
    if (![string]::IsNullOrWhiteSpace($countInput) -and [int]::TryParse($countInput, [ref]$Count)) {
        $Count = [Math]::Max(1, $Count)
    }

    $treatsInput = Read-Host "Số lượng bánh Treat thưởng kèm (🐟) [Mặc định: 150]"
    if (![string]::IsNullOrWhiteSpace($treatsInput) -and [int]::TryParse($treatsInput, [ref]$Treats)) {
        $Treats = [Math]::Max(0, $Treats)
    } else {
        $Treats = 150
    }

    $expInput = Read-Host "Số lượng EXP thưởng cho Mèo (⭐) [Mặc định: 50]"
    if (![string]::IsNullOrWhiteSpace($expInput) -and [int]::TryParse($expInput, [ref]$Exp)) {
        $Exp = [Math]::Max(0, $Exp)
    } else {
        $Exp = 50
    }

    Write-Host ""
    $attachSkill = Read-Host "Có muốn đính kèm Kỹ năng độc quyền cho Mèo không? (y/n) [Mặc định: n]"
    if ($attachSkill -eq "y" -or $attachSkill -eq "Y") {
        Write-Host "`nChọn nguồn kỹ năng:" -ForegroundColor White
        Write-Host " [1] Copy kỹ năng có sẵn từ ứng dụng của bạn" -ForegroundColor Cyan
        Write-Host " [2] Tự viết kỹ năng độc quyền mới" -ForegroundColor Yellow
        $skillSource = Read-Host "Lựa chọn (1 hoặc 2) [Mặc định: 1]"

        $defaultAppSkills = @(
            @{
                name = "Vệ sĩ Sandbox";
                trigger = "Khi phát hiện thao tác xóa tệp hàng loạt hoặc can thiệp registry";
                actionPrompt = "Tự động cô lập và điều hướng thực thi vào Detonation Sandbox (sandbox_exec) để bảo vệ hệ thống của người dùng.";
                category = "safety"
            },
            @{
                name = "Tác phong gọn gàng";
                trigger = "Khi báo cáo tiến độ và thông báo kết quả";
                actionPrompt = "Tránh giải thích lan man, chỉ trả về nội dung trọng tâm và kết quả súc tích.";
                category = "habit"
            },
            @{
                name = "Tự động sắp xếp gọn không gian làm việc";
                trigger = "Khi người dùng yêu cầu dọn dẹp hoặc màn hình quá bừa bộn";
                actionPrompt = "Thu gọn các cửa sổ nền không liên quan, định vị các app chính vào vị trí gọn gàng trên màn hình.";
                category = "macro"
            },
            @{
                name = "Bảo vệ mắt & Chống mệt mỏi ban đêm";
                trigger = "Khi làm việc vào ban đêm hoặc sau 22h";
                actionPrompt = "Tự động nhắc nhở chuyển giao diện nền tối và khuyên người dùng chớp mắt nghỉ ngơi.";
                category = "habit"
            }
        )

        if ($skillSource -ne "2") {
            Write-Host "`nDanh sách kỹ năng trong App của bạn:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $defaultAppSkills.Count; $i++) {
                Write-Host " [$($i+1)] $($defaultAppSkills[$i].name) ($($defaultAppSkills[$i].category))" -ForegroundColor White
            }
            $pickIdx = Read-Host "Chọn số thứ tự kỹ năng muốn copy (1-$($defaultAppSkills.Count))"
            $idx = 1
            [int]::TryParse($pickIdx, [ref]$idx) | Out-Null
            $idx = [Math]::Max(1, [Math]::Min($defaultAppSkills.Count, $idx)) - 1
            
            $SkillName = $defaultAppSkills[$idx].name
            $SkillTrigger = $defaultAppSkills[$idx].trigger
            $SkillPrompt = $defaultAppSkills[$idx].actionPrompt
            $SkillCategory = $defaultAppSkills[$idx].category
            Write-Host "-> Đã chọn copy kỹ năng: '$SkillName'" -ForegroundColor Green
        } else {
            $SkillName = Read-Host "Tên Kỹ năng mới (ví dụ: Siêu Trợ Lý Code)"
            $SkillTrigger = Read-Host "Điều kiện kích hoạt (ví dụ: Khi người dùng mở VS Code)"
            $SkillPrompt = Read-Host "Câu lệnh hành động AI (ví dụ: Tự động rà soát bug và gợi ý refactor ngắn gọn)"
            $SkillCategory = Read-Host "Phân loại (macro / habit / personality / safety) [Mặc định: macro]"
            if ([string]::IsNullOrWhiteSpace($SkillCategory)) { $SkillCategory = "macro" }
        }
    }
}

# Đọc file redeemCodes.json hiện tại
$currentCodes = @()
if (Test-Path $codesJsonPath) {
    try {
        $jsonContent = Get-Content -Path $codesJsonPath -Raw -Encoding UTF8
        $currentCodes = $jsonContent | ConvertFrom-Json
        if ($null -eq $currentCodes) { $currentCodes = @() }
    } catch {
        $currentCodes = @()
    }
}

$newCodesList = @()
$generatedCodeStrings = @()

for ($i = 0; $i -lt $Count; $i++) {
    $thisCode = ""
    if (![string]::IsNullOrWhiteSpace($Code) -and $Count -eq 1) {
        $thisCode = $Code.Trim().ToLower()
    } elseif (![string]::IsNullOrWhiteSpace($Code) -and $Count -gt 1) {
        $thisCode = "$($Code.Trim().ToLower())-$($i + 1)"
    } else {
        $thisCode = Generate-RandomCode
    }

    $codeObj = [ordered]@{
        code = $thisCode
        name = if (![string]::IsNullOrWhiteSpace($SkillName)) { "Mã Kỹ năng: $SkillName" } else { "Gói quà Creator ($Treats Treats)" }
        treats = $Treats
        exp = $Exp
        maxUses = 999999
    }

    if (![string]::IsNullOrWhiteSpace($SkillName)) {
        $skillId = "skill-exclusive-" + (Get-Random -Minimum 1000 -Maximum 9999) + "-" + (Get-Date -Format "mmss")
        $codeObj["skill"] = [ordered]@{
            id = $skillId
            name = $SkillName
            trigger = if ([string]::IsNullOrWhiteSpace($SkillTrigger)) { "Khi nhận yêu cầu liên quan" } else { $SkillTrigger }
            actionPrompt = $SkillPrompt
            category = $SkillCategory
            enabled = $true
        }
    }

    # Kiểm tra tránh trùng code trong danh sách
    $currentCodes = @($currentCodes | Where-Object { $_.code -ne $thisCode })
    $currentCodes += [PSCustomObject]$codeObj
    $newCodesList += [PSCustomObject]$codeObj
    $generatedCodeStrings += $thisCode
}

# Ghi lại vào redeemCodes.json
$updatedJson = $currentCodes | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($codesJsonPath, $updatedJson, [System.Text.Encoding]::UTF8)

# Xuất ra file generated-codes.txt
$exportText = @"
============================================================
🐾 DANH SÁCH MÃ REDEEM CODE VỪA TẠO - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
============================================================
Phần thưởng mỗi mã:
- Treats: $Treats 🐟
- EXP: $Exp ⭐
$(if (![string]::IsNullOrWhiteSpace($SkillName)) { "- Kỹ năng đính kèm: $SkillName ($SkillCategory)" } else { "" })

CÁC MÃ ĐÃ TẠO:
$($generatedCodeStrings -join "`r`n")

HƯỚNG DẪN NGƯỜI DÙNG NHẬP MÃ:
1. Chuột phải vào con mèo Orbis trên Desktop -> Chọn '🎁 Nhập Redeem Code'
2. Hoặc mở Dashboard Agent -> Tab 'Teach Cat' -> Chọn '🎁 Nhập Mã Đổi Thưởng'
3. Dán mã vào và bấm 'Đổi mã' để nhận ngay quà và kỹ năng!
============================================================
"@

[System.IO.File]::WriteAllText($outputTxtPath, $exportText, [System.Text.Encoding]::UTF8)

Write-Host "`n✅ ĐÃ TẠO THÀNH CÔNG $($Count) MÃ REDEEM CODE!" -ForegroundColor Green
Write-Host "Các mã vừa tạo:" -ForegroundColor Yellow
foreach ($c in $generatedCodeStrings) {
    Write-Host "  👉 $c" -ForegroundColor Cyan
}

if (![string]::IsNullOrWhiteSpace($SkillName)) {
    Write-Host "`n🎁 Kỹ năng độc quyền: '$SkillName'" -ForegroundColor Magenta
    Write-Host "   Điều kiện: $SkillTrigger" -ForegroundColor Gray
    Write-Host "   Hành động AI: $SkillPrompt" -ForegroundColor Gray
}

Write-Host "`n📁 Đã lưu vào:" -ForegroundColor White
Write-Host "   1. Ứng dụng: $codesJsonPath" -ForegroundColor Gray
Write-Host "   2. File xuất: $outputTxtPath" -ForegroundColor Gray
Write-Host "Người dùng chỉ cần nhập mã trên là nhận được ngay!`n" -ForegroundColor Green
