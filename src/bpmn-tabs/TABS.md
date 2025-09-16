# TABS.md – Tabbed Panes für BPMN-Editor

## TL;DR
Ein zugängliches Tabs-System in Vanilla TypeScript, das mehrere BPMN-Diagramme parallel unterstützt.  
Features: Tabs öffnen/aktivieren/schließen, Overflow-Scrolling mit Pfeilbuttons, Tastatur-Shortcuts, A11y nach ARIA-Pattern, Hook-Punkte zum Mounten/Destroyen von **bpmn-js**-Instanzen und Dirty-Indicator.

## Ziele & Anforderungen
- **Mehrere Diagramme** parallel; jedes Diagramm in eigenem Panel.  
- **Tabbed Panes** zum Wechseln; **Schließen** einzelner Tabs.  
- **Horizontales Scrollen** der Tab-Leiste bei Overflow + **Pfeilbuttons**.  
- **A11y & Keyboard:** Arrow-Navigation, Home/End, Enter/Space zum Aktivieren, **Ctrl/Cmd+W** zum Schließen.  
- **Hooks** für bpmn-js Lifecycle (Mount/Destroy/Activate).  
- **Dirty-Marker** (●) bei ungespeicherten Änderungen.

## Architektur Überblick
```html
<div class="tabs" id="diagramTabs">
  <div class="tabbar">
    <button class="scroll-btn left" aria-hidden="true" tabindex="-1" title="Scroll left">◀</button>
    <div class="tablist" role="tablist" aria-label="Open diagrams"></div>
    <button class="scroll-btn right" aria-hidden="true" tabindex="-1" title="Scroll right">▶</button>
  </div>
  <div class="panels"></div>
</div>
```
- **tablist** hält `.tab` Buttons (role="tab").  
- **panels** enthält `.tabpanel` (role="tabpanel"), exakt eins sichtbar (`aria-hidden="false"`).  
- **Tabs.ts** kapselt: `add`, `activate`, `close`, `markDirty`, Overflow-Erkennung, Keyboard + Scroll.

## Accessibility (Key Points)
- Rollen/Attribute: `role="tablist" | "tab" | "tabpanel"`, `aria-controls`, `aria-labelledby`, `aria-selected`, `aria-hidden`.  
- Fokusmodell: „Tab in das Widget; Pfeiltasten navigieren; Enter/Space aktivieren“.  
- Buttons für horizontales Scrollen sind nur sichtbar, wenn Overflow vorhanden.

## Edge-Cases & bpmn-js Besonderheiten
- **Versteckte Panels (`display:none`)**: Beim Aktivieren muss `canvas.resized()` aufgerufen werden (sonst falsche Viewbox). Optional zusätzlich `canvas.zoom('fit-viewport')`, wenn gewünscht.  
- **Dirty-Check**: Vor dem Schließen kann via `onClose` vetoed werden (z. B. Confirm-Dialog).  
- **Viele Tabs**: Perf ist ok; bpmn-js pro Tab wird beim Anlegen montiert und beim Schließen zerstört.  
- **Mittelklick** zum Schließen möglich (optional).  
- **Persistenz**: Zuletzt aktiven Tab in `localStorage` ablegen (optional Snippet unten).

## Dateien
- `tabs.html` – Markup
- `tabs.css` – Styles inkl. Overflow/Scroll-Snap
- `tabs.ts` – Tab-Manager
- `tabs-usage-bpmn.ts` – Integration mit **bpmn-js**

---
