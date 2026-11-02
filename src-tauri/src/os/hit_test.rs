use serde::Deserialize;
use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    Mutex,
};
use std::time::{Duration, Instant};
use tauri::Manager;
use windows_sys::Win32::{
    Foundation::POINT,
    UI::{
        Input::KeyboardAndMouse::GetAsyncKeyState,
        WindowsAndMessaging::{GetCursorPos, GetForegroundWindow, GetWindowThreadProcessId},
    },
};

static LAST_EXTERNAL: AtomicIsize = AtomicIsize::new(0);

#[derive(Clone, Debug, Deserialize)]
pub struct InteractiveRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl InteractiveRect {
    fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && y >= self.y && x < self.x + self.width && y < self.y + self.height
    }
}

pub struct HitTestState {
    regions: Mutex<(Vec<InteractiveRect>, Instant)>,
    pub suspended: AtomicBool,
}

impl Default for HitTestState {
    fn default() -> Self {
        Self {
            regions: Mutex::new((vec![], Instant::now())),
            suspended: AtomicBool::new(false),
        }
    }
}

pub fn external_window() -> isize {
    LAST_EXTERNAL.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn update_interactive_rects(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, HitTestState>,
    rects: Vec<InteractiveRect>,
) -> Result<(), String> {
    if window.label() != "overlay" {
        return Err("Only overlay can register hit regions".into());
    }
    if rects.len() > 256
        || rects.iter().any(|r| {
            ![r.x, r.y, r.width, r.height].iter().all(|v| v.is_finite())
                || r.width < 0.0
                || r.height < 0.0
        })
    {
        return Err("Invalid interactive regions".into());
    }
    *state.regions.lock().unwrap() = (rects, Instant::now());
    Ok(())
}

pub fn set_interactive(window: &tauri::WebviewWindow, enabled: bool) {
    let _ = window.set_ignore_cursor_events(!enabled);
    if let Ok(hwnd) = window.hwnd() {
        crate::shell::overlay::apply_win32_overlay_flags(hwnd.0 as _, enabled);
    }
}

pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut interactive = false;
        loop {
            let Some(window) = app.get_webview_window("overlay") else {
                break;
            };
            let foreground = unsafe { GetForegroundWindow() };
            let mut pid = 0;
            unsafe {
                GetWindowThreadProcessId(foreground, &mut pid);
            }
            if !foreground.is_null() && pid != std::process::id() {
                LAST_EXTERNAL.store(foreground as isize, Ordering::Relaxed);
            }
            let mut cursor = POINT { x: 0, y: 0 };
            let valid = unsafe { GetCursorPos(&mut cursor) } != 0;
            let left_down = unsafe { GetAsyncKeyState(1) } < 0;
            let state = app.state::<HitTestState>();
            let inside =
                if let (Ok(origin), Ok(scale)) = (window.inner_position(), window.scale_factor()) {
                    let regions = state.regions.lock().unwrap();
                    valid
                        && regions.1.elapsed() < Duration::from_secs(2)
                        && regions.0.iter().any(|r| {
                            r.contains(
                                (cursor.x - origin.x) as f64 / scale,
                                (cursor.y - origin.y) as f64 / scale,
                            )
                        })
                } else {
                    false
                };
            let next =
                !state.suspended.load(Ordering::SeqCst) && (inside || (interactive && left_down));
            if next != interactive {
                set_interactive(&window, next);
                interactive = next;
            }
            std::thread::sleep(Duration::from_millis(25));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn half_open_hit_regions_include_negative_coordinates() {
        let rect = InteractiveRect {
            x: -30.0,
            y: 20.0,
            width: 10.0,
            height: 15.0,
        };
        assert!(rect.contains(-30.0, 20.0));
        assert!(!rect.contains(-20.0, 20.0));
        assert!(!rect.contains(-25.0, 35.0));
    }
}
