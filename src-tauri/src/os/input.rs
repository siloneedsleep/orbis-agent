use std::thread;
use std::time::Duration;
use enigo::{Button, Coordinate, Direction, Enigo, Keyboard, Mouse, Settings};
use rand::Rng;
use tauri::Emitter;
use windows_sys::Win32::Foundation::POINT;
use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

/// Mô phỏng di chuyển chuột mượt mà theo đường cong Bézier.
fn move_mouse_bezier_internal(target_x: i32, target_y: i32) {
    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(_) => return,
    };
    let mut pos = POINT { x: 0, y: 0 };
    
    unsafe {
        if GetCursorPos(&mut pos) == 0 {
            return;
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
        let t = i as f32 / steps as f32;
        
        let x = (1.0 - t).powi(3) * start_x as f32
               + 3.0 * (1.0 - t).powi(2) * t * cp1_x as f32
               + 3.0 * (1.0 - t) * t.powi(2) * cp2_x as f32
               + t.powi(3) * target_x as f32;
               
        let y = (1.0 - t).powi(3) * start_y as f32
               + 3.0 * (1.0 - t).powi(2) * t * cp1_y as f32
               + 3.0 * (1.0 - t) * t.powi(2) * cp2_y as f32
               + t.powi(3) * target_y as f32;

        let _ = enigo.move_mouse(x as i32, y as i32, Coordinate::Abs);
        thread::sleep(Duration::from_millis(rng.gen_range(5..15)));
    }
}

#[tauri::command(async)]
pub fn move_mouse_bezier(x: i32, y: i32) {
    move_mouse_bezier_internal(x, y);
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

    move_mouse_bezier_internal(target_x, target_y);
    Ok(())
}

#[tauri::command(async)]
pub fn send_keystroke(text: String) {
    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(_) => return,
    };
    let mut rng = rand::thread_rng();
    
    for c in text.chars() {
        let _ = enigo.text(&c.to_string());
        thread::sleep(Duration::from_millis(rng.gen_range(30..90)));
    }
}

#[tauri::command(async)]
pub fn mouse_click(button: String) {
    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(_) => return,
    };
    let btn = match button.as_str() {
        "right" => Button::Right,
        _ => Button::Left,
    };
    let _ = enigo.button(btn, Direction::Click);
}

static PANIC_HOOK_RUNNING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub fn setup_panic_hook(app: tauri::AppHandle) {
    if PANIC_HOOK_RUNNING.swap(true, std::sync::atomic::Ordering::SeqCst) {
        return;
    }
    println!("Panic hook ready: Listening for 3x ESC presses");
    
    std::thread::spawn(move || {
        let mut esc_count = 0;
        let mut last_press_time = std::time::Instant::now();
        
        loop {
            // VK_ESCAPE = 0x1B
            if unsafe { windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState(0x1B) as u16 & 0x0001 } != 0 {
                let now = std::time::Instant::now();
                if now.duration_since(last_press_time).as_millis() < 1500 {
                    esc_count += 1;
                } else {
                    esc_count = 1;
                }
                last_press_time = now;

                if esc_count >= 3 {
                    println!("[ORBIS] PANIC TRIGGERED! Stopping active agent tasks...");
                    let _ = app.emit("orbis:panic", ());
                    esc_count = 0;
                }
            }
            thread::sleep(Duration::from_millis(10));
        }
    });
}

