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
