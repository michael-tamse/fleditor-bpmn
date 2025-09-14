#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  tauri::Builder::default()
    .setup(|_app| {
      // TODO: add custom menu and Tauri event <-> Sidecar bridging if desired
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

