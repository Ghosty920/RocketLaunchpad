use crate::commands::account::{Account, add_account, is_permanent_account};
use crate::tools::webview::build_window;
use crate::utils::{self, AUTH_CLIENT_ID, AUTH_TOKEN, parse_date};
use base64::{Engine as _, engine::general_purpose};
use reqwest::Client;
use serde_json::Value;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use tauri::{Manager, WebviewWindowBuilder};
use tokio::time::{Duration, sleep};

async fn start_device_authentication(client: &Client) -> Result<Value, String> {
    let res = client
        .post("https://api.epicgames.dev/epic/oauth/v2/deviceAuthorization")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!("prompt=login&client_id={AUTH_CLIENT_ID}"))
        .send()
        .await
        .map_err(|e| format!("Device auth request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Device auth HTTP error: {}", res.status()));
    }

    res.json()
        .await
        .map_err(|e| format!("Device auth parse failed: {e}"))
}

async fn verify_device_token(
    client: &Client,
    account: &mut Account,
    device_code: &str,
) -> Result<String, String> {
    let res = client
        .post("https://api.epicgames.dev/epic/oauth/v2/token")
        .header("Authorization", format!("Basic {AUTH_TOKEN}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!("grant_type=device_code&device_code={device_code}"))
        .send()
        .await
        .map_err(|e| format!("Verify token request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Not ready yet: {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Verify parse failed: {e}"))?;
    account.account_id = json["account_id"]
        .as_str()
        .ok_or("No account_id")?
        .to_string();

    json["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("No access_token".into())
}

async fn get_device_auth(
    client: &Client,
    account: &mut Account,
    access_token: &str,
) -> Result<(), String> {
    let payload_b64 = access_token.split('.').nth(1).ok_or("Invalid JWT")?;

    let payload_b64 = utils::fix_base64(payload_b64);
    let payload_bytes = general_purpose::STANDARD
        .decode(&payload_b64)
        .map_err(|e| format!("Base64 decode failed: {e}"))?;

    let payload: Value =
        serde_json::from_slice(&payload_bytes).map_err(|e| format!("JWT parse failed: {e}"))?;
    let jti = payload["jti"].as_str().ok_or("No jti in JWT")?;

    let url = format!(
        "https://account-public-service-prod.ol.epicgames.com/account/api/public/account/{}/deviceAuth",
        account.account_id
    );

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {jti}"))
        .send()
        .await
        .map_err(|e| format!("Device auth POST failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Device auth error: {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Device auth parse failed: {e}"))?;
    account.auth_device_id = json["deviceId"].as_str().ok_or("No deviceId")?.to_string();
    account.auth_secret = json["secret"].as_str().ok_or("No secret")?.to_string();

    Ok(())
}

pub async fn use_device_auth(client: &Client, account: &mut Account) -> Result<(), String> {
    let content = format!(
        "grant_type=device_auth&device_id={}&account_id={}&secret={}&token_type=eg1",
        account.auth_device_id, account.account_id, account.auth_secret
    );

    let res = client
        .post("https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token")
        .header("Authorization", format!("Basic {AUTH_TOKEN}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(content)
        .send()
        .await
        .map_err(|e| format!("UseDeviceAuth request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("UseDeviceAuth HTTP error: {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("UseDeviceAuth parse failed: {e}"))?;
    update_tokens(account, &json)?;
    account.username = json["displayName"]
        .as_str()
        .ok_or("No displayName")?
        .to_string();

    Ok(())
}

/// Outcome of a refresh-token exchange
pub enum RefreshError {
    /// The server rejected the refresh token; the stored token should be discarded
    Rejected(String),
    /// A network, timeout, or server-side failure; the stored token may still be valid
    Transient(String),
}

pub async fn use_refresh_token(client: &Client, account: &mut Account) -> Result<(), RefreshError> {
    let refresh_token = account
        .refresh_token
        .as_deref()
        .ok_or_else(|| RefreshError::Rejected("No refresh token".to_string()))?;
    let content = format!("grant_type=refresh_token&refresh_token={refresh_token}");

    let res = client
        .post("https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token")
        .header("Authorization", format!("Basic {AUTH_TOKEN}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(content)
        .send()
        .await
        .map_err(|e| RefreshError::Transient(format!("Refresh token request failed: {e}")))?;

    let status = res.status();

    if !status.is_success() {
        let message = format!("Refresh token HTTP error: {status}");
        return Err(if matches!(status.as_u16(), 400 | 401 | 403) {
            RefreshError::Rejected(message)
        } else {
            RefreshError::Transient(message)
        });
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| RefreshError::Transient(format!("Refresh token parse failed: {e}")))?;
    update_tokens(account, &json).map_err(RefreshError::Transient)?;
    account.username = json["displayName"]
        .as_str()
        .ok_or_else(|| RefreshError::Transient("No displayName".to_string()))?
        .to_string();

    Ok(())
}

fn update_tokens(account: &mut Account, json: &Value) -> Result<(), String> {
    account.access_token = json["access_token"].as_str().map(|s| s.to_string());
    account.access_expires_at = json["expires_at"].as_str().map(parse_date);
    account.refresh_token = json["refresh_token"]
        .as_str()
        .map(|s| s.to_string())
        .or_else(|| account.refresh_token.clone());
    let previous_refresh_expires_at = account.refresh_expires_at;
    let returned_refresh_expires_at = json["refresh_expires_at"].as_str().map(parse_date);
    account.refresh_expires_at = if is_permanent_account(account) {
        returned_refresh_expires_at.or(previous_refresh_expires_at)
    } else {
        // Temporary shares must not outlive their original expiry, even if the
        // server issues a sliding refresh token
        match (previous_refresh_expires_at, returned_refresh_expires_at) {
            (Some(previous), Some(returned)) => Some(previous.min(returned)),
            (previous, returned) => returned.or(previous),
        }
    };
    // Also keep the access token from outliving the temporary share's deadline
    if !is_permanent_account(account) {
        if let (Some(access_expires_at), Some(deadline)) =
            (account.access_expires_at, account.refresh_expires_at)
        {
            account.access_expires_at = Some(access_expires_at.min(deadline));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn login_account(app: tauri::AppHandle, open_in_window: bool) -> Result<Account, String> {
    let client = utils::http_client(&app)?;
    let json = start_device_authentication(&client).await?;

    let device_code = json["device_code"]
        .as_str()
        .ok_or("No device_code")?
        .to_string();
    let verification_url = json["verification_uri_complete"]
        .as_str()
        .ok_or("No verification URL")?;
    let interval = json["interval"].as_u64().unwrap_or(5);
    let expires_in = json["expires_in"].as_u64().unwrap_or(300);

    let cancelled = Arc::new(AtomicBool::new(false));

    if open_in_window {
        let win = build_window(
            WebviewWindowBuilder::new(
                &app,
                "epic-login",
                tauri::WebviewUrl::External(
                    verification_url
                        .parse()
                        .map_err(|e| format!("Invalid URL: {e}"))?,
                ),
            )
            .title("Epic Games Login")
            .inner_size(500.0, 700.0),
        )
        .map_err(|e| format!("Failed to open login window: {e}"))?;

        // When the user closes the window, set the cancelled flag
        let cancelled_clone = cancelled.clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event
            {
                cancelled_clone.store(true, Ordering::Relaxed);
            }
        });
    } else {
        open::that(verification_url).map_err(|e| format!("Failed to open browser: {e}"))?;
    }

    let mut account = Account {
        username: String::new(),
        account_id: String::new(),
        auth_device_id: String::new(),
        auth_secret: String::new(),
        access_token: None,
        access_expires_at: None,
        refresh_token: None,
        refresh_expires_at: None,
    };

    let mut elapsed = 0u64;
    while elapsed < expires_in {
        sleep(Duration::from_secs(interval)).await;
        elapsed += interval;

        // If the window was closed, do one last check before giving up
        if cancelled.load(Ordering::Relaxed) {
            if let Ok(access_token) = verify_device_token(&client, &mut account, &device_code).await
            {
                get_device_auth(&client, &mut account, &access_token).await?;
                use_device_auth(&client, &mut account).await?;
                add_account(app.clone(), account.clone())?;
                return Ok(account);
            }
            return Err("Login cancelled by user.".into());
        }

        let device_token = verify_device_token(&client, &mut account, &device_code).await;
        let Ok(access_token) = device_token else {
            continue;
        };

        get_device_auth(&client, &mut account, &access_token).await?;
        use_device_auth(&client, &mut account).await?;
        add_account(app.clone(), account.clone())?;

        // Close the login window if it's still open
        if let Some(win) = app.get_webview_window("epic-login") {
            let _ = win.close();
        }

        return Ok(account);
    }

    // Timed out, close the window if still open
    if let Some(win) = app.get_webview_window("epic-login") {
        let _ = win.close();
    }

    Err("Authentication timed out.".into())
}
