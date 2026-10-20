use tauri::{AppHandle, Manager};

use crate::shell::overlay::{compute_layout, OverlayLayout, LABEL};

#[tauri::command]
pub async fn get_overlay_layout(app: AppHandle) -> Result<OverlayLayout, String> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or_else(|| "overlay window chưa được tạo".to_string())?;
    compute_layout(&window).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_overlay_interactive(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or_else(|| "overlay window chưa được tạo".to_string())?;

    window
        .set_ignore_cursor_events(!enabled)
        .map_err(|e| e.to_string())?;

    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        crate::shell::overlay::apply_win32_overlay_flags(hwnd.0 as _, enabled);
    }

    Ok(())
}

