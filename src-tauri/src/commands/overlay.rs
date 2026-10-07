use tauri::{AppHandle, Manager};

use crate::shell::overlay::{compute_layout, OverlayLayout, LABEL};

#[tauri::command]
pub async fn get_overlay_layout(app: AppHandle) -> Result<OverlayLayout, String> {
    let window = app
        .get_webview_window(LABEL)
        .ok_or_else(|| "overlay window chưa được tạo".to_string())?;
    compute_layout(&window).map_err(|e| e.to_string())
}
