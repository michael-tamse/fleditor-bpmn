# Event Editor

Ein standalone Event-Definition-Editor für Flowable Event Registry JSON-Modelle. Der Editor ist vollständig in den BPMN Editor Tab-System integriert.

## Features

- ✅ **Event Key/Name**: Header-Felder für Event-Metadaten
- ✅ **Feld-Management**: Add/Remove/Reorder von Event-Feldern
- ✅ **Feld-Typen**: string, integer, double, boolean, json
- ✅ **Correlation-Parameter**: Checkbox zur Kategorisierung von Feldern
- ✅ **UI-Status**: Header, Full payload, Meta Checkboxen (nur UI, nicht serialisiert)
- ✅ **Validation**: Echtzeit-Validierung mit visueller Fehleranzeige
- ✅ **Drag & Drop**: Sortierung der Felder via Drag-and-Drop
- ✅ **Import/Export**: JSON-Import über Datei-Dialog, Export als Download
- ✅ **Copy-to-Clipboard**: Kopiert JSON in die Zwischenablage
- ✅ **Dirty State Tracking**: Integriert mit dem Tab-System für Änderungsanzeigen

## Verwendung im Tab-System

Der Event Editor wird automatisch erstellt, wenn ein Event-Tab geöffnet wird:

```typescript
// Event-Tab erstellen (bereits in tab-manager.ts integriert)
createNewDiagram('event');
```

## JSON-Datenmodell (Flowable Event Registry)

```json
{
  "key": "customerPaymentEvent",
  "name": "Customer Payment",
  "correlationParameters": [
    { "name": "customerId", "type": "string" }
  ],
  "payload": [
    { "name": "amount", "type": "integer" },
    { "name": "currency", "type": "string" },
    { "name": "meta", "type": "json" }
  ]
}
```

## API

### `createEventEditor(container, options)`

```typescript
const editor = createEventEditor(document.getElementById('container'), {
  model: {
    key: 'myEvent',
    name: 'My Event',
    correlationParameters: [],
    payload: []
  },
  onChange: (model) => console.log('Model changed:', model),
  onDirtyChange: (dirty) => console.log('Dirty state:', dirty)
});
```

### EventEditor Instanz Methoden

- `getModel()`: Gibt das aktuelle EventModel zurück
- `setModel(model)`: Setzt ein neues EventModel
- `setReadOnly(readonly)`: Aktiviert/deaktiviert den Nur-Lese-Modus
- `dispose()`: Räumt Ressourcen auf

## Validierung

- **Event Key**: Pflichtfeld, keine Leerzeichen
- **Event Name**: Pflichtfeld
- **Feldnamen**: Pflichtfeld, keine Duplikate zwischen correlation und payload
- **Export**: Nur bei gültigen Modellen möglich

## Keyboard Shortcuts

- **Tab**: Navigation zwischen Feldern
- **Enter**: In Feldern - nächstes Feld fokussieren
- **Space**: Checkboxen umschalten
- **Delete**: In leeren Feldern - Zeile löschen (via Button)

## UI Komponenten

### Header
- Event Key (Input)
- Event Name (Input)
- Toolbar mit Import/Export/Copy Buttons

### Tabelle
- Field name (Text Input)
- Type (Select: string, integer, double, boolean, json)
- Header (Checkbox, UI only)
- Full payload (Checkbox, UI only)
- Correlation (Checkbox - bestimmt correlationParameters vs payload)
- Meta (Checkbox, UI only)
- Actions (Move Up/Down, Delete, Drag Handle)

### Footer
- "Add attribute" Button

## Integration Details

- **CSS**: Verwendet das gleiche Design-System wie der BPMN Editor
- **Tab Integration**: Ersetzt die Properties Panel für Event-Tabs
- **Change Tracking**: Integriert mit dem bestehenden Dirty State System
- **Export**: Event-Tabs ändern die Toolbar-Button-Labels entsprechend

## Dateien

```
src/event-editor/
├── event-editor.ts       # Haupt-Komponente und API
├── event-editor.css      # Styling
└── README.md            # Diese Dokumentation
```

## Tauri Integration

Für Tauri-Host-Anwendungen sind keine zusätzlichen Änderungen erforderlich. Der Event Editor funktioniert automatisch mit dem bestehenden Tab-System.