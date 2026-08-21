use tauri::Manager;

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      let _window = app.get_webview_window("main").unwrap();
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
