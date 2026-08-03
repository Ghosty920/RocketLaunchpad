use crate::crypt::{decrypt, encrypt};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Account {
    pub username: String,
    pub account_id: String,
    pub auth_device_id: String,
    /** Must be crypted */
    pub auth_secret: String,
    /** Must be crypted */
    pub access_token: Option<String>,
    pub access_expires_at: Option<i64>,
    /** Must be crypted */
    pub refresh_token: Option<String>,
    pub refresh_expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct AccountInfo {
    pub username: String,
    pub account_id: String,
    pub auth_device_id: String,
}

pub fn accounts_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("app_data_dir failed: {err}"))?;
    Ok(base_dir.join("accounts.json"))
}

pub fn update_account(app: &tauri::AppHandle, account: Account) -> Result<(), String> {
    let mut accounts = get_raw_accounts(app)?;
    let entry = accounts
        .iter_mut()
        .find(|a| a.account_id == account.account_id)
        .ok_or_else(|| format!("Account {} not found", account.account_id))?;
    *entry = encrypt_account(&account)?;
    save_accounts(app, &accounts)
}

fn get_raw_accounts(app: &tauri::AppHandle) -> Result<Vec<Account>, String> {
    let path = accounts_path(app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read accounts file: {err}"))?;
    serde_json::from_str(&data).map_err(|err| format!("Failed to parse accounts file: {err}"))
}

fn save_accounts(app: &tauri::AppHandle, accounts: &[Account]) -> Result<(), String> {
    let path = accounts_path(app)?;
    let data = serde_json::to_string_pretty(accounts)
        .map_err(|err| format!("Failed to serialize accounts: {err}"))?;
    std::fs::write(&path, data).map_err(|err| format!("Failed to write accounts file: {err}"))
}

fn decrypt_account(account: &Account) -> Result<Account, String> {
    Ok(Account {
        username: account.username.clone(),
        account_id: account.account_id.clone(),
        auth_device_id: account.auth_device_id.clone(),
        auth_secret: decrypt_str(&account.auth_secret)?,
        access_token: decrypt_opt(&account.access_token)?,
        access_expires_at: account.access_expires_at,
        refresh_token: decrypt_opt(&account.refresh_token)?,
        refresh_expires_at: account.refresh_expires_at,
    })
}

fn encrypt_account(account: &Account) -> Result<Account, String> {
    Ok(Account {
        username: account.username.clone(),
        account_id: account.account_id.clone(),
        auth_device_id: account.auth_device_id.clone(),
        auth_secret: encrypt_str(&account.auth_secret)?,
        access_token: encrypt_opt(&account.access_token)?,
        access_expires_at: account.access_expires_at,
        refresh_token: encrypt_opt(&account.refresh_token)?,
        refresh_expires_at: account.refresh_expires_at,
    })
}

fn migrate_accounts(path: &PathBuf, accounts: &[Account]) -> Result<(), String> {
    let mut migrated_any = false;
    let mut migrated_accounts: Vec<Account> = Vec::new();
    for account in accounts {
        if account.auth_secret.len() != 32 {
            // assume if it's not 32 bytes then it's already encrypted
            migrated_accounts.push(account.clone());
            continue;
        }
        migrated_accounts.push(encrypt_account(account)?);
        migrated_any = true;
    }

    if !migrated_any {
        return Ok(());
    }

    let migrated_data = serde_json::to_string_pretty(&migrated_accounts)
        .map_err(|err| format!("Failed to serialize migrated accounts: {err}"))?;
    std::fs::write(path, migrated_data)
        .map_err(|err| format!("Failed to write migrated accounts file: {err}"))?;
    Ok(())
}

/*
 * Helper functions:
 */

fn decrypt_str(str: &str) -> Result<String, String> {
    let bytes = hex::decode(str).map_err(|e| format!("Hex decode failed: {e}"))?;
    let decrypted = decrypt(&bytes).map_err(|e| format!("Decryption failed: {e}"))?;
    String::from_utf8(decrypted).map_err(|e| format!("UTF-8 decode failed: {e}"))
}

fn decrypt_opt(str: &Option<String>) -> Result<Option<String>, String> {
    match str {
        None => Ok(None),
        Some(v) => decrypt_str(v).map(Some),
    }
}

fn encrypt_str(str: &str) -> Result<String, String> {
    let bytes = encrypt(str.as_bytes()).map_err(|e| format!("Encryption failed: {e}"))?;
    Ok(hex::encode(bytes))
}

fn encrypt_opt(str: &Option<String>) -> Result<Option<String>, String> {
    match str {
        None => Ok(None),
        Some(v) => encrypt_str(v).map(Some),
    }
}

/*
 * Commands:
 */

#[tauri::command]
pub fn get_accounts(app: tauri::AppHandle) -> Result<Vec<AccountInfo>, String> {
    let path = accounts_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }

    let data = std::fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read accounts file: {err}"))?;
    let accounts: Vec<Account> = serde_json::from_str(&data)
        .map_err(|err| format!("Failed to parse accounts file: {err}"))?;
    migrate_accounts(&path, &accounts)?;

    Ok(accounts
        .into_iter()
        .map(|a| AccountInfo {
            username: a.username,
            account_id: a.account_id,
            auth_device_id: a.auth_device_id,
        })
        .collect())
}

#[tauri::command]
pub fn remove_account(app: tauri::AppHandle, account_id: String) -> Result<(), String> {
    let mut accounts = get_raw_accounts(&app)?;
    accounts.retain(|a| a.account_id != account_id);
    save_accounts(&app, &accounts)
}

#[tauri::command]
pub fn get_account(app: tauri::AppHandle, account_id: String) -> Result<Account, String> {
    let account = get_raw_accounts(&app)?
        .into_iter()
        .find(|a| a.account_id == account_id)
        .ok_or_else(|| format!("Account {account_id} not found"))?;
    decrypt_account(&account)
}

#[tauri::command]
pub fn add_account(app: tauri::AppHandle, account: Account) -> Result<(), String> {
    let mut accounts = get_raw_accounts(&app)?;
    if accounts.iter().any(|a| a.account_id == account.account_id) {
        return update_account(&app, account);
    }
    accounts.push(encrypt_account(&account)?);
    save_accounts(&app, &accounts)
}
