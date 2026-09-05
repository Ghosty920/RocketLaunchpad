use chrono::{DateTime, Utc};
use reqwest::Client;
use std::path::PathBuf;
use std::sync::LazyLock;

pub fn clean_launch_path(path: &str) -> String {
    let p = PathBuf::from(path);
    if p.file_name().map_or(false, |f| f == "RocketLeague.exe") {
        return p
            .parent()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string());
    }
    path.to_string()
}

pub const AUTH_CLIENT_ID: &str = "3f69e56c7649492c8cc29f1af08a8a12";
///pub const AUTH_SECRET: &str = "b51ee9cb12234f50a69efa67ef53812e";
pub const AUTH_TOKEN: &str =
    "M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=";
pub const AUTH_EGL_TOKEN: &str =
    "MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=";

pub fn parse_date(date: &str) -> i64 {
    let parsed: DateTime<Utc> = date.parse().unwrap();
    parsed.timestamp_millis()
}

pub fn expired(time: i64) -> bool {
    Utc::now().timestamp_millis() >= time - 5000
}

pub fn fix_base64(str: &str) -> String {
    let mut fixed = str.replace('-', "+").replace('_', "/");
    match fixed.len() % 4 {
        2 => fixed.push_str("=="),
        3 => fixed.push('='),
        _ => {}
    }
    fixed
}

pub static CLIENT: LazyLock<Client> = LazyLock::new(|| {
    let mut builder = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36");

    let use_proxy = std::env::var("APP_DEBUG_PROXY").is_ok();
    if use_proxy {
        println!("Using proxy for requests");
        builder = builder
            .proxy(reqwest::Proxy::all("http://127.0.0.1:8888").unwrap())
            .danger_accept_invalid_certs(true);
    }

    builder.build().unwrap()
});
