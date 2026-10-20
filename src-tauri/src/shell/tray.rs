use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter,
};

use crate::EVENT_WAKE;

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let wake = MenuItem::with_id(app, "wake", "Wake / sleep The Core", true, None::<&str>)?;
    let dashboard = MenuItem::with_id(app, "dashboard", "Open dashboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&wake, &dashboard, &quit])?;

    let mut builder = TrayIconBuilder::with_id("orbis-tray")
        .tooltip("Orbis Agent")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "wake" => {
                let _ = app.emit(EVENT_WAKE, ());
            }
            "dashboard" => {
                let _ = super::dashboard::show(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = tray.app_handle().emit(EVENT_WAKE, ());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
