mod agent;
mod commands;
mod llm;
pub mod os;
mod shell;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Phải khớp với `EVENTS.wake` trong src/ipc/events.ts.
pub const EVENT_WAKE: &str = "orbis:wake";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let wake_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);

    tauri::Builder::default()
        .manage(os::capture::FrameCache::default())
        .manage(os::hit_test::HitTestState::default())
        .register_asynchronous_uri_scheme_protocol("orbis", |context, request, responder| {
            let app = context.app_handle().clone();
            std::thread::spawn(move || responder.respond(shell::protocol::respond(&app, request)));
        })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &wake_shortcut && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("overlay") {
                            let _ = window.set_focus();
                        }
                        let _ = app.emit(EVENT_WAKE, ());
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let data_dir = {
                #[cfg(debug_assertions)]
                {
                    std::env::var_os("ORBIS_DATA_DIR")
                        .map(std::path::PathBuf::from)
                        .unwrap_or(app.path().app_data_dir()?)
                }
                #[cfg(not(debug_assertions))]
                {
                    app.path().app_data_dir()?
                }
            };
            let engine = agent::Engine::new(data_dir.join("memory-v1.json"))?;
            app.manage(engine);
            // Dashboard is a view; closing it never stops the native engine.
            shell::dashboard::show(app.handle())?;
            shell::overlay::create(app.handle())?;
            shell::tray::create(app.handle())?;
            os::hit_test::start(app.handle().clone());
            os::input::setup_panic_hook(app.handle().clone());

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
            commands::system::check_ollama_daemon,
            commands::system::trigger_n8n_webhook,
            commands::system::read_system_mcp_config,
            os::input::setup_panic_hook,
            os::capture::capture_screen_region,
            os::ollama::ollama_status,
            os::ollama::start_ollama_server,
            os::ollama::validate_cloud_api_key,
            os::sandbox::start_sandbox_vm,
            os::sandbox::create_sandbox_checkpoint,
            os::sandbox::rollback_sandbox_checkpoint,
            os::sandbox::place_vm_on_secondary_screen,
            os::elevation::request_admin_elevation,
            os::pet::get_pet_info,
            os::hit_test::update_interactive_rects,
            commands::agent::subscribe_agent,
            commands::agent::put_setting,
            commands::agent::import_legacy_settings,
            commands::agent::start_agent,
            commands::agent::stop_agent,
            commands::agent::approve_action,
            commands::agent::clear_workstream,
            commands::agent::mcp_list,
            commands::agent::mcp_execute
        ])
        .run(tauri::generate_context!())
        .expect("lỗi khi chạy Orbis Agent");
}
