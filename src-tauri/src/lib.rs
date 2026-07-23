use crate::account::AccountInfo;
use crate::update::{UpdateInfo, check_for_update, download_update_and_run};
use crate::utils::CLIENT;
use account::Account;
use config::{Config, ConfigUpdate};
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Controls::Dialogs::{
    GetOpenFileNameW, OFN_FILEMUSTEXIST, OFN_PATHMUSTEXIST, OPENFILENAMEW,
};

mod account;
mod config;
mod crypt;
mod keychain;
mod launcher;
mod login;
mod update;
mod utils;

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Result<Config, String> {
    config::get_config(&app)
}

#[tauri::command]
fn update_config(app: tauri::AppHandle, config: ConfigUpdate) -> Result<(), String> {
    config::update_config(&app, config)
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn pick_rocket_league() -> Option<String> {
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
        Some(utils::clean_launch_path(
            &OsString::from_wide(&file_buf[..end])
                .to_string_lossy()
                .into_owned(),
        ))
    } else {
        None
    }
}

#[tauri::command]
fn get_accounts(app: tauri::AppHandle) -> Result<Vec<AccountInfo>, String> {
    account::get_accounts(&app)
}

#[tauri::command]
fn remove_account(app: tauri::AppHandle, account_id: String) -> Result<(), String> {
    account::remove_account(&app, &account_id)
}

#[tauri::command]
fn get_account(app: tauri::AppHandle, account_id: String) -> Result<Account, String> {
    account::get_account(&app, &account_id)
}

#[tauri::command]
fn add_account(app: tauri::AppHandle, account: Account) -> Result<(), String> {
    account::add_account(&app, account)
}

#[tauri::command]
async fn launch_game(
    app: tauri::AppHandle,
    account_id: String,
    use_eac: bool,
) -> Result<String, String> {
    launcher::launch_game(&app, &account_id, use_eac)
        .await
        .map(|_| "Game launched".to_string())
}

#[tauri::command]
async fn login_account(app: tauri::AppHandle, open_in_window: bool) -> Result<Account, String> {
    login::login_and_add_account(&app, open_in_window).await
}

#[tauri::command]
async fn get_stats(_app: tauri::AppHandle, username: String) -> Result<String, String> {
    let url = format!(
        //"http://192.168.1.150",
        "https://api.tracker.gg/api/v2/rocket-league/standard/profile/epic/{}",
        urlencoding::encode(&username)
    );

    let res = CLIENT
        .get(&url)
        .header("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
        .header("accept-encoding", "gzip, deflate, br, zstd")
        .header("accept-language", "en")
        .header("sec-gpc", "1")
        .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("Tracker request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Tracker HTTP error: {}", res.status()));
    }

    let text = res
        .text()
        .await
        .unwrap_or_else(|_| "Failed to read response text".to_string());

    Ok(text)
}

#[tauri::command]
async fn check_update(
    _app: tauri::AppHandle,
    version: String,
) -> Result<Option<UpdateInfo>, String> {
    check_for_update(version).await
}

#[tauri::command]
async fn install_update(_app: tauri::AppHandle, url: String) -> Result<(), String> {
    download_update_and_run(&url)
        .await
        .map_err(|e| format!("Failed to install update: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    keyring_core::set_default_store(
        windows_native_keyring_store::Store::new()
            .expect("Failed to initialize Windows Credential Store"),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            update_config,
            pick_rocket_league,
            get_accounts,
            remove_account,
            get_account,
            add_account,
            launch_game,
            login_account,
            get_stats,
            check_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
