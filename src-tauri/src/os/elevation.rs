/// true nếu process đang chạy elevated (Run as administrator).
#[cfg(windows)]
pub fn is_admin() -> bool {
    use windows_sys::Win32::UI::Shell::IsUserAnAdmin;

    // SAFETY: hàm không nhận tham số và không có tiền điều kiện.
    unsafe { IsUserAnAdmin() != 0 }
}

#[cfg(not(windows))]
pub fn is_admin() -> bool {
    false
}
