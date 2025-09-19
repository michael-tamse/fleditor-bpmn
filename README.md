# FLEditor BPMN

Ein einfacher Editor zum Anzeigen und Bearbeiten von BPMN-Diagrammen auf Basis von [bpmn-js](https://github.com/bpmn-io/bpmn-js).

## Voraussetzungen

- [Node.js](https://nodejs.org/) und npm

## Installation

```bash
npm install
```

## Entwicklung

Startet einen lokalen Entwicklungsserver unter http://localhost:5173/:

```bash
npm run dev
```

## Build

Erzeugt eine produktive Build-Version im Ordner `dist/`:

```bash
npm run build
```

Vorschau der gebauten Anwendung:

```bash
npm run preview
```

## Tauri (Desktop)

Voraussetzungen (Windows):
- Node.js 18+
- Rust (stable, x86_64-pc-windows-msvc) → https://rustup.rs
- Visual Studio 2022 Build Tools (C++ Desktop Workload)
- Tauri CLI (wird per devDependency mitinstalliert)

Entwicklung (Desktop, verwendet Webview und Plugins):

```bash
npm run dev:tauri
```

Build (Bundle):

```bash
# macOS .app (Standard)
npm run build:tauri

# Windows Installer (NSIS)
npm run build:win:nsis

# Windows Installer (MSI, WiX Toolset erforderlich)
npm run build:win:msi

# Beides (NSIS + MSI)
npm run build:win:all
```

Ausgabe:
- macOS: `src-tauri/target/release/bundle/macos/Flowable BPMN Editor.app`
- Windows (NSIS): `src-tauri/target/release/bundle/nsis/Flowable BPMN Editor_*_x64-setup.exe`
- Windows (MSI):  `src-tauri/target/release/bundle/msi/Flowable BPMN Editor_*_x64_en-US.msi`

Datei‑Verknüpfungen:
- Windows: bevorzugt `.bpmn`; doppelte Suffixe wie `.bpmn20.xml` gelten als `.xml`.
- macOS/Windows: „Öffnen mit …“ ist unterstützt. Bei Kaltstart‑Problemen auf macOS bitte App zuerst starten und dann Datei per „Öffnen mit …“ öffnen.

Hinweise für Windows‑Builds:
- NSIS: Installiere NSIS 3.x und stelle sicher, dass `makensis` im `PATH` liegt.
- MSI: Installiere WiX Toolset v3 (candle.exe, light.exe im `PATH`).

## Technologien

- bpmn-js
- @bpmn-io/properties-panel
- bpmn-js-properties-panel
- Vite
- TypeScript

## Projektstruktur

- `index.html` – Einstiegspunkt der Anwendung
- `src/` – TypeScript-Quellcode
- `styles.css` – globale Styles
- `tsconfig.json` – TypeScript-Konfiguration

## Lizenz

Dieses Projekt ist privater Natur. Weitere Informationen zur Lizenzierung liegen nicht vor.
