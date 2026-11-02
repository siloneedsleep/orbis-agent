use enigo::{Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use rand::Rng;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::Emitter;
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

static PANIC_HOOK_RUNNING: AtomicBool = AtomicBool::new(false);
static ABORT_INPUT: AtomicBool = AtomicBool::new(false);

pub fn abort() {
    ABORT_INPUT.store(true, Ordering::SeqCst);
}
pub fn reset_abort() {
    ABORT_INPUT.store(false, Ordering::SeqCst);
}
pub fn is_aborted() -> bool {
    ABORT_INPUT.load(Ordering::SeqCst)
}

/// Mô phỏng di chuyển chuột mượt mà theo đường cong Bézier.
fn move_mouse_bezier_internal(target_x: i32, target_y: i32) -> Result<(), String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    if !monitors.iter().any(|m| {
        target_x as i64 >= m.x() as i64
            && target_y as i64 >= m.y() as i64
            && (target_x as i64) < m.x() as i64 + m.width() as i64
            && (target_y as i64) < m.y() as i64 + m.height() as i64
    }) {
        return Err("Tọa độ nằm ngoài các màn hình hiện có".into());
    }

    if is_aborted() {
        return Err("Đã dừng thao tác nhập".into());
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let mut pos = POINT { x: 0, y: 0 };

    unsafe {
        if GetCursorPos(&mut pos) == 0 {
            return Err("Không đọc được vị trí con trỏ".into());
        }
    }

    let start_x = pos.x;
    let start_y = pos.y;

    let mut rng = rand::thread_rng();
    let cp1_x = start_x + rng.gen_range(-100..100);
    let cp1_y = start_y + rng.gen_range(-100..100);
    let cp2_x = target_x + rng.gen_range(-100..100);
    let cp2_y = target_y + rng.gen_range(-100..100);

    let steps = 30;
    for i in 1..=steps {
        if ABORT_INPUT.load(Ordering::SeqCst) {
            return Err("Đã dừng thao tác nhập".into());
        }
        let t = i as f32 / steps as f32;

        let x = (1.0 - t).powi(3) * start_x as f32
            + 3.0 * (1.0 - t).powi(2) * t * cp1_x as f32
            + 3.0 * (1.0 - t) * t.powi(2) * cp2_x as f32
            + t.powi(3) * target_x as f32;

        let y = (1.0 - t).powi(3) * start_y as f32
            + 3.0 * (1.0 - t).powi(2) * t * cp1_y as f32
            + 3.0 * (1.0 - t) * t.powi(2) * cp2_y as f32
            + t.powi(3) * target_y as f32;

        enigo
            .move_mouse(x as i32, y as i32, Coordinate::Abs)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(rng.gen_range(5..15)));
    }
    Ok(())
}

#[tauri::command(async)]
pub fn move_mouse_bezier(x: i32, y: i32) -> Result<(), String> {
    move_mouse_bezier_internal(x, y)
}

/// Quy đổi toạ độ chuẩn hóa [0, 1000] sang pixel vật lý của màn hình mục tiêu
/// và di chuyển chuột theo đường cong Bézier mượt mà (Human-like).
#[tauri::command(async)]
pub fn move_mouse_normalized(
    app: tauri::AppHandle,
    norm_x: f32,
    norm_y: f32,
    monitor_name: Option<String>,
) -> Result<(), String> {
    use tauri::Manager;
    let window = app
        .get_webview_window(crate::shell::overlay::LABEL)
        .ok_or_else(|| "overlay window chưa được tạo".to_string())?;

    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Err("Không tìm thấy màn hình nào".to_string());
    }

    let target_mon = if let Some(name) = monitor_name {
        monitors
            .into_iter()
            .find(|m| m.name().map_or(false, |n| n == &name))
            .ok_or_else(|| "Không tìm thấy màn hình theo tên".to_string())?
    } else {
        window
            .primary_monitor()
            .map_err(|e| e.to_string())?
            .or_else(|| monitors.into_iter().next())
            .ok_or_else(|| "Không tìm thấy màn hình chính".to_string())?
    };

    let pos = target_mon.position();
    let size = target_mon.size();

    let clamped_x = norm_x.clamp(0.0, 1000.0);
    let clamped_y = norm_y.clamp(0.0, 1000.0);

    let target_x = pos.x + ((clamped_x / 1000.0) * size.width as f32) as i32;
    let target_y = pos.y + ((clamped_y / 1000.0) * size.height as f32) as i32;

    move_mouse_bezier_internal(target_x, target_y)?;
    Ok(())
}

