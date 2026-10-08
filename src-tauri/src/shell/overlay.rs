use serde::Serialize;
use tauri::{
    AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    PhysicalPosition, PhysicalSize,
};

pub const LABEL: &str = "overlay";

/// Một màn hình, toạ độ physical px, gốc = gốc trên-trái của overlay.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub primary: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OverlayLayout {
    pub origin_x: i32,
    pub origin_y: i32,
    pub width: u32,
    pub height: u32,
    pub monitors: Vec<MonitorInfo>,
}

/// Overlay trong suốt, luôn nổi trên cùng, click-through, phủ toàn bộ virtual desktop.
pub fn create(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("overlay.html".into()))
        .title("Orbis Overlay")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .build()?;

    Ok(window)
}
