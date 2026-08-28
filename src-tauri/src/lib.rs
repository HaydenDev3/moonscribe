use rusqlite::{params, Connection, OptionalExtension};
use std::fs;
use std::path::PathBuf;
use tauri::{menu::MenuBuilder, tray::TrayIconBuilder, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

const CREDENTIAL_SERVICE: &str = "com.moonscribe.desktop";
const NATIVE_SCHEMA_VERSION: i64 = 1;
const DISCORD_CLIENT_ID_ENV: &str = "MOONSCRIBE_DISCORD_CLIENT_ID";
const DISCORD_CLIENT_ID: &str = "1537750421458780170";

struct DiscordPresenceState(Mutex<Option<DiscordIpcClient>>);

fn discord_client_id() -> Option<String> {
    Some(std::env::var(DISCORD_CLIENT_ID_ENV).ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| DISCORD_CLIENT_ID.to_string()))
}

#[tauri::command]
fn discord_presence_set(state: tauri::State<'_, DiscordPresenceState>, details: String, activity_state: String, started_at: i64) -> Result<(), String> {
    let Some(client_id) = discord_client_id() else { return Err("Discord application ID is not configured".into()) };
    let mut guard = state.0.lock().map_err(|_| "Discord state unavailable".to_string())?;
    if guard.is_none() { let mut client = DiscordIpcClient::new(&client_id).map_err(|e| e.to_string())?; client.connect().map_err(|e| e.to_string())?; *guard = Some(client); }
    let activity = activity::Activity::new().details(&details).state(&activity_state).timestamps(activity::Timestamps::new().start(started_at / 1000));
    if let Some(client) = guard.as_mut() { client.set_activity(activity).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn discord_presence_clear(state: tauri::State<'_, DiscordPresenceState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() { if let Some(mut client) = guard.take() { let _ = client.clear_activity(); let _ = client.close(); } }
    Ok(())
}

#[tauri::command]
fn discord_presence_status(state: tauri::State<'_, DiscordPresenceState>) -> serde_json::Value {
    let available = discord_client_id().is_some();
    let connected = state.0.lock().map(|g| g.is_some()).unwrap_or(false);
    serde_json::json!({ "available": available, "connected": connected, "reason": if !available { "not_configured" } else if !connected { "discord_not_running" } else { "connected" } })
}

fn window_state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_local_data_dir()
        .ok()
        .map(|dir| dir.join("window-state.json"))
}

fn native_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("storage");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("moonscribe.sqlite"))
}

fn open_native_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(native_db_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         CREATE TABLE IF NOT EXISTS records (
           store_name TEXT NOT NULL,
           record_id TEXT NOT NULL,
           payload TEXT NOT NULL,
           updated_at INTEGER NOT NULL,
           deleted INTEGER NOT NULL DEFAULT 0,
           PRIMARY KEY (store_name, record_id)
         );
         CREATE TABLE IF NOT EXISTS schema_meta (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL
         );",
        )
        .map_err(|error| error.to_string())?;
    apply_native_migrations(&connection)?;
    Ok(connection)
}

