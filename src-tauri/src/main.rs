#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Chỉ enforce Win11 gate khi thực sự chạy trên Windows.
    #[cfg(windows)]
    match orbis_agent_lib::os::winver::ensure_windows_11() {
        Ok(build) => eprintln!("[orbis] Windows build {build} — OK"),
        Err(msg) => orbis_agent_lib::os::winver::abort_with_dialog(&msg),
    }
    orbis_agent_lib::run()
}
