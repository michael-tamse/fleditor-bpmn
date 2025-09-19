#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, Emitter, RunEvent};
use std::path::Path;

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

fn abs_path(p: &str) -> String {
  match std::fs::canonicalize(Path::new(p)) {
    Ok(pb) => pb.to_string_lossy().into_owned(),
    Err(_) => p.to_string(),
  }
}

fn process_paths(files: Vec<String>) -> Vec<String> {
  files
    .into_iter()
    .map(|f| normalize_url_to_path(&f))
    .map(|f| abs_path(&f))
    .filter(|f| is_bpmn_path(f))
    .collect()
}

#[tauri::command]
fn pending_files_take(state: tauri::State<PendingFiles>) -> Vec<String> {
  if let Ok(mut guard) = state.0.lock() {
    let drained: Vec<String> = guard.drain(..).collect();
    println!("[tauri-rust] pending_files_take -> {} file(s)", drained.len());
    return drained;
  }
  println!("[tauri-rust] pending_files_take -> 0 (lock failed)");
  Vec::new()
}

fn main() {
  let app = tauri::Builder::default()
    // Single instance: forward subsequent invocations' args to the first instance
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
      println!("[tauri-rust] single_instance: argv = {:?}", argv);
      let files = process_paths(argv);
      println!("[tauri-rust] single_instance: processed files = {:?}", files);
      if files.is_empty() { return; }
      // Emit at app level so JS `@tauri-apps/api/event.listen` receives it regardless of window
      println!("[tauri-rust] single_instance: emitting open-files ({} file(s))", files.len());
      let _ = app.app_handle().emit("open-files", files.clone());
      if let Some(win) = app.get_webview_window("main") { let _ = win.set_focus(); }
      else {
        let state = app.app_handle().state::<PendingFiles>();
        { if let Ok(mut guard) = state.0.lock() { guard.extend(files); }; }
        println!("[tauri-rust] single_instance: buffered files for later (webview not ready)");
      }
    }))
    // FS plugin for host-side file IO (used from the webview)
    .plugin(tauri_plugin_fs::init())
    // Dialog plugin
    .plugin(tauri_plugin_dialog::init())
    .on_page_load(|_window, _| {
      // Webview is ready. We DO NOT emit buffered files here to avoid race with JS listeners.
      // JS host harness will explicitly call `pending_files_take` to drain.
      println!("[tauri-rust] on_page_load: webview ready (no emit; waiting for pending_files_take)");
    })
    .setup(|app| {
      // Initialize pending-files buffer
      app.manage(PendingFiles(Mutex::new(Vec::new())));
      // Cold start: capture argv
      let args: Vec<String> = std::env::args().skip(1).collect();
      println!("[tauri-rust] setup: argv = {:?}", args);
      let files = process_paths(args);
      println!("[tauri-rust] setup: processed files = {:?}", files);
      if !files.is_empty() {
        // Cold start: always buffer and emit on on_page_load to avoid race before webview listener attaches
        let state = app.app_handle().state::<PendingFiles>();
        { if let Ok(mut guard) = state.0.lock() { guard.extend(files.clone()); }; }
        println!("[tauri-rust] setup: buffering files for page load ({} file(s))", files.len());
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![pending_files_take])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  // Run with event loop to capture macOS Opened events at cold start
  app.run(|app_handle, event| {
    #[cfg(target_os = "macos")]
    match event {
      RunEvent::Opened { urls } => {
        let raw: Vec<String> = urls.into_iter().map(|u| u.to_string()).collect();
        println!("[tauri-rust] run(): Opened urls = {:?}", raw);
        let files = process_paths(raw);
        println!("[tauri-rust] run(): processed files = {:?}", files);
        if !files.is_empty() {
          let state = app_handle.state::<PendingFiles>();
          { if let Ok(mut guard) = state.0.lock() { guard.extend(files.clone()); } }
          let _ = app_handle.emit("open-files", files);
        }
      }
      _ => {}
    }
  });
}
