use std::thread;
use std::time::Duration;
// Bộ khung cho Tauri Commands; chưa gửi input thật.
//
// `command(async)`: command đồng bộ mặc định chạy trên main thread, mà các hàm dưới đây
// ngủ hàng trăm ms, nên phải đẩy sang thread pool kẻo đơ cả UI.

#[tauri::command(async)]
pub fn move_mouse_bezier(x: i32, y: i32) {
    println!("Moving mouse to ({}, {}) using Bezier curve...", x, y);
    // Logic nội suy quỹ đạo cong Fitts's Law sẽ nằm ở đây
    thread::sleep(Duration::from_millis(150));
}

#[tauri::command(async)]
pub fn send_keystroke(text: String) {
    println!("Typing: {}", text);
    // Vòng lặp gõ phím với độ trễ ngẫu nhiên (40-130ms) mô phỏng người thật
    for _c in text.chars() {
        thread::sleep(Duration::from_millis(70));
    }
}

#[tauri::command]
pub fn setup_panic_hook() {
    println!("Panic hook ready: Listening for 3x ESC presses");
    // Hook global keyboard event. Nếu count(Esc) == 3 -> std::process::exit(0) hoặc ngắt loop.
}
