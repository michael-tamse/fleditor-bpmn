# Tauri Host (Starter)

This is a minimal Tauri starter that loads the Vite dev server (host demo) in development and the built app in production.

- Dev: `npm run dev:tauri` (requires Rust toolchain + Tauri CLI installed)
- Build: `npm run build:tauri`

Notes
- Dev URL: `http://localhost:5173/hosts/browser/` (the browser host demo with iframe + postMessage transport).
- Prod bundle: points to `dist/` (Vite build). To include the host page in prod, convert the project to a Vite multi-page build or point Tauri to a dedicated host HTML.
- Security: Add origin checks and file access dialogs as needed. The current allowlist enables shell/dialog/fs for convenience.

Next Steps
- Wire Tauri menu items to call Sidecar ops (`doc.load`/`doc.save`) or emit `ui.state` via postMessage.
- Optional: implement a Tauri-native transport that proxies to the editor (e.g., via `window.__TAURI__` events).
