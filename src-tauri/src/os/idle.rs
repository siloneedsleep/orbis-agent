/// Số mili-giây kể từ lần nhập chuột/phím cuối (GetLastInputInfo).
#[cfg(windows)]
pub fn idle_ms() -> u64 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };

    // SAFETY: `info` là struct hợp lệ, cbSize đã đặt đúng như API yêu cầu.
    let ok = unsafe { GetLastInputInfo(&mut info) };
    if ok == 0 {
        return 0;
    }

    // Tick counter 32-bit tràn sau ~49 ngày: dùng wrapping_sub để vẫn ra đúng hiệu.
    let now = unsafe { GetTickCount() };
    u64::from(now.wrapping_sub(info.dwTime))
}

#[cfg(not(windows))]
pub fn idle_ms() -> u64 {
    0
}
