use crate::utils::clean_launch_path;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Config {
    #[serde(default)]
    pub launch_path: String,
    #[serde(default)]
    pub launch_args: String,
    #[serde(default)]
    pub close_on_launch: bool,
    #[serde(default)]
    pub show_stats_page: bool,
    #[serde(default)]
    pub use_eac: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            launch_path: String::new(),
            launch_args: "-language=INT".to_string(),
            close_on_launch: false,
            show_stats_page: true,
            use_eac: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ConfigUpdate {
    pub launch_path: Option<String>,
    pub launch_args: Option<String>,
    pub close_on_launch: Option<bool>,
    pub show_stats_page: Option<bool>,
    pub use_eac: Option<bool>,
}

pub fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("app_data_dir failed: {err}"))?;
    Ok(base_dir.join("config.json"))
}

pub fn merge_config(existing: Config, incoming: ConfigUpdate) -> Config {
    Config {
        launch_path: incoming.launch_path.unwrap_or(existing.launch_path),
        launch_args: incoming.launch_args.unwrap_or(existing.launch_args),
        close_on_launch: incoming.close_on_launch.unwrap_or(existing.close_on_launch),
        show_stats_page: incoming.show_stats_page.unwrap_or(existing.show_stats_page),
        use_eac: incoming.use_eac.unwrap_or(existing.use_eac),
    }
}

pub fn get_config(app: &tauri::AppHandle) -> Result<Config, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(Config::default());
    }

    let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    let mut config = serde_json::from_str::<Config>(&content).map_err(|err| err.to_string())?;

    // Remove \RocketLeague.exe from the launch path if present
    config.launch_path = clean_launch_path(&config.launch_path);

    Ok(config)
}

/*pub fn save_config(app: &tauri::AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let json = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(&path, json).map_err(|err| err.to_string())?;
    Ok(())
}*/

pub fn update_config(app: &tauri::AppHandle, config: ConfigUpdate) -> Result<(), String> {
    let path = config_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let merged_config = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        let existing = serde_json::from_str::<Config>(&content).map_err(|err| err.to_string())?;
        merge_config(existing, config)
    } else {
        merge_config(Config::default(), config)
    };

    let json = serde_json::to_string_pretty(&merged_config).map_err(|err| err.to_string())?;
    fs::write(&path, json).map_err(|err| err.to_string())?;
    Ok(())
}
