use std::os::windows::process::CommandExt;
use std::process::Command;

const VM_NAME: &str = "Orbis-DetonationLab";
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Chuỗi literal trong PowerShell: bọc nháy đơn, nháy đơn bên trong nhân đôi.
/// Bắt buộc với mọi giá trị đến từ frontend, nếu không là command injection.
fn ps_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

// Các command dưới đây chạy PowerShell (vài giây): `command(async)` để không chặn main thread.

#[tauri::command(async)]
pub fn start_sandbox_vm() -> Result<String, String> {
    let vm = ps_quote(VM_NAME);
    let script = format!(
        "if ((Get-VM -Name {vm}).State -ne 'Running') {{ Start-VM -Name {vm} }}"
    );
    run_powershell(&script)
}

#[tauri::command(async)]
pub fn create_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let script = format!(
        "Checkpoint-VM -Name {} -SnapshotName {}",
        ps_quote(VM_NAME),
        ps_quote(&snapshot_name)
    );
    run_powershell(&script)
}

#[tauri::command(async)]
pub fn rollback_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let script = format!(
        "Restore-VMCheckpoint -VMName {} -Name {} -Confirm:$false",
        ps_quote(VM_NAME),
        ps_quote(&snapshot_name)
    );
    run_powershell(&script)
}

#[tauri::command(async)]
pub fn exec_in_sandbox(guest_cmd: String) -> Result<String, String> {
    // Lệnh được chạy bên trong VM (PowerShell Direct); truyền qua chuỗi đã escape thay vì
    // nối thẳng vào { } để không thoát được khỏi ScriptBlock.
    let script = format!(
        "Invoke-Command -VMName {} -ScriptBlock ([scriptblock]::Create({}))",
        ps_quote(VM_NAME),
        ps_quote(&guest_cmd)
    );
    run_powershell(&script)
}

/// Phát hiện màn hình phụ và di chuyển cửa sổ kết nối VM (vmconnect) sang đó
#[tauri::command(async)]
pub fn place_vm_on_secondary_screen() -> Result<String, String> {
    let script = r##"
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class WinHelper {
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
Add-Type -AssemblyName System.Windows.Forms

$result = "Single monitor mode active."
$screens = [System.Windows.Forms.Screen]::AllScreens
if ($screens.Count -gt 1) {
    # Lấy màn hình không phải Primary
    $targetScreen = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1

    # Mở cửa sổ kết nối VM nếu chưa mở
    Start-Process vmconnect.exe -ArgumentList "localhost", "Orbis-DetonationLab"
    Start-Sleep -Milliseconds 1200

    $proc = Get-Process vmconnect -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
        $bounds = $targetScreen.WorkingArea
        [WinHelper]::MoveWindow($proc.MainWindowHandle, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, $true) | Out-Null
        [WinHelper]::ShowWindow($proc.MainWindowHandle, 3) | Out-Null # SW_MAXIMIZE
        $result = "Moved VM window to secondary display."
    }
} else {
    # Chỉ có 1 màn hình: Mở kết nối bình thường
    Start-Process vmconnect.exe -ArgumentList "localhost", "Orbis-DetonationLab"
}
Write-Output $result
"##;
    run_powershell(script)
}

fn run_powershell(script: &str) -> Result<String, String> {
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
