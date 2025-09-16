#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager};

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
    let _ = app.emit_all("open-files", files);
  }
}

fn main() {
  let builder = tauri::Builder::default()
    .setup(|app| {
      // cold start: check initial argv for file paths (Win/Linux)
      let args: Vec<String> = std::env::args().skip(1).collect();
      emit_open_files(&app.handle(), args);
      Ok(())
    });

  // Build and run with event loop handler to catch macOS Opened events
  let app = builder
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|_app_handle, _event| {
    // No-op event loop; argv were handled in setup.
  });
}
