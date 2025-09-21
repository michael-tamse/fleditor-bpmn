# Claude Development Guide für BPMN Editor

Dieses Dokument enthält wichtige Informationen für Claude zur Arbeit mit diesem BPMN Editor Projekt.

## Projekt Überblick
- **Typ**: Lightweight BPMN Editor basierend auf `bpmn-js` + Properties Panel
- **Ziel**: Einfache UX, entfernt nicht-unterstützte BPMN-Konstrukte, fügt Flowable-spezifische Properties hinzu
- **Stil**: Minimale, fokussierte Änderungen. Vermeide breite Refactorings.

## Tech Stack
- **Core**: `bpmn-js`, `bpmn-js-properties-panel`, `@bpmn-io/properties-panel` (Preact-basiert)
- **Build**: Vite (Node 18+ empfohlen)
- **Sprache**: TypeScript (ES Module)
- **Sidecar**: Lightweight Protocol + Transports für Embedding in Angular/Tauri/Browser
- **Tauri**: Minimaler Host Harness (kein UI) für Datei I/O

## Wichtige Befehle
```bash
# Development
npm run dev

# Build & Test
npm run build
npm test

# Tauri
npm run dev:tauri
npm run build:tauri

# Windows Builds
npm run build:win:nsis
npm run build:win:msi
npm run build:win
```

## Datei Struktur (Wichtigste Dateien)
- `src/main.ts`: App Bootstrap, Canvas + Properties Panel Wiring, Datei I/O, Zoom
- `src/flowable-moddle.ts`: Flowable Moddle Extension (Namespaces und Types)
- `src/flowable-properties-provider.ts`: Provider Wrapper, importiert alle Contributors
- `src/properties/helpers/entries.ts`: Zentrale Export-Oberfläche für Properties Panel Entry Components
- `src/properties/contributors/`: Fokussierte Contributor Module für verschiedene BPMN-Elemente
- `src/properties/entries/`: Konkrete UI Entry Implementierungen

### Tabs (Multi-Diagram Support)
- `src/bpmn-tabs/tabs.ts`: Accessible Tabs Manager
- `src/bpmn-tabs/tabs.css`: Tab Bar Styles
- `src/bpmn-tabs/tabs.html`: Markup Referenz

### Sidecar (Component ↔ Host Interface)
- `src/sidecar/shared/protocol.ts`: Protocol Definition, Message Types
- `src/sidecar/transports/`: DOM/postMessage/Memory Transports
- `src/sidecar/bridge.ts`: Request/Response/Event Bridge

## Development Konventionen

### Code Style
- **WICHTIG**: Füge KEINE Kommentare hinzu, außer wenn explizit gefragt
- Folge bestehenden Code-Konventionen im Projekt
- Verwende bestehende Libraries und Utilities
- Prüfe immer, ob Libraries bereits im Projekt verfügbar sind (package.json)

### Properties Panel Architektur
- **Provider**: Dient als Composition Shell; alle Funktionalität kommt von Contributors
- **Contributors**: Müssen pure bleiben: keine `useService` Calls, nur Guard Checks + Group/Entry Mutations
- **UI Components**: Leben in `src/properties/entries/` und werden über `helpers/entries.ts` exportiert

### Wichtige Patterns
- Verwende `useService('modeling')` und `updateProperties` für einfache Properties
- Verwende `updateModdleProperties` für nested/moddle Instanzen
- Respektiere `isEdited` Helpers: `isTextFieldEntryEdited`, `isCheckboxEntryEdited`
- Einfügungen immer nach `ID` (fallback `Name`) für stabile UX

## Multi-Tab Support
- Editor unterstützt mehrere BPMN Diagramme parallel
- Jeder Tab besitzt einen separaten `bpmn-js` Modeler und Properties Panel
- Dirty State Tracking über gehashte XML Baseline
- Verwende `runWithState(state, fn)` für Tab-spezifische Operationen

## Sidecar Integration
- Editor läuft standalone, kann aber mit externem Host integriert werden
- Unterstützte Operationen: `doc.load`, `doc.save`, `doc.saveSvg`, `doc.openExternal`
- UI Operationen: `ui.setPropertyPanel`, `ui.setMenubar`
- Auto-Detection: iframe → postMessage, sonst DOM CustomEvents

## Tauri v2 Capabilities
- Permissions in `src-tauri/capabilities/main.json` definiert
- Aktuell: `core:event`, `dialog:allow-open/save`, `fs:allow-read/write-text-file`
- FS Permissions auf `$HOME/**` beschränkt

## Testing & Validation
- Immer `npm run build` nach Änderungen ausführen
- Keine Tests committen ohne explizite Aufforderung
- Prüfe Linting und Typecheck Befehle im package.json

## Import/Export Verhalten
### Import (Model Updates für bessere UX)
- Fügt `bpmn:MessageEventDefinition` zu Start/IntermediateCatch/Boundary hinzu wenn Flowable Event Metadata existiert
- Expandiert alle SubProcess DI Shapes
- Mappt `ServiceTask[flowable:type=send-event]` zu SendTask
- Mappt `ServiceTask[flowable:type=dmn]` zu BusinessRuleTask

### Export (String-Level XML Rewrites)
- CDATA Wrapping für verschiedene Flowable Elemente
- Entfernt `messageEventDefinition` nur aus serialisiertem XML
- Mappt SendTask/BusinessRuleTask zurück zu ServiceTask mit entsprechenden Flowable Types
- Normalisiert Error References und Variable Aggregation Definitions

## Debugging
- Debug Logs via `?debug=1` oder `localStorage.setItem('fleditor:debug','1')`
- Editor Logs: `[fleditor]`
- Host Logs: Host-spezifisches Prefix (z.B. `[tauri-host]`)

## Do's & Don'ts
### Do:
- Kleine, zielgerichtete Änderungen bevorzugen
- Bestehende Patterns und Konventionen folgen
- `apply_patch` für Dateiänderungen verwenden
- Build nach Änderungen ausführen

### Don't:
- Keine Host-spezifischen API Calls direkt im Component
- Keine `useService` Calls in `getGroups` außer in Entry Components
- Keine unrelated Code-Änderungen oder Formatting-only Diffs
- Keine git commits ohne explizite Aufforderung

## Häufige Aufgaben
### Checkbox Property hinzufügen
```typescript
// Entry Component mit CheckboxEntry und useService('modeling')
// isEdited: isCheckboxEntryEdited verwenden
// Nach ID in entsprechende Group einfügen
```

### Text/Textarea Property hinzufügen
```typescript
// TextFieldEntry/TextAreaEntry verwenden
// bo.get('ns:prop') für Fetch, updateProperties für Persist
// Für nested/moddle: bpmnFactory + updateModdleProperties
```

## Troubleshooting
- **Build fails**: Rerun mit erhöhten Berechtigungen
- **Properties nicht updaten**: Prüfe `updateProperties` vs `updateModdleProperties`
- **Entry nicht gezeigt**: Verifiziere `getGroups` Conditions und Group ID Match
- **Permissions denied**: Prüfe `src-tauri/capabilities/main.json`

---

**Definition of Done**: Funktional korrekt, minimale Oberflächen-Änderungen, Build erfolgreich, keine unrelated Code-Änderungen.