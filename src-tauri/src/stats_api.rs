use std::env;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use serde_json::Deserializer;
use serde_json::Value;
use tauri::AppHandle;
use tauri::Emitter;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::time::sleep;

const RECONNECT_DELAY: Duration = Duration::from_secs(3);
const EMIT_INTERVAL: Duration = Duration::from_secs(1);

fn get_config_path() -> io::Result<PathBuf> {
    let user_profile = env::var("USERPROFILE")
        .map_err(|_| io::Error::new(io::ErrorKind::NotFound, "Variable USERPROFILE introuvable"))?;

    Ok(PathBuf::from(user_profile)
        .join("Documents")
        .join("My Games")
        .join("Rocket League")
        .join("TAGame")
        .join("Config")
        .join("TAStatsAPI.ini"))
}

fn get_stats_api_port() -> io::Result<String> {
    let path = get_config_path()?;
    let content = fs::read_to_string(&path)?;

    let mut port: Option<String> = None;
    let mut modified = false;
    let mut new_lines: Vec<String> = Vec::with_capacity(content.lines().count());

    for line in content.lines() {
        let trimmed = line.trim();

        if let Some(rest) = trimmed.strip_prefix("Port=") {
            port = Some(rest.trim().to_string());
            new_lines.push(line.to_string());
        } else if let Some(rest) = trimmed.strip_prefix("PacketSendRate=") {
            // forces the PacketSendRate to be between 1 and 120 (0 = disabled, 120 is the max value)
            match rest.trim().parse::<i64>() {
                Ok(value) => {
                    let clamped = value.clamp(1, 120);
                    if clamped != value {
                        new_lines.push(format!("PacketSendRate={}", clamped));
                        modified = true;
                    } else {
                        new_lines.push(line.to_string());
                    }
                }
                Err(_) => {
                    // couldn't parse smh, so we just reset to 1
                    new_lines.push("PacketSendRate=1".to_string());
                    modified = true;
                }
            }
        } else {
            new_lines.push(line.to_string());
        }
    }

    if modified {
        let new_content = new_lines.join("\n") + "\n";
        fs::write(&path, new_content)?;
    }

    port.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "Port couldn't be found in the Stats API config file",
        )
    })
}

async fn handle_message(shared: &Arc<SharedState>, outer: Value) {
    let Some(event) = outer.get("Event").and_then(Value::as_str) else {
        return;
    };
    // ignore every other event since this one contains all the info we currently need
    if event != "UpdateState" {
        return;
    }

    let Some(data_str) = outer.get("Data").and_then(Value::as_str) else {
        eprintln!("stats_api: UpdateState doesn't have a valid Data field");
        return;
    };

    match serde_json::from_str::<Value>(data_str) {
        Ok(parsed_data) => {
            let mut guard = shared.latest.lock().await;
            *guard = Some(parsed_data);
        }
        Err(e) => {
            eprintln!("stats_api: Failed to parse Data: {e}");
        }
    }
}

async fn connect_and_stream(shared: &Arc<SharedState>) -> anyhow::Result<()> {
    println!("stats_api: Attempting to connect to the Stats API...");
    let stats_api_port = get_stats_api_port().expect("stats_api: Failed to get stats API port");
    let stats_api_addr = format!("127.0.0.1:{}", stats_api_port);
    let mut stream = TcpStream::connect(&stats_api_addr).await?;
    eprintln!("stats_api: Connected to {stats_api_addr}");

    // some true verified top tier handshake request
    // the server is weird and doesn't really check if it's real
    // it just needs something that looks like it to start sending data
    let request = format!(
        "GET / HTTP/1.1\r\n\
         Host: localhost:{stats_api_port}\r\n\
         Connection: Upgrade\r\n\
         Upgrade: websocket\r\n\
         Sec-WebSocket-Version: 13\r\n\
         Sec-WebSocket-Key: dGF1cmktc3RhdHMtbGlzdGVuZXI=\r\n\
         \r\n"
    );
    stream.write_all(request.as_bytes()).await?;

    let mut buf: Vec<u8> = Vec::with_capacity(8192);
    let mut chunk = [0u8; 4096];

    loop {
        let n = stream.read(&mut chunk).await?;
        if n == 0 {
            return Ok(()); // connexion closed
        }
        buf.extend_from_slice(&chunk[..n]);

        // for some reason, it doesn't send data like a real websocket (or is my PC cooked?)
        // so we have to parse the buffer and get JSON data from it manually
        loop {
            let mut de = Deserializer::from_slice(&buf).into_iter::<serde_json::Value>();
            match de.next() {
                Some(Ok(value)) => {
                    let consumed = de.byte_offset();
                    drop(de);
                    buf.drain(..consumed);

                    handle_message(shared, value).await;
                }
                Some(Err(e)) if e.is_eof() => {
                    // EOF reached, so we might have an incomplete JSON in this buffer
                    // so let's just wait for the next one
                    break;
                }
                Some(Err(e)) => {
                    eprintln!("stats_api: Invalid JSON ({e}), buffer cleared");
                    buf.clear();
                    break;
                }
                None => break, // empty buffer
            }
        }
    }
}

struct SharedState {
    latest: Mutex<Option<Value>>,
}

pub fn start_stats_listener(app: AppHandle) {
    let shared = Arc::new(SharedState {
        latest: Mutex::new(None),
    });

    {
        let shared = shared.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                match connect_and_stream(&shared).await {
                    Ok(()) => {
                        eprintln!("stats_api: connexion stopped properly, reconnecting...");
                    }
                    Err(e) => {
                        // 10061 = WSAECONNREFUSED, the port isn't opened yet, so we ignore the error
                        let is_connection_refused = e
                            .downcast_ref::<std::io::Error>()
                            .and_then(|io_err| io_err.raw_os_error())
                            == Some(10061);

                        if !is_connection_refused {
                            eprintln!("stats_api: Error: {e}, retrying in 3s");
                        }
                    }
                }
                sleep(RECONNECT_DELAY).await;
            }
        });
    }

    {
        let shared = shared.clone();
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(EMIT_INTERVAL);
            loop {
                interval.tick().await;

                let mut guard = shared.latest.lock().await;
                if let Some(value) = guard.take() {
                    drop(guard);
                    if let Err(e) = app.emit("stats-update", &value) {
                        eprintln!("stats_api: failed to emit: {e}");
                    }
                }
            }
        });
    }
}
