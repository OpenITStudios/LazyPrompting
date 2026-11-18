use std::sync::{Mutex, MutexGuard, TryLockError};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    MessageBoxW, IDNO, IDYES, MB_DEFBUTTON2, MB_ICONQUESTION, MB_YESNO,
};

// One modal at a time. Do not queue permission prompts that may become stale.
static ACTIVE_DIALOG: Mutex<()> = Mutex::new(());

fn acquire_dialog(lock: &Mutex<()>) -> Result<MutexGuard<'_, ()>, &'static str> {
    match lock.try_lock() {
        Ok(guard) => Ok(guard),
        Err(TryLockError::WouldBlock) => Err("OPERATOR_DIALOG_BUSY"),
        Err(TryLockError::Poisoned(_)) => Err("OPERATOR_DIALOG_UNAVAILABLE"),
    }
}

fn classify_response(response: i32) -> Result<bool, &'static str> {
    match response {
        IDYES => Ok(true),
        IDNO => Ok(false),
        _ => Err("OPERATOR_DIALOG_UNAVAILABLE"),
    }
}

// Only an explicit Yes or No is a user decision. Busy/failed dialogs
// must never persist as a decline or authorize an action.
pub(crate) fn confirm(owner: usize, title: &str, message: &str) -> Result<bool, &'static str> {
    let _dialog = acquire_dialog(&ACTIVE_DIALOG)?;
    let title: Vec<u16> = title.encode_utf16().chain([0]).collect();
    let message: Vec<u16> = message.encode_utf16().chain([0]).collect();
    let response = unsafe {
        MessageBoxW(
            owner as _,
            message.as_ptr(),
            title.as_ptr(),
            MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2,
        )
    };
    classify_response(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn busy_modal_is_an_error_not_a_decline() {
        let lock = Mutex::new(());
        let held = acquire_dialog(&lock).unwrap();
        assert!(matches!(acquire_dialog(&lock), Err("OPERATOR_DIALOG_BUSY")));
        drop(held);
        assert!(acquire_dialog(&lock).is_ok());
    }

    #[test]
    fn yes_no_and_unavailable_are_distinct() {
        assert_eq!(classify_response(IDYES), Ok(true));
        assert_eq!(classify_response(IDNO), Ok(false));
        assert_eq!(classify_response(0), Err("OPERATOR_DIALOG_UNAVAILABLE"));
    }
}