#[tauri::command(async)]
pub fn send_keystroke(text: String) -> Result<(), String> {
    let automation = uiautomation::UIAutomation::new().map_err(|e| e.to_string())?;
    let focus = automation
        .get_focused_element()
        .map_err(|e| e.to_string())?;
    if focus.is_password().unwrap_or(true) {
        return Err("Không nhập văn bản vào trường mật khẩu".into());
    }

    if is_aborted() {
        return Err("Đã dừng thao tác nhập".into());
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let mut rng = rand::thread_rng();

    for c in text.chars() {
        if ABORT_INPUT.load(Ordering::SeqCst) {
            return Err("Đã dừng thao tác nhập".into());
        }
        match c {
            '\r' => continue,
            '\n' => {
                enigo
                    .key(Key::Return, Direction::Click)
                    .map_err(|e| e.to_string())?;
            }
            '\t' => {
                enigo
                    .key(Key::Tab, Direction::Click)
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                enigo.text(&c.to_string()).map_err(|e| e.to_string())?;
            }
        }
        thread::sleep(Duration::from_millis(rng.gen_range(25..75)));
    }
    Ok(())
}

#[tauri::command(async)]
pub fn mouse_click(button: String) -> Result<(), String> {
    if ABORT_INPUT.load(Ordering::SeqCst) {
        return Err("Đã dừng thao tác nhập".into());
    }
    if is_aborted() {
        return Err("Đã dừng thao tác nhập".into());
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    match button.as_str() {
        "right" => {
            enigo
                .button(Button::Right, Direction::Click)
                .map_err(|e| e.to_string())?;
        }
        "middle" => {
            enigo
                .button(Button::Middle, Direction::Click)
                .map_err(|e| e.to_string())?;
        }
        "double" => {
            enigo
                .button(Button::Left, Direction::Click)
                .map_err(|e| e.to_string())?;
            thread::sleep(Duration::from_millis(60));
            enigo
                .button(Button::Left, Direction::Click)
                .map_err(|e| e.to_string())?;
        }
        _ => {
            enigo
                .button(Button::Left, Direction::Click)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn setup_panic_hook(app: tauri::AppHandle) {
    if PANIC_HOOK_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    println!("Panic hook ready: Listening for 3x ESC presses");

    std::thread::spawn(move || {
        let mut esc_count = 0;
        let mut escape_was_down = false;
        let mut last_press_time = std::time::Instant::now();

        loop {
            let escape_down =
                unsafe { windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(0x1B) }
                    < 0;
            let just_pressed = escape_down && !escape_was_down;
            escape_was_down = escape_down;
            if just_pressed {
                let now = std::time::Instant::now();
                if now.duration_since(last_press_time).as_millis() < 1500 {
                    esc_count += 1;
                } else {
                    esc_count = 1;
                }
                last_press_time = now;

                if esc_count >= 3 {
                    println!("[ORBIS] PANIC TRIGGERED! Stopping active agent tasks...");
                    ABORT_INPUT.store(true, Ordering::SeqCst);
                    use tauri::Manager;
                    if let Some(engine) = app.try_state::<crate::agent::Engine>() {
                        engine.stop();
                    }
                    let _ = app.emit("orbis:panic", ());
                    esc_count = 0;
                }
            }
            thread::sleep(Duration::from_millis(10));
        }
    });
}
