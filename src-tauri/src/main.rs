#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, Emitter};

struct PendingFiles(Mutex<Vec<String>>);

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

fn process_paths(files: Vec<String>) -> Vec<String> {
  files
    .into_iter()
    .map(|f| normalize_url_to_path(&f))
    .filter(|f| is_bpmn_path(f))
    .collect()
}

#[tauri::command]
fn pending_files_take(state: tauri::State<PendingFiles>) -> Vec<String> {
  if let Ok(mut guard) = state.0.lock() {
    return guard.drain(..).collect();
  }
  Vec::new()
}

fn main() {
  tauri::Builder::default()
    // Single instance: forward subsequent invocations' args to the first instance
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      let files = process_paths(argv);
      if files.is_empty() { return; }
      // Emit at app level so JS `@tauri-apps/api/event.listen` receives it regardless of window
      let _ = app.app_handle().emit("open-files", files.clone());
      if let Some(win) = app.get_webview_window("main") { let _ = win.set_focus(); }
      else {
        let state = app.app_handle().state::<PendingFiles>();
        { if let Ok(mut guard) = state.0.lock() { guard.extend(files); }; }
      }
    }))
    // FS plugin for host-side file IO (used from the webview)
    .plugin(tauri_plugin_fs::init())
    // Dialog plugin
    .plugin(tauri_plugin_dialog::init())
    .on_page_load(|window, _| {
      // Drain any buffered files now that the webview is ready
      let app = window.app_handle();
      let state = app.state::<PendingFiles>();
      {
        if let Ok(mut guard) = state.0.lock() {
          if !guard.is_empty() {
            let files: Vec<String> = guard.drain(..).collect();
            let _ = app.emit("open-files", files);
          }
        };
      }
    })
    .setup(|app| {
      // Initialize pending-files buffer
      app.manage(PendingFiles(Mutex::new(Vec::new())));
      // Cold start: capture argv
      let args: Vec<String> = std::env::args().skip(1).collect();
      let files = process_paths(args);
      if !files.is_empty() {
        // Broadcast at app level
        let _ = app.app_handle().emit("open-files", files.clone());
        if app.get_webview_window("main").is_none() {
          let state = app.app_handle().state::<PendingFiles>();
          { if let Ok(mut guard) = state.0.lock() { guard.extend(files); }; }
        }
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![pending_files_take])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
