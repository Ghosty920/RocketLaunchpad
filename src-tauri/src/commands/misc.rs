use crate::utils::clean_launch_path;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Controls::Dialogs::{
    GetOpenFileNameW, OFN_FILEMUSTEXIST, OFN_PATHMUSTEXIST, OPENFILENAMEW,
};

#[tauri::command]
#[cfg(target_os = "windows")]
pub fn pick_rocket_league() -> Option<String> {
    let filter: Vec<u16> = "RocketLeague.exe\0RocketLeague.exe\0\0"
        .encode_utf16()
        .collect();

    let title: Vec<u16> = "Select RocketLeague.exe\0".encode_utf16().collect();

    let mut file_buf = vec![0u16; 260];

    let mut ofn = OPENFILENAMEW {
        lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: HWND(std::ptr::null_mut()),
        lpstrFilter: windows::core::PCWSTR(filter.as_ptr()),
        lpstrFile: windows::core::PWSTR(file_buf.as_mut_ptr()),
        nMaxFile: file_buf.len() as u32,
        lpstrTitle: windows::core::PCWSTR(title.as_ptr()),
        Flags: OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST,
        ..Default::default()
    };

    let result = unsafe { GetOpenFileNameW(&mut ofn) };

    if result.as_bool() {
        let end = file_buf
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(file_buf.len());
        Some(clean_launch_path(
            &OsString::from_wide(&file_buf[..end])
                .to_string_lossy()
                .into_owned(),
        ))
    } else {
        None
    }
}
