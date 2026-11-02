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

    let builder = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("dashboard.html".into()))
        .title("Orbis Agent - Workspace")
        .inner_size(1180.0, 760.0)
        .min_inner_size(840.0, 580.0)
        .center();
    #[cfg(debug_assertions)]
    let builder = if let Some(directory) = std::env::var_os("ORBIS_DATA_DIR") {
        builder.data_directory(std::path::PathBuf::from(directory).join("webview"))
    } else {
        builder
    };
    builder.build()?;
    Ok(())
}
