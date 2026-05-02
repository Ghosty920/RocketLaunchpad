use crate::account::{get_account, update_account};
use crate::utils::{AUTH_EGL_TOKEN, expired};
use reqwest::Client;
use serde_json::Value;
use std::process::Command;
use tauri::AppHandle;

pub async fn launch_game(app: &AppHandle, account_id: &str, use_eac: bool) -> Result<(), String> {
    let client = Client::new();
    let mut account = get_account(app, account_id)?;

    // Refresh if the access token is expired
    if expired(account.access_expires_at.unwrap_or(0)) {
        crate::login::use_device_auth(&client, &mut account).await?;
        update_account(app, account.clone())?;
    }

    let access_token = account.access_token.as_deref().ok_or("No access token")?;

    // Step 1 : exchange code from the access token
    let exchange_code = get_oauth_exchange(&client, access_token).await?;

    // Step 2 : token EGL from the exchange code
    let token_content = format!("grant_type=exchange_code&exchange_code={exchange_code}");
    let egl_token = get_oauth_token(&client, AUTH_EGL_TOKEN, &token_content).await?;
    let egl_access = egl_token["access_token"]
        .as_str()
        .ok_or("No EGL access token")?;

    // Step 3 : final exchange code (auth password)
    let auth_password = get_oauth_exchange(&client, egl_access).await?;

    let config = crate::config::get_config(&app).expect("Config couldn't be loaded");
    let mut args = vec![
        "-AUTH_LOGIN=unused".to_string(),
        format!("-AUTH_PASSWORD={}", auth_password),
        "-AUTH_TYPE=exchangecode".to_string(),
        "-epicapp=Sugar".to_string(),
        "-epicenv=Prod".to_string(),
        "-EpicPortal".to_string(),
    ];
    args.extend(config.launch_args.split_whitespace().map(|s| s.to_string()));
    args.push(format!("-epicusername={}", account.username));
    args.push(format!("-epicuserid={}", account.account_id));

    let path = format!(
        "{}\\RocketLeague{}.exe",
        config.launch_path,
        if use_eac { "_EAC" } else { "" }
    );

    println!("{}", path);
    println!("{:#?}", args);

    Command::new(&path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to launch game: {e}"))?;

    if config.close_on_launch {
        app.exit(0);
    }

    Ok(())
}

async fn get_oauth_exchange(client: &Client, access_token: &str) -> Result<String, String> {
    let res = client
        .get("https://account-public-service-prod.ol.epicgames.com/account/api/oauth/exchange")
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| format!("Exchange request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Exchange HTTP error: {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Exchange parse failed: {e}"))?;
    json["code"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("No exchange code in response".into())
}

async fn get_oauth_token(client: &Client, auth_token: &str, body: &str) -> Result<Value, String> {
    let res = client
        .post("https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token")
        .header("Authorization", format!("Basic {auth_token}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Token HTTP error: {}", res.status()));
    }

    res.json()
        .await
        .map_err(|e| format!("Token parse failed: {e}"))
}
