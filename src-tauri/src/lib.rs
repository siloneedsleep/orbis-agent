mod commands;
pub mod os;
mod shell;

use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Phải khớp với `EVENTS.wake` trong src/ipc/events.ts.
pub const EVENT_WAKE: &str = "orbis:wake";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let wake_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &wake_shortcut && event.state() == ShortcutState::Pressed {
                        let _ = app.emit(EVENT_WAKE, ());
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // `windows: []` trong tauri.conf.json: toàn bộ cửa sổ được tạo ở đây.
            shell::overlay::create(app.handle())?;
            shell::tray::create(app.handle())?;

            // Hotkey bị app khác chiếm thì không được làm sập app: vẫn còn tray để wake.
            if let Err(err) = app.global_shortcut().register(wake_shortcut) {
                eprintln!("[orbis] không đăng ký được hotkey Ctrl+Alt+Space: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::overlay::get_overlay_layout,
            commands::system::get_system_info,
            commands::system::open_dashboard,
            os::input::move_mouse_bezier,
            os::input::send_keystroke,
            os::input::setup_panic_hook,
            os::capture::capture_screen_region,
            os::ollama::ollama_chat,
            os::ollama::ollama_status,
            os::sandbox::start_sandbox_vm,
            os::sandbox::create_sandbox_checkpoint,
            os::sandbox::rollback_sandbox_checkpoint,
            os::sandbox::exec_in_sandbox,
            os::sandbox::place_vm_on_secondary_screen
        ])
        .run(tauri::generate_context!())
        .expect("lỗi khi chạy Orbis Agent");
}
