//! Ràng buộc: chỉ chạy trên Windows 11 (build >= 22000).

#[cfg(windows)]
mod imp {
    #[repr(C)]
    #[allow(non_snake_case)]
    struct OsVersionInfoExW {
        dw_os_version_info_size: u32,
        dw_major_version: u32,
        dw_minor_version: u32,
        dw_build_number: u32,
        dw_platform_id: u32,
        sz_csd_version: [u16; 128],
    }

    #[link(name = "ntdll")]
    extern "system" {
        fn RtlGetVersion(info: *mut OsVersionInfoExW) -> i32;
    }

    pub fn build_number() -> Option<u32> {
        let mut info = OsVersionInfoExW {
            dw_os_version_info_size: std::mem::size_of::<OsVersionInfoExW>() as u32,
            dw_major_version: 0, dw_minor_version: 0, dw_build_number: 0,
            dw_platform_id: 0, sz_csd_version: [0u16; 128],
        };
        // SAFETY: struct hợp lệ, size đúng API.
        let status = unsafe { RtlGetVersion(&mut info) };
        if status == 0 { Some(info.dw_build_number) } else { None }
    }

    pub fn show_error_dialog(title: &str, message: &str) {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            MessageBoxW, MB_ICONERROR, MB_OK, MB_TOPMOST,
        };
        let to_wide = |s: &str| -> Vec<u16> {
            std::ffi::OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
        };
        let w_title = to_wide(title);
        let w_msg = to_wide(message);
        // SAFETY: null-terminated, hwnd=0.
        unsafe { MessageBoxW(0, w_msg.as_ptr(), w_title.as_ptr(),
            MB_OK | MB_ICONERROR | MB_TOPMOST); }
    }
}

#[cfg(windows)]
pub fn ensure_windows_11() -> Result<u32, String> {
    let build = imp::build_number()
        .ok_or_else(|| "Không đọc được build number.".to_string())?;
    if build < 22_000 {
        return Err(format!(
            "Orbis Agent chỉ hỗ trợ Windows 11 (Build 22000 trở lên).\n\
             Hệ thống hiện tại: Build {build}.\n\
             Vui lòng nâng cấp hệ điều hành."
        ));
    }
    Ok(build)
}

#[cfg(windows)]
pub fn abort_with_dialog(message: &str) -> ! {
    imp::show_error_dialog("Orbis Agent — Không tương thích", message);
    std::process::exit(1);
}

#[cfg(not(windows))]
pub fn ensure_windows_11() -> Result<u32, String> {
    Err("Orbis Agent chỉ hỗ trợ Windows 11 (Build 22000 trở lên).".to_string())
}

#[cfg(not(windows))]
pub fn abort_with_dialog(message: &str) -> ! {
    eprintln!("[orbis] FATAL: {message}");
    std::process::exit(1);
}
