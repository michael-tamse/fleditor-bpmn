# Claude Development Guide für BPMN Editor

Dieses Dokument enthält wichtige Informationen für Claude zur Arbeit mit diesem BPMN Editor Projekt.

## Projekt Überblick
- **Typ**: Multi-Format Editor für BPMN, DMN und Event Definitions basierend auf `bpmn-js` + `dmn-js`
- **Ziel**: Einfache UX mit Flowable-spezifischen Properties, Multi-Tab Support, Event Registry Integration
- **Stil**: Minimale, fokussierte Änderungen. Vermeide breite Refactorings.

## Tech Stack
- **Core**: `bpmn-js` (v11.0.0), `dmn-js` (v17.4.0), `bpmn-js-properties-panel` (v1.26.0), `@bpmn-io/properties-panel` (v2.2.0)
- **Build**: Vite (v7.1.5)
- **Sprache**: TypeScript (v5.9.2, ES Module)
- **Sidecar**: Lightweight Protocol + Transports für Embedding in Angular/Tauri/Browser
- **Tauri**: v2.8.x mit minimaler Host Harness für Datei I/O
- **State Management**: Custom reducer pattern mit zentralem store

## Wichtige Befehle
```bash
# Development
npm run dev
npm run dev:host    # Browser host variant

# Build
npm run build
npm run preview

# Tauri Desktop
npm run dev:tauri
npm run build:tauri

# Windows Specific
npm run build:win:nsis
npm run build:win:msi
npm run build:win:all
npm run build:win
```

## Aktuelle Tests
- Keine nativen Test-Suites vorhanden
- Testing erfolgt manuell über `npm run build` + Preview
- Verwende immer `npm run build` nach Änderungen

## Datei Struktur (Wichtigste Dateien)
- `src/main.ts`: App Bootstrap, Sidecar Init, Module Dependencies, Event Handlers
- `src/tab-manager.ts`: Multi-Tab State Management, Tab Creation/Switching
- `src/modeler-setup.ts`: BPMN/DMN Modeler Configuration, Shape Handling
- `src/file-operations.ts`: File I/O, XML Processing, Save/Load Operations
- `src/ui-controls.ts`: Toolbar, Status, Zoom, Visibility Controls
- `src/change-tracker.ts`: Dirty State Management, XML Baseline Hashing

### Properties Panel Architecture
- `src/flowable-properties-provider.ts`: Provider Wrapper, registriert alle Contributors
- `src/properties/contributors/index.ts`: Zentrale Contributors Export
- `src/properties/contributors/`: Element-spezifische Contributors (18 Module)
- `src/properties/helpers/entries.ts`: UI Entry Components Export Interface
- `src/properties/entries/`: Konkrete UI Entry Implementierungen

### Multi-Tab Support
- `src/bpmn-tabs/tabs.ts`: Accessible Tabs Manager mit Keyboard Navigation
- `src/bpmn-tabs/tabs-usage-bpmn.ts`: Tab Specific BPMN Integration
- `src/state/`: Redux-style State Management (store, reducer, selectors)

### Multi-Format Support
- `src/dmn-support.ts`: DMN Decision Table Integration
- `src/dmn-tab.ts`: DMN Tab Management
- `src/dmn/dmn-factory.ts`: DMN Modeler Factory
- `src/event-editor/`: Event Registry Editor für Event Definitions

### Sidecar (Component ↔ Host Interface)
- `src/sidecar/shared/protocol.ts`: Protocol v1.0.0, Message Types, Capabilities
- `src/sidecar/transports/`: Transport Layer (DOM/postMessage/Memory)
- `src/sidecar/bridge.ts`: Request/Response/Event Bridge mit Handshake
- `src/integrations/`: Editor Registry, Event Bridge für Host Communication

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

## Multi-Tab & Multi-Format Support
- Editor unterstützt parallel: BPMN Diagramme, DMN Decision Tables, Event Definitions
- Jeder Tab besitzt einen separaten Modeler (bpmn-js/dmn-js/event-editor) und Properties Panel
- State Management über Map<string, DiagramTabState> mit Dirty Tracking
- Tab-spezifische Operationen: `runWithState(state, fn)` für sichere State Isolation
- Tab-übergreifende Features: Duplicate Detection, Auto-Save, Persistence

## Sidecar Integration (Host Embedding)
- Editor läuft standalone, kann aber mit externem Host integriert werden
- **Unterstützte Operationen**:
  - `doc.load`, `doc.loadMany`, `doc.save`, `doc.saveSvg`, `doc.openExternal`
  - `ui.setPropertyPanel`, `ui.setMenubar`
- **Auto-Detection**: iframe → postMessage, sonst DOM CustomEvents
- **Protocol**: `bpmn-sidecar` v1.0.0 mit Capability Negotiation

## Tauri v2 Capabilities
- Permissions in `src-tauri/capabilities/main.json` definiert
- Aktuell: `core:event`, `dialog:allow-open/save`, `fs:allow-read/write-text-file`
- FS Permissions auf `$HOME/**` beschränkt

## Testing & Validation
- **WICHTIG**: Immer `npm run build` nach Änderungen ausführen
- Keine nativen Test-Suites oder Linting-Scripts vorhanden
- Manual Testing über `npm run dev` und `npm run preview`
- Keine Tests committen ohne explizite Aufforderung

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

### Neue Property hinzufügen
1. **Entry Component erstellen** in `src/properties/entries/`
2. **Entry exportieren** in `src/properties/helpers/entries.ts`
3. **Contributor erstellen/erweitern** in `src/properties/contributors/`
4. **Contributor registrieren** in `src/properties/contributors/index.ts` und `src/flowable-properties-provider.ts`

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

### Neuen Tab-Typ hinzufügen
1. **DiagramTabState** erweitern in `src/types.ts`
2. **Tab Creation Logic** in `src/tab-manager.ts`
3. **Modeler Setup** in `src/modeler-setup.ts`
4. **File Operations** in `src/file-operations.ts`

## Troubleshooting
- **Build fails**: Rerun mit erhöhten Berechtigungen
- **Properties nicht updaten**: Prüfe `updateProperties` vs `updateModdleProperties`
- **Entry nicht gezeigt**: Verifiziere `getGroups` Conditions und Group ID Match
- **Permissions denied**: Prüfe `src-tauri/capabilities/main.json`

---

**Definition of Done**: Funktional korrekt, minimale Oberflächen-Änderungen, Build erfolgreich, keine unrelated Code-Änderungen.