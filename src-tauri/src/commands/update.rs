use serde::{Deserialize, Serialize};

use crate::utils::CLIENT;
use futures_util::StreamExt;
use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};
use tokio::{fs::File, io::AsyncWriteExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct UpdateInfo {
    pub version: String,
    pub page_url: String,
    pub installer_url: String,
}

fn is_installed_with_nsis() -> Result<bool, std::io::Error> {
    let exe = std::env::current_exe()?;
    let uninstall = exe
        .parent()
        .ok_or_else(|| std::io::Error::other("No executable parent ?!"))?
        .join("uninstall.exe");

    Ok(uninstall.exists())
}

async fn get_latest_release() -> Result<serde_json::Value, String> {
    let response = CLIENT
        .get("https://api.github.com/repos/Ghosty920/RocketLaunchpad/releases/latest")
        .header("User-Agent", "RocketLaunchpad")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2026-03-10")
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch latest version: {}",
            response.status()
        ));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {e}"))
}

async fn check_for_update(current_version: String) -> Result<Option<UpdateInfo>, String> {
    println!("Current version: {current_version}");

    let release = get_latest_release().await?;

    let latest_version = release["tag_name"]
        .as_str()
        .ok_or_else(|| "Missing tag_name in response".to_string())?
        .trim_start_matches(char::is_alphabetic)
        .to_string();

    println!("Latest version: {latest_version}");

    if latest_version == current_version {
        return Ok(None);
    }

    let assets = release["assets"]
        .as_array()
        .ok_or_else(|| "Missing assets in release".to_string())?;

    let installer_name = if is_installed_with_nsis().unwrap_or(false) {
        ".exe"
    } else {
        ".msi"
    };

    let installer = assets
        .iter()
        .find(|asset| {
            asset["name"]
                .as_str()
                .map(|name| name.ends_with(installer_name))
                .unwrap_or(false)
        })
        .ok_or_else(|| format!("No {installer_name} installer found"))?;

    let installer_url = installer["browser_download_url"]
        .as_str()
        .ok_or_else(|| "Missing browser_download_url".to_string())?
        .to_string();

    let page_url = release["html_url"]
        .as_str()
        .ok_or_else(|| "Missing html_url".to_string())?
        .to_string();

    Ok(Some(UpdateInfo {
        version: latest_version,
        page_url,
        installer_url,
    }))
}

async fn download_update_and_run(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let ext = Path::new(url)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("exe");
    let is_msi = ext.eq_ignore_ascii_case("msi");
    let file_name = format!("rlpad-{}.{}", uuid::Uuid::new_v4(), ext);
    let path: PathBuf = env::temp_dir().join(&file_name);
    println!("Downloading update to: {:?}", path);

    let response = reqwest::get(url).await?;
    let mut stream = response.bytes_stream();

    let mut file = File::create(&path).await?;

    while let Some(chunk) = stream.next().await {
        file.write_all(&chunk?).await?;
    }

    file.flush().await?;
    drop(file);

    if is_msi {
        Command::new("msiexec")
            .args(["/i", path.to_str().unwrap()])
            .spawn()?;
    } else {
        Command::new(&path).spawn()?;
    }

    Ok(())
}

#[tauri::command]
pub async fn check_update(
    _app: tauri::AppHandle,
    version: String,
) -> Result<Option<UpdateInfo>, String> {
    check_for_update(version).await
}

#[tauri::command]
pub async fn install_update(_app: tauri::AppHandle, url: String) -> Result<(), String> {
    download_update_and_run(&url)
        .await
        .map_err(|e| format!("Failed to install update: {e}"))
}
