use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "dashboard";

/// Mở dashboard; nếu đã có thì đưa lên trước.
pub fn show(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(LABEL) {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("dashboard.html".into()))
        .title("Orbis Agent")
        .inner_size(760.0, 640.0)
        .min_inner_size(560.0, 420.0)
        .center()
        .build()?;
    Ok(())
}
