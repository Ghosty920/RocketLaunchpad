use crate::commands::account::{Account, get_account, is_permanent_account, update_account};
use crate::commands::config::get_config;
use crate::commands::login::{RefreshError, use_device_auth, use_refresh_token};
use crate::tools::webview::build_window;
use crate::utils::{AUTH_EGL_TOKEN, expired, http_client};
use serde_json::Value;
use std::process::Command;
use std::sync::Mutex;
use tauri::WebviewWindowBuilder;
use tokio::sync::oneshot;

#[tauri::command]
pub async fn refresh_account(app: tauri::AppHandle, account_id: String) -> Result<Account, String> {
    let client = http_client(&app)?;
    let mut account = get_account(app.clone(), account_id)?;
    let is_temporary = !is_permanent_account(&account);

    let has_refresh_token = account
        .refresh_token
        .as_ref()
        .is_some_and(|_| !expired(account.refresh_expires_at.unwrap_or(0)));

    if has_refresh_token {
        match use_refresh_token(&client, &mut account).await {
            Ok(()) => {}
            Err(RefreshError::Rejected(err)) => {
                account.refresh_token = None;
                account.refresh_expires_at = None;
                update_account(&app, account.clone())?;

                if !is_temporary {
                    use_device_auth(&client, &mut account).await?;
                } else {
                    return Err(err);
                }
            }
            Err(RefreshError::Transient(err)) => return Err(err),
        }
    } else if is_temporary {
        return Err("The shared account credentials have expired.".to_string());
    } else {
        use_device_auth(&client, &mut account).await?;
    }

    update_account(&app, account.clone())?;
    Ok(account)
}

async fn get_oauth_exchange(
    client: &reqwest::Client,
    access_token: &str,
) -> Result<String, String> {
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

async fn get_oauth_token(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    auth_token: &str,
    body: &str,
) -> Result<Value, String> {
    match try_get_token(client, auth_token, body).await? {
        TokenAttempt::Success(token) => Ok(token),
        TokenAttempt::Pending(continuation_url) => {
            open_and_wait_for_close(app, &continuation_url).await?;

            // Une seule relance après fermeture de la fenêtre
            match try_get_token(client, auth_token, body).await? {
                TokenAttempt::Success(token) => Ok(token),
                TokenAttempt::Pending(_) => Err("Login/continuation not completed.".to_string()),
            }
        }
    }
}

async fn open_and_wait_for_close(
    app: &tauri::AppHandle,
    continuation_url: &str,
) -> Result<(), String> {
    let win = build_window(
        WebviewWindowBuilder::new(
            app,
            "epic-continuation",
            tauri::WebviewUrl::External(
                continuation_url
                    .parse()
                    .map_err(|e| format!("Invalid URL: {e}"))?,
            ),
        )
        .title("Epic Games - Continuation")
        .inner_size(500.0, 700.0),
    )
    .map_err(|e| format!("Failed to open login window: {e}"))?;

    let (tx, rx) = oneshot::channel::<()>();
    let tx = Mutex::new(Some(tx));

    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
            if let Some(tx) = tx.lock().unwrap().take() {
                let _ = tx.send(());
            }
        }
    });

    let _ = rx.await;

    Ok(())
}

enum TokenAttempt {
    Success(Value),
    Pending(String),
}

async fn try_get_token(
    client: &reqwest::Client,
    auth_token: &str,
    body: &str,
) -> Result<TokenAttempt, String> {
    let res = client
        .post("https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token")
        .header("Authorization", format!("Basic {auth_token}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body.to_string())
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    let status = res.status();

    if status.is_success() {
        let json = res
            .json::<Value>()
            .await
            .map_err(|e| format!("Token parse failed: {e}"))?;
        return Ok(TokenAttempt::Success(json));
    }

    let text = res
        .text()
        .await
        .map_err(|e| format!("Token error body read failed: {e}"))?;

    if let Ok(err_json) = serde_json::from_str::<Value>(&text) {
        if let Some(continuation_url) = err_json.get("continuationUrl").and_then(|v| v.as_str()) {
            return Ok(TokenAttempt::Pending(continuation_url.to_string()));
        }

        let error_code = err_json
            .get("errorCode")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let corrective_action = err_json
            .get("correctiveAction")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        return Err(format!("Token Error: {error_code} - {corrective_action}"));
    }

    Err(format!("Token HTTP error: {status} - {text}"))
}

#[tauri::command]
pub async fn launch_game(
    app: tauri::AppHandle,
    account_id: String,
    use_eac: bool,
) -> Result<String, String> {
    let client = http_client(&app)?;
    let mut account = get_account(app.clone(), account_id)?;

    let is_temporary = !is_permanent_account(&account);
    let temporary_deadline = if account.refresh_token.is_some() {
        account.refresh_expires_at
    } else {
        account.access_expires_at
    };
    if is_temporary && temporary_deadline.is_some_and(expired) {
        return Err("The shared account credentials have expired.".to_string());
    }

    // Refresh the access token when possible, preferring the shared refresh token
    if account.access_token.is_none() || expired(account.access_expires_at.unwrap_or(0)) {
        let has_device_auth = !is_temporary;
        let has_refresh_token = account
            .refresh_token
            .as_ref()
            .is_some_and(|_| !expired(account.refresh_expires_at.unwrap_or(0)));

        if has_refresh_token {
            match use_refresh_token(&client, &mut account).await {
                Ok(()) => {}
                Err(RefreshError::Rejected(err)) => {
                    // The refresh token is no longer valid; discard it so future
                    // launches don't retry it and can fall back to device auth
                    account.refresh_token = None;
                    account.refresh_expires_at = None;
                    update_account(&app, account.clone())?;

                    if !has_device_auth {
                        return Err(err);
                    }
                    use_device_auth(&client, &mut account).await?;
                }
                // Network failures and timeouts must not invalidate stored tokens
                Err(RefreshError::Transient(err)) => return Err(err),
            }
        } else if has_device_auth {
            use_device_auth(&client, &mut account).await?;
        } else {
            return Err("The shared account credentials have expired.".to_string());
        }
        update_account(&app, account.clone())?;
    }

    let access_token = account.access_token.as_deref().ok_or("No access token")?;

    // Step 1 : exchange code from the access token
    let exchange_code = get_oauth_exchange(&client, access_token).await?;

    // Step 2 : token EGL from the exchange code
    let token_content = format!("grant_type=exchange_code&exchange_code={exchange_code}");
    let egl_token = get_oauth_token(&app, &client, AUTH_EGL_TOKEN, &token_content).await?;
    let egl_access = egl_token["access_token"]
        .as_str()
        .ok_or("No EGL access token")?;

    // Step 3 : final exchange code (auth password)
    let auth_password = get_oauth_exchange(&client, egl_access).await?;

    let config = get_config(app.clone()).expect("Config couldn't be loaded");
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

    // The refresh above may have shortened the temporary deadline
    // Recompute it from the updated account, keeping the original deadline as
    // an upper bound so refreshing can never extend the allowed launch window
    let refreshed_deadline = if account.refresh_token.is_some() {
        account.refresh_expires_at
    } else {
        account.access_expires_at
    };
    let effective_deadline = temporary_deadline
        .into_iter()
        .chain(refreshed_deadline)
        .min();
    // The exchange requests above may have outlived the temporary deadline
    if is_temporary && effective_deadline.is_some_and(expired) {
        return Err("The shared account credentials have expired.".to_string());
    }

    Command::new(&path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to launch game: {e}"))?;

    if config.close_on_launch {
        app.exit(0);
    }

    Ok("Game launched".to_string())
}
