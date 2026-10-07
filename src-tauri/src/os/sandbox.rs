use std::process::Command;
use std::os::windows::process::CommandExt;

const VM_NAME: &str = "Orbis-DetonationLab";
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn start_sandbox_vm() -> Result<String, String> {
    let script = format!(
        "if ((Get-VM -Name '{}').State -ne 'Running') {{ Start-VM -Name '{}' }}",
        VM_NAME, VM_NAME
    );
    run_powershell(&script)
}

#[tauri::command]
pub fn create_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let script = format!(
        "Checkpoint-VM -Name '{}' -SnapshotName '{}'",
        VM_NAME, snapshot_name
    );
    run_powershell(&script)
}

#[tauri::command]
pub fn rollback_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let script = format!(
        "Restore-VMCheckpoint -Name '{}' -Name '{}' -Confirm:$false",
        VM_NAME, snapshot_name
    );
    run_powershell(&script)
}

#[tauri::command]
pub fn exec_in_sandbox(guest_cmd: String) -> Result<String, String> {
    let script = format!(
        "Invoke-Command -VMName '{}' -ScriptBlock {{ {} }}",
        VM_NAME, guest_cmd
    );
    run_powershell(&script)
}

/// Phát hiện màn hình phụ và di chuyển cửa sổ kết nối VM (vmconnect) sang đó
#[tauri::command]
pub fn place_vm_on_secondary_screen() -> Result<String, String> {
    let script = r#"
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class WinHelper {
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
Add-Type -AssemblyName System.Windows.Forms

$screens = [System.Windows.Forms.Screen]::AllScreens
if ($screens.Count -gt 1) {
    # Lấy màn hình không phải Primary
    $targetScreen = $screens \vert{} Where-Object { -not$_.Primary } | Select-Object -First 1
    
    # Mở cửa sổ kết nối VM nếu chưa mở
    Start-Process vmconnect.exe -ArgumentList "localhost", "Orbis-DetonationLab"
    Start-Sleep -Milliseconds 1200
    
    $proc = Get-Process vmconnect -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc -and$proc.MainWindowHandle -ne [IntPtr]::Zero) {
        $bounds =$targetScreen.WorkingArea
        [WinHelper]::MoveWindow($proc.MainWindowHandle, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, $true)
        [WinHelper]::ShowWindow($proc.MainWindowHandle, 3) # SW_MAXIMIZE
        return "Moved VM window to secondary display."
    }
} else {
    # Chỉ có 1 màn hình: Mở kết nối bình thường
    Start-Process vmconnect.exe -ArgumentList "localhost", "Orbis-DetonationLab"
}
return "Single monitor mode active."
"#;
    run_powershell(script)
}

fn run_powershell(script: &str) -> Result<String, String> {
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
