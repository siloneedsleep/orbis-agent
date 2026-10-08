use serde::Serialize;
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

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

/// Tính toán bounding box bao phủ toàn bộ các màn hình hiện có.
pub fn compute_layout(window: &WebviewWindow) -> Result<OverlayLayout, String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Ok(OverlayLayout {
            origin_x: 0,
            origin_y: 0,
            width: 1920,
            height: 1080,
            monitors: vec![],
        });
    }

    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    for m in &monitors {
        let pos = m.position();
        let size = m.size();
        min_x = min_x.min(pos.x);
        min_y = min_y.min(pos.y);
        max_x = max_x.max(pos.x + size.width as i32);
        max_y = max_y.max(pos.y + size.height as i32);
    }

    let primary_monitor = window.primary_monitor().ok().flatten();
    let primary_name = primary_monitor.and_then(|m| m.name().cloned());

    let monitor_infos = monitors
        .into_iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let is_primary = m.name().is_some() && m.name() == primary_name.as_ref();
            MonitorInfo {
                name: m.name().cloned(),
                x: pos.x - min_x,
                y: pos.y - min_y,
                width: size.width,
                height: size.height,
                scale: m.scale_factor(),
                primary: is_primary,
            }
        })
        .collect();

    Ok(OverlayLayout {
        origin_x: min_x,
        origin_y: min_y,
        width: (max_x - min_x).max(0) as u32,
        height: (max_y - min_y).max(0) as u32,
        monitors: monitor_infos,
    })
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
