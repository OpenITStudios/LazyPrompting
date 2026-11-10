pub(crate) fn confirm(owner: usize, title: &str, message: &str) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONQUESTION, MB_YESNO,
    };
    let title: Vec<u16> = title.encode_utf16().chain([0]).collect();
    let message: Vec<u16> = message.encode_utf16().chain([0]).collect();
    unsafe {
        MessageBoxW(
            owner as _,
            message.as_ptr(),
            title.as_ptr(),
            MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2,
        ) == IDYES
    }
}
