use crate::cache::Cache;
use tauri::{Builder, Manager};

mod cache;
mod commands;
mod crypt;
mod keychain;
mod stats_api;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    keyring_core::set_default_store(
        windows_native_keyring_store::Store::new()
            .expect("Failed to initialize Windows Credential Store"),
    );

    Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let cache_path = app.path().app_cache_dir().unwrap().join("cache.redb");
            std::fs::create_dir_all(cache_path.parent().unwrap()).unwrap();
            let cache = Cache::new(cache_path.to_str().unwrap());
            app.manage(cache);

            stats_api::start_stats_listener(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::update_config,
            commands::misc::pick_rocket_league,
            commands::account::get_accounts,
            commands::account::remove_account,
            commands::account::get_account,
            commands::account::add_account,
            commands::login::login_account,
            commands::launcher::launch_game,
            commands::stats::get_stats,
            commands::update::check_update,
            commands::update::install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
