use std::thread;
use std::time::Duration;
// Lưu ý: Cần thêm crate `enigo` hoặc `windows` vào Cargo.toml để chạy thật.
// Đây là bộ khung chuẩn bị sẵn cho Tauri Commands.

#[tauri::command]
pub fn move_mouse_bezier(x: i32, y: i32) {
    println!("Moving mouse to ({}, {}) using Bezier curve...", x, y);
    // Logic nội suy quỹ đạo cong Fitts's Law sẽ nằm ở đây
    thread::sleep(Duration::from_millis(150)); 
}

#[tauri::command]
pub fn send_keystroke(text: String) {
    println!("Typing: {}", text);
    // Vòng lặp gõ phím với độ trễ ngẫu nhiên (40-130ms) mô phỏng người thật
    for c in text.chars() {
        thread::sleep(Duration::from_millis(70)); 
    }
}

#[tauri::command]
pub fn setup_panic_hook() {
    println!("Panic hook ready: Listening for 3x ESC presses");
    // Hook global keyboard event. Nếu count(Esc) == 3 -> std::process::exit(0) hoặc ngắt loop.
}
