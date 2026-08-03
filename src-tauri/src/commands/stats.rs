use crate::{cache::Cache, utils::CLIENT};
use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Serialize, Deserialize)]
struct StatsCacheEntry {
    expires: u64,
    success: bool,
    value: String,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

fn parse_expiry(text: &str) -> Option<u64> {
    let json: serde_json::Value = serde_json::from_str(text).ok()?;

    let expiry = json.pointer("/data/expiryDate")?.as_str()?;

    DateTime::parse_from_rfc3339(expiry)
        .ok()
        .map(|x| x.timestamp_millis() as u64)
}

#[tauri::command]
pub async fn get_stats(
    _app: tauri::AppHandle,
    username: String,
    platform: String,
    force: Option<bool>,
    cache: State<'_, Cache>,
) -> Result<String, String> {
    let key = format!(
        "stats_{}_{}",
        platform.to_lowercase(),
        username.to_lowercase()
    );

    if !force.unwrap_or(false) {
        if let Some(entry) = cache.get::<StatsCacheEntry>(&key) {
            if entry.expires > now_ms() {
                return if entry.success {
                    Ok(entry.value)
                } else {
                    Err(entry.value)
                };
            }
        }
    }

    let url = format!(
        "https://api.tracker.gg/api/v2/rocket-league/standard/profile/{}/{}",
        platform,
        urlencoding::encode(&username)
    );

    let response = CLIENT
        .get(&url)
        .header("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
        .header("accept-encoding", "gzip, deflate, br, zstd")
        .header("accept-language", "en")
        .header("sec-gpc", "1")
        .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36")
        .header("trn-api-key", "b6408caa-1660-4922-8f6f-11b54341bb57")
        .send()
        .await;

    let entry = match response {
        Ok(res) => {
            if !res.status().is_success() {
                StatsCacheEntry {
                    expires: now_ms() + 10_000,
                    success: false,
                    value: format!("Tracker HTTP error: {}", res.status()),
                }
            } else {
                match res.text().await {
                    Ok(text) => StatsCacheEntry {
                        expires: parse_expiry(&text).unwrap_or(now_ms() + 600_000),
                        success: true,
                        value: text,
                    },

                    Err(e) => StatsCacheEntry {
                        expires: now_ms() + 10_000,
                        success: false,
                        value: format!("Failed to read response: {e}"),
                    },
                }
            }
        }

        Err(e) => StatsCacheEntry {
            expires: now_ms() + 10_000,
            success: false,
            value: format!("Tracker request failed: {e}"),
        },
    };

    cache.set(&key, &entry);

    if entry.success {
        Ok(entry.value)
    } else {
        Err(entry.value)
    }
}
