use crate::{cache::Cache, utils::CLIENT};
use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct StatsCacheEntry {
    pub expires: u64,
    pub success: bool,
    pub is_rate_limited: Option<bool>,
    pub value: String,
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
) -> Result<String, StatsCacheEntry> {
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
                    Err(entry)
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
        .header("Accept", "*/*")
        .header("Content-Type", "application/json")
        .header("Origin", "https://www.overwolf.com/nonfnefnlcikmjkkdclbhpojenalpkcoipjjognm")
        .header("TRN-API-Key", "b6408caa-1660-4922-8f6f-11b54341bb57")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 OverwolfClient/0.309.0.14")
        .header("sec-ch-ua", "\"Not_A Brand\";v=\"99\", \"Chromium\";v=\"142\"")
        .header("sec-ch-ua-mobile", "?0")
        .header("sec-ch-ua-platform", "\"Windows\"")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Dest", "empty")
        .header("Accept-Encoding", "gzip, deflate, br, zstd")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await;

    let entry = match response {
        Ok(res) => {
            let status = res.status();

            if !status.is_success() {
                match status.as_u16() {
                    429 => {
                        let retry_after = res
                            .headers()
                            .get("retry-after")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(10);
                        println!(
                            "Tracker API rate limit exceeded. Retry after {} seconds.",
                            retry_after
                        );
                        StatsCacheEntry {
                            expires: now_ms() + retry_after * 1000,
                            success: false,
                            is_rate_limited: Some(true),
                            value: format!(
                                "Tracker API rate limit exceeded. Retry after {} seconds.",
                                retry_after
                            ),
                        }
                    }
                    _ => {
                        println!("Tracker HTTP error: {}", status);

                        StatsCacheEntry {
                            expires: now_ms() + 10_000,
                            success: false,
                            is_rate_limited: Some(false),
                            value: format!("Tracker HTTP error: {}", status),
                        }
                    }
                }
            } else {
                match res.text().await {
                    Ok(text) => StatsCacheEntry {
                        expires: parse_expiry(&text).unwrap_or(now_ms() + 600_000),
                        success: true,
                        is_rate_limited: None,
                        value: text,
                    },

                    Err(e) => StatsCacheEntry {
                        expires: now_ms() + 10_000,
                        success: false,
                        is_rate_limited: None,
                        value: format!("Failed to read response: {e}"),
                    },
                }
            }
        }

        Err(e) => StatsCacheEntry {
            expires: now_ms() + 10_000,
            success: false,
            is_rate_limited: None,
            value: format!("Tracker request failed: {e}"),
        },
    };

    cache.set(&key, &entry);

    if entry.success {
        Ok(entry.value)
    } else {
        Err(entry)
    }
}