fn apply_native_migrations(connection: &Connection) -> Result<(), String> {
    let current: i64 = connection
        .query_row(
            "SELECT value FROM schema_meta WHERE key = 'schema_version'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    if current > NATIVE_SCHEMA_VERSION {
        return Err(format!(
            "Native storage schema {current} is newer than this application supports"
        ));
    }
    if current < 1 {
        let transaction = connection
            .unchecked_transaction()
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![NATIVE_SCHEMA_VERSION.to_string()],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn native_storage_put(
    app: tauri::AppHandle,
    store: String,
    id: String,
    payload: String,
    updated_at: i64,
) -> Result<(), String> {
    let connection = open_native_db(&app)?;
    connection.execute(
        "INSERT INTO records (store_name, record_id, payload, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, 0)
         ON CONFLICT(store_name, record_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at, deleted=0
         WHERE excluded.updated_at >= records.updated_at",
        params![store, id, payload, updated_at],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn native_storage_delete(
    app: tauri::AppHandle,
    store: String,
    id: String,
    updated_at: i64,
) -> Result<(), String> {
    let connection = open_native_db(&app)?;
    connection.execute(
        "INSERT INTO records (store_name, record_id, payload, updated_at, deleted) VALUES (?1, ?2, '{}', ?3, 1)
         ON CONFLICT(store_name, record_id) DO UPDATE SET updated_at=excluded.updated_at, deleted=1
         WHERE excluded.updated_at >= records.updated_at",
        params![store, id, updated_at],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn native_storage_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connection = open_native_db(&app)?;
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM records WHERE deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(serde_json::json!({ "ready": true, "records": count }))
}

#[tauri::command]
fn native_storage_get(
    app: tauri::AppHandle,
    store: String,
    id: String,
) -> Result<Option<serde_json::Value>, String> {
    let connection = open_native_db(&app)?;
    let row = connection
        .query_row(
            "SELECT payload, updated_at, deleted FROM records WHERE store_name = ?1 AND record_id = ?2",
            params![store, id],
            |row| {
                let payload: String = row.get(0)?;
                let updated_at: i64 = row.get(1)?;
                let deleted: i64 = row.get(2)?;
                let parsed = serde_json::from_str::<serde_json::Value>(&payload)
                    .unwrap_or_else(|_| serde_json::json!({}));
                Ok(serde_json::json!({
                    "store": store,
                    "id": id,
                    "payload": parsed,
                    "updatedAt": updated_at,
                    "deleted": deleted != 0
                }))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(row)
}

#[tauri::command]
fn native_storage_export(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let connection = open_native_db(&app)?;
    let mut statement = connection
        .prepare("SELECT store_name, record_id, payload, updated_at, deleted FROM records ORDER BY updated_at ASC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let store: String = row.get(0)?;
            let id: String = row.get(1)?;
            let payload: String = row.get(2)?;
            let updated_at: i64 = row.get(3)?;
            let deleted: i64 = row.get(4)?;
            let parsed = serde_json::from_str::<serde_json::Value>(&payload).unwrap_or_else(|_| serde_json::json!({}));
            Ok(serde_json::json!({ "store": store, "id": id, "payload": parsed, "updatedAt": updated_at, "deleted": deleted != 0 }))
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn native_storage_backup(app: tauri::AppHandle) -> Result<String, String> {
    let source = native_db_path(&app)?;
    let connection = open_native_db(&app)?;
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|error| error.to_string())?;
    let backup_dir = source
        .parent()
        .ok_or_else(|| "Native storage path has no parent".to_string())?
        .join("backups");
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
    let stamp = chrono_like_timestamp();
    let destination = backup_dir.join(format!("moonscribe-{stamp}.sqlite"));
    drop(connection);
    fs::copy(&source, &destination).map_err(|error| error.to_string())?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn native_storage_restore(app: tauri::AppHandle, backup_name: String) -> Result<String, String> {
    let source = native_db_path(&app)?;
    let safe_name = std::path::Path::new(&backup_name)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| *name == backup_name && name.ends_with(".sqlite"))
        .ok_or_else(|| "Invalid native backup name".to_string())?;
    let backup = source
        .parent()
        .ok_or_else(|| "Native storage path has no parent".to_string())?
        .join("backups")
        .join(safe_name);
    if !backup.is_file() {
        return Err("Native backup was not found".to_string());
    }
    let connection = open_native_db(&app)?;
    connection
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|error| error.to_string())?;
    drop(connection);
    let recovery = source.with_file_name(format!(
        "moonscribe-before-restore-{}.sqlite",
        chrono_like_timestamp()
    ));
    fs::copy(&source, &recovery).map_err(|error| error.to_string())?;
    fs::copy(&backup, &source).map_err(|error| error.to_string())?;
    Ok(recovery.to_string_lossy().to_string())
}

#[tauri::command]
fn native_storage_list_backups(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let source = native_db_path(&app)?;
    let backup_dir = source
        .parent()
        .ok_or_else(|| "Native storage path has no parent".to_string())?
        .join("backups");
    if !backup_dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut names = fs::read_dir(backup_dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            (path.extension().and_then(|ext| ext.to_str()) == Some("sqlite"))
                .then(|| path.file_name()?.to_str().map(String::from))
                .flatten()
        })
        .collect::<Vec<_>>();
    names.sort_by(|left, right| right.cmp(left));
    Ok(names)
}

fn chrono_like_timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn restore_window_state(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    let Some(path) = window_state_path(app) else {
        return;
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return;
    };
    let Ok(state) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return;
    };
    if let (Some(width), Some(height)) = (
        state.get("width").and_then(|v| v.as_u64()),
        state.get("height").and_then(|v| v.as_u64()),
    ) {
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: width as u32,
            height: height as u32,
        }));
    }
    if let (Some(x), Some(y)) = (
        state.get("x").and_then(|v| v.as_i64()),
        state.get("y").and_then(|v| v.as_i64()),
    ) {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        }));
    }
}

