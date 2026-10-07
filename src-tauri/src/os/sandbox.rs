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
