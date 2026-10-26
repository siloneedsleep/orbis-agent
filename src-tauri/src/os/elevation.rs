#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// true nếu process đang chạy elevated (Run as administrator).
#[cfg(windows)]
pub fn is_admin() -> bool {
    use windows_sys::Win32::UI::Shell::IsUserAnAdmin;

    // SAFETY: hàm không nhận tham số và không có tiền điều kiện.
    unsafe { IsUserAnAdmin() != 0 }
}

#[cfg(not(windows))]
pub fn is_admin() -> bool {
    false
}

/// Yêu cầu nâng quyền Administrator (UAC) và khởi động lại Orbis Agent với quyền Admin.
#[tauri::command(async)]
pub fn request_admin_elevation(app: tauri::AppHandle) -> Result<String, String> {
    if is_admin() {
        return Ok("Orbis Agent đã có quyền Administrator.".to_string());
    }

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe.to_string_lossy().replace('\'', "''");
    let script = format!("Start-Process -FilePath '{}' -Verb RunAs", exe_str);

    let mut cmd = std::process::Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let status = cmd
        .status()
        .map_err(|e| format!("Không thể kích hoạt UAC Administrator: {e}"))?;

    if status.success() {
        app.exit(0);
        Ok("Đang khởi động lại Orbis Agent với quyền Administrator...".to_string())
    } else {
        Err("Yêu cầu cấp quyền Administrator đã bị hủy.".to_string())
    }
}
