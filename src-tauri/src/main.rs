#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager, Emitter};

fn is_bpmn_path(path: &str) -> bool {
  let p = path.to_ascii_lowercase();
  p.ends_with(".bpmn") || p.ends_with(".bpmn20.xml") || p.ends_with(".process.bpmn20.xml")
}

fn normalize_url_to_path(u: &str) -> String {
  // crude file:// stripping for macOS Opened URLs
  if let Some(rest) = u.strip_prefix("file://") {
    return rest.to_string();
  }
  u.to_string()
}

fn emit_open_files(app: &AppHandle, files: Vec<String>) {
  let files: Vec<String> = files
    .into_iter()
    .map(|f| normalize_url_to_path(&f))
    .filter(|f| is_bpmn_path(f))
    .collect();
  if !files.is_empty() {
    let _ = app.emit("open-files", files);
  }
}

fn main() {
  tauri::Builder::default()
    // Single instance: forward subsequent invocations' args to the first instance
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      emit_open_files(&app.app_handle(), argv);
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
      }
    }))
    // FS plugin for host-side file IO (used from the webview)
    .plugin(tauri_plugin_fs::init())
    // Dialog plugin
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      // Cold start: check initial argv for file paths (Win/Linux)
      let args: Vec<String> = std::env::args().skip(1).collect();
      emit_open_files(&app.app_handle(), args);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
