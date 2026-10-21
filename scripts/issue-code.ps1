<#
.SYNOPSIS
    Orbis Agent - Công cụ cấp Redeem Code độc quyền (Creator Tool)
.DESCRIPTION
    Tạo mã ngẫu nhiên dạng orbis-xxxx-yyyy hoặc mã tự chọn.
    Chỉ định phần thưởng: Treats, EXP, và Kỹ năng độc quyền (copy từ app hoặc tạo mới).
    Tự động mã hóa toàn bộ dữ liệu bằng AES-256 và chèn vào biến ENCRYPTED_REDEEM_VAULT
    trong src/services/redeemService.ts trước khi đẩy lên GitHub.
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
$redeemServicePath = Join-Path $projectRoot "src\services\redeemService.ts"
$outputTxtPath = Join-Path $projectRoot "generated-codes.txt"
$vaultSalt = "orbis_master_vault_key_2026"

function Generate-RandomCode {
    $chars = "abcdefghjkmnpqrstuvwxyz23456789"
    $part1 = -join ((1..4) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    $part2 = -join ((1..4) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return "orbis-$part1-$part2"
}

function Decrypt-Vault ([string]$b64Cipher, [string]$salt) {
    if ([string]::IsNullOrWhiteSpace($b64Cipher)) { return @() }
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $key = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($salt))
        $ivHash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($salt + "::orbis_iv_salt_2026"))
        $iv = New-Object byte[] 16
        [Array]::Copy($ivHash, 0, $iv, 0, 16)

        $aes = [System.Security.Cryptography.Aes]::Create()
        $aes.Key = $key
        $aes.IV = $iv
        $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7

        $cipherBytes = [Convert]::FromBase64String($b64Cipher)
        $dec = $aes.CreateDecryptor()
        $decryptedBytes = $dec.TransformFinalBlock($cipherBytes, 0, $cipherBytes.Length)
        $jsonStr = [System.Text.Encoding]::UTF8.GetString($decryptedBytes)
        $parsed = $jsonStr | ConvertFrom-Json
        if ($null -eq $parsed) { return @() }
        return @($parsed)
    } catch {
        Write-Warning "Không thể giải mã Vault cũ, sẽ khởi tạo danh sách mới: $_"
        return @()
    }
}

function Encrypt-Vault ($codesList, [string]$salt) {
    $json = $codesList | ConvertTo-Json -Depth 6
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $key = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($salt))
    $ivHash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($salt + "::orbis_iv_salt_2026"))
    $iv = New-Object byte[] 16
    [Array]::Copy($ivHash, 0, $iv, 0, 16)

    $aes = [System.Security.Cryptography.Aes]::Create()
    $aes.Key = $key
    $aes.IV = $iv
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7

    $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $enc = $aes.CreateEncryptor()
    $cipherBytes = $enc.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)
    return [Convert]::ToBase64String($cipherBytes)
}

# Nếu chạy không tham số hoặc có cờ -Interactive, bật wizard hỏi đáp
if ($PSBoundParameters.Count -eq 0 -or $Interactive) {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " 🐾 ORBIS AGENT - CÔNG CỤ CẤP MÃ REDEEM CODE (CREATOR TOOL) 👑" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Mọi mã phát hành sẽ tự động được MÃ HÓA AES-256 vào file mã nguồn`ntrước khi đẩy lên GitHub để bảo vệ bản quyền.`n" -ForegroundColor Gray

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

# Đọc file src/services/redeemService.ts và giải mã ENCRYPTED_REDEEM_VAULT hiện tại
if (-not (Test-Path $redeemServicePath)) {
    throw "Không tìm thấy file $redeemServicePath"
}

$serviceContent = [System.IO.File]::ReadAllText($redeemServicePath, [System.Text.Encoding]::UTF8)
$existingVaultB64 = ""
if ($serviceContent -match 'export const ENCRYPTED_REDEEM_VAULT = "([^"]+)";') {
    $existingVaultB64 = $matches[1]
}

$currentCodes = @(Decrypt-Vault $existingVaultB64 $vaultSalt)
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

    # Tránh trùng mã cũ
    $currentCodes = @($currentCodes | Where-Object { $_.code -ne $thisCode })
    $currentCodes += [PSCustomObject]$codeObj
    $generatedCodeStrings += $thisCode
}

# Mã hóa toàn bộ danh sách thành 1 chuỗi duy nhất bằng AES-256
$newEncryptedVault = Encrypt-Vault $currentCodes $vaultSalt

# Thay thế biến duy nhất ENCRYPTED_REDEEM_VAULT trong src/services/redeemService.ts
$pattern = 'export const ENCRYPTED_REDEEM_VAULT = "[^"]*";'
$replacement = "export const ENCRYPTED_REDEEM_VAULT = `"$newEncryptedVault`";"
$updatedServiceContent = [System.Text.RegularExpressions.Regex]::Replace($serviceContent, $pattern, $replacement)
[System.IO.File]::WriteAllText($redeemServicePath, $updatedServiceContent, [System.Text.Encoding]::UTF8)

# Xuất file danh sách rõ (chỉ lưu cục bộ cho Creator copy)
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

Write-Host "`n🔒 ĐÃ MÃ HÓA & CẬP NHẬT BIẾN 'ENCRYPTED_REDEEM_VAULT' TRONG REDEEMSERVICE.TS!" -ForegroundColor Green
Write-Host "Tổng số mã đang được lưu trữ trong Vault mã hóa: $($currentCodes.Count)" -ForegroundColor Cyan
Write-Host "`nCác mã vừa tạo:" -ForegroundColor Yellow
foreach ($c in $generatedCodeStrings) {
    Write-Host "  👉 $c" -ForegroundColor Cyan
}

if (![string]::IsNullOrWhiteSpace($SkillName)) {
    Write-Host "`n🎁 Kỹ năng độc quyền: '$SkillName'" -ForegroundColor Magenta
    Write-Host "   Điều kiện: $SkillTrigger" -ForegroundColor Gray
    Write-Host "   Hành động AI: $SkillPrompt" -ForegroundColor Gray
}

Write-Host "`n📁 Tệp xuất chỉ lưu trên máy bạn: $outputTxtPath" -ForegroundColor Gray
Write-Host "Khi push lên GitHub, toàn bộ mã sẽ được che giấu trong biến mã hóa duy nhất!`n" -ForegroundColor Green
