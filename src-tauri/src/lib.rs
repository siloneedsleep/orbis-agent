pub mod os;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            os::input::move_mouse_bezier,
            os::input::send_keystroke,
            os::input::setup_panic_hook,
            os::capture::capture_screen_region
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