fn save_window_state(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
    let Some(path) = window_state_path(app) else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let state = serde_json::json!({ "width": size.width, "height": size.height, "x": position.x, "y": position.y });
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(path, state.to_string());
}

#[tauri::command]
fn credential_get(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &key).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn credential_set(key: String, value: Option<String>) -> Result<(), String> {
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &key).map_err(|error| error.to_string())?;
    match value {
        Some(secret) => entry
            .set_password(&secret)
            .map_err(|error| error.to_string()),
        None => match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        },
    }
}

#[tauri::command]
fn native_read_file(path: String) -> Result<Vec<u8>, String> {
    let source = std::path::Path::new(&path);
    if !source.is_file() {
        return Err("The selected desktop path is not a readable file.".to_string());
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "md" | "markdown" | "txt" | "rtf" | "docx" | "epub"
    ) {
        return Err(
            "MoonScribe can open Markdown, text, RTF, DOCX, and EPUB files from the desktop."
                .to_string(),
        );
    }
    fs::read(path).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            let deep_links = args
                .iter()
                .filter(|arg| arg.starts_with("moonscribe://"))
                .cloned()
                .collect::<Vec<_>>();
            if !deep_links.is_empty() {
                let _ = app.emit("moonscribe://auth-callback", deep_links);
            }
            let files = args
                .into_iter()
                .filter(|arg| !arg.starts_with('-') && !arg.starts_with("moonscribe://"))
                .collect::<Vec<_>>();
            if !files.is_empty() {
                let _ = app.emit("moonscribe://open-files", files);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            discord_presence_set,
            discord_presence_clear,
            discord_presence_status,
            credential_get,
            credential_set,
            native_read_file,
            native_storage_put,
            native_storage_delete,
            native_storage_status,
            native_storage_get,
            native_storage_export,
            native_storage_backup,
            native_storage_restore,
            native_storage_list_backups
        ])
        .setup(|app| {
            app.manage(DiscordPresenceState(Mutex::new(None)));
            let window = app.get_webview_window("main").unwrap();
            restore_window_state(app.handle(), &window);
            let initial_files = std::env::args()
                .skip(1)
                .filter(|arg| !arg.starts_with('-') && !arg.starts_with("moonscribe://"))
                .collect::<Vec<_>>();
            if !initial_files.is_empty() {
                let _ = app.emit("moonscribe://open-files", initial_files);
            }
            let app_handle = app.handle().clone();
            let quick_capture =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyK);
            app.global_shortcut()
                .on_shortcut(quick_capture, move |app, _, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                        let _ = app.emit("moonscribe:quick-capture-open", ());
                    }
                })?;
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        save_window_state(&app_handle, &window);
                    }
                }
            });
            let menu = MenuBuilder::new(app)
                .text("show", "Show MoonScribe")
                .separator()
                .text("quit", "Quit MoonScribe")
                .build()?;
            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("MoonScribe")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
