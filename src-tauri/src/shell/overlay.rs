use serde::Serialize;
use tauri::{
    AppHandle, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

pub const LABEL: &str = "overlay";

/// Một màn hình, toạ độ physical px, gốc = góc trên-trái của overlay.
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

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_LAYERED, WS_EX_TRANSPARENT,
    },
};

/// Áp dụng cờ Win32:
/// - WS_EX_TRANSPARENT + WS_EX_LAYERED: click-through ở tầng Win32 khi không tương tác
#[cfg(windows)]
pub fn apply_win32_overlay_flags(hwnd: HWND, interactive: bool) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let new_style = if interactive {
            (ex_style | WS_EX_LAYERED as isize) & !(WS_EX_TRANSPARENT as isize)
        } else {
            ex_style | WS_EX_LAYERED as isize | WS_EX_TRANSPARENT as isize
        };
        if ex_style != new_style {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
        }
    }
}


/// Overlay trong suốt, luôn nổi trên cùng, click-through, phủ toàn bộ virtual desktop.
pub fn create(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("overlay.html".into()))
        .title("Orbis Overlay")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .build()?;

    // Cần window đã tồn tại mới hỏi được danh sách monitor.
    let layout = compute_layout(&window)?;
    window.set_position(PhysicalPosition::new(layout.origin_x, layout.origin_y))?;
    window.set_size(PhysicalSize::new(layout.width, layout.height))?;
    window.set_ignore_cursor_events(true)?;

    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        apply_win32_overlay_flags(hwnd.0 as _, false);
    }

    window.show()?;
    Ok(window)
}

/// Hợp của mọi monitor (bounding box) + vị trí từng monitor so với góc trên-trái của hợp đó.
pub fn compute_layout(window: &WebviewWindow) -> tauri::Result<OverlayLayout> {
    let monitors = window.available_monitors()?;
    if monitors.is_empty() {
        return Err(tauri::Error::Io(std::io::Error::other("không phát hiện monitor nào")));
    }
    let primary = window.primary_monitor()?;

    let left = monitors.iter().map(|m| m.position().x).min().unwrap_or(0);
    let top = monitors.iter().map(|m| m.position().y).min().unwrap_or(0);
    let right = monitors
        .iter()
        .map(|m| m.position().x + m.size().width as i32)
        .max()
        .unwrap_or(0);
    let bottom = monitors
        .iter()
        .map(|m| m.position().y + m.size().height as i32)
        .max()
        .unwrap_or(0);

    let infos = monitors
        .iter()
        .map(|m| MonitorInfo {
            name: m.name().cloned(),
            x: m.position().x - left,
            y: m.position().y - top,
            width: m.size().width,
            height: m.size().height,
            scale: m.scale_factor(),
            primary: primary
                .as_ref()
                .map_or(false, |p| p.position() == m.position() && p.size() == m.size()),
        })
        .collect();

    Ok(OverlayLayout {
        origin_x: left,
        origin_y: top,
        width: (right - left) as u32,
        height: (bottom - top) as u32,
        monitors: infos,
    })
}
