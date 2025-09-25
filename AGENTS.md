# AGENTS.md

This document guides agents (and contributors) working on this BPMN editor. It covers the codebase layout, conventions, and how to safely make changes via the Codex CLI.

## Overview
- Scope: Lightweight Flowable modeller covering BPMN diagrams, DMN decision tables, and Event Registry JSON via dedicated tabs.
- Goals: Keep UX simple, remove unsupported constructs, add Flowable-centric defaults/properties where helpful, and keep save/export output host-safe.
- Style: Minimal, focused changes. Avoid broad refactors and keep behavior predictable.

## Tech Stack
- Core: `bpmn-js`, `dmn-js`, `bpmn-js-properties-panel`, `@bpmn-io/properties-panel` (Preact-based entries)
- Event Editor: bespoke TypeScript/Preact-lite component under `src/event-editor/` for Flowable Event Registry JSON
- Build: Vite (Node 18+ recommended)
- Language: TypeScript (ES modules)
 - Sidecar: Lightweight protocol + transports (DOM/postMessage) for embedding in Angular/Tauri/Browser hosts
 - Tauri: Minimal host harness (no UI) that speaks the Sidecar protocol via DOM and performs file I/O/dialog (Tauri v2)

## Run & Build
- Dev: `npm run dev`
- Host Demo (Browser): `npm run dev:host` → opens `/hosts/browser/`
- Build: `npm run build`
- Preview: `npm run preview`
 - Tauri Dev: `npm run dev:tauri` (requires Rust + Tauri CLI). Dev server must bind `5173`.
- Tauri Build: `npm run build:tauri`
 - App Bundle (macOS .app only): `npx @tauri-apps/cli@latest build --bundles app`
- Windows Bundles:
   - NSIS: `npm run build:win:nsis`
   - MSI (WiX v3 required): `npm run build:win:msi`
   - Both: `npm run build:win` (alias to `nsis,msi`)
   - Legacy alias kept for CI: `npm run build:win:all`

Note: Large bundle warnings are expected; not a blocker.

## Key Files
- `src/main.ts`: Lightweight orchestrator that wires toolbar, tab manager, sidecar bridge, and module globals; delegates actual model handling to specialised modules.
- `src/tab-manager.ts`: Core tab lifecycle (create/activate/close) across BPMN, DMN, and Event tabs, integrates the accessible tab UI, toolbar button state, and tab persistence.
- `src/change-tracker.ts`: Bridges tab instances into the global store, mirrors dirty markers to the UI/host, and delegates DMN bindings to `integrations/dmn-bridge`.
- `src/state/`: Lightweight Redux-style store (`store.ts`, `types.ts`, `reducer.ts`, `selectors.ts`, `rootStore.ts`) centralising `activeTab`, dirty flags, selection IDs, and `modelVersion` counters; effects attach via `attachEffects(store)` to avoid circular imports.
- `src/integrations/dmn-bridge.ts`: Single bind/unbind point for `dmn-js` (eventBus + commandStack) that dispatches selection/model changes and cleans listeners on destroy.
- `src/effects/effects.ts`: Effect layer subscribed to the store (autosave scheduling, DMN title/ID sync, action ring buffer for debugging) – initialised via `attachEffects(store)`.
- `src/util/throttle.ts`: Shared `throttle`/`debounce` helpers used by the bridge/effects.
- `src/file-operations.ts`: Open/save flows (host + local), duplicate detection, event JSON handling, export preparation, and download fallbacks.
- `src/modeler-setup.ts`: Per-tab modeler bootstrap (BPMN/DMN), drag & drop import, default Flowable injections for new shapes, and change-tracking wiring.
- `src/model-transformations.ts`: Export-time Flowable rewrites invoked before saving (external-worker stencils, mapping normalisation, etc.).
- `src/bpmn-xml-utils.ts`: Shared XML helpers for ID derivation, DI expansion, BPMN/DMN transformations, filename sanitising, and initial XML generation.
- `src/dmn-support.ts`: DMN utilities (decision ID/name sync, tab title updates, initial DMN XML helpers).
- `src/dmn/dmn-factory.ts`, `src/dmn-tab.ts`: Flowable-aware DMN modeler factory plus standalone web component used as DMN canvas.
- `src/event-editor/`: Standalone Event Registry editor (TS + CSS + README) embedded in event tabs; exposes `createEventEditor` API and dirty tracking hooks.
- `src/ui-controls.ts`: Toolbar actions, status/confirm UI, zoom helpers, property-panel visibility management, menubar toggling, and debug logging.
- `src/flowable-moddle.ts`: Flowable moddle extension declaration (namespaces and types) including Event/Mapping/Variable Aggregation/Start Correlation types.
- `src/flowable-properties-provider.ts`: Slim provider wrapper. Imports all contributors and runs them via `compose(...)`; no element-specific logic remains here.
- `src/properties/helpers/entries.ts`: Central export surface for all properties-panel entry components. Contributors import from here for consistency.
- `src/properties/contributors/`: Focused contributor modules (service-task, call-activity, message events, error events, business-rule task, multi-instance, variable aggregations, etc.). Each contributor stays pure and only mutates provided groups based on guard checks.
- Shell/UI assets: `styles.css`, `index.html` (toolbar, add-menu, start tiles), `src/bpmn-tabs/` (accessible tabs implementation and styles).
- Sidecar bridge: `src/sidecar/shared/protocol.ts`, transports (`dom.ts`, `postMessage.ts`, `memory.ts`) and `src/sidecar/bridge.ts` for request/response plumbing.
- Host harnesses: `hosts/browser/*` (iframe demo) and `hosts/tauri/main.ts` (Tauri v2 bridge + capabilities under `src-tauri/capabilities/`).

Quick anchors (open in IDE):
- `src/file-operations.ts` → open/save pipeline, duplicate detection, host fallbacks, event JSON support.
- `src/tab-manager.ts` → multi-kind tab orchestration, toolbar states, dirty close prompts.
- `src/dmn-support.ts` → DMN ID/name sync + tab title helpers.
- `src/event-editor/` → embedded Flowable Event Registry editor (standalone API + styling).
- `src/flowable-properties-provider.ts` → contains only the `FlowablePropertiesProvider` shell that logs, runs contributors, and returns the mutated `groups` array.
- `src/properties/contributors/` → modular logic for all Flowable properties (execution flags, call activity, send/receive/message events, errors, business rule task, multi-instance, variable aggregations, etc.).
- `src/properties/helpers/entries.ts` → shared re-exports for entry components; use this file when adding a new contributor.
- `src/properties/entries/` → concrete UI entry implementations (business-rule task, multi-instance, variable aggregations, event registry, error, etc.).

### Properties Architecture
- Provider serves as composition shell; all behaviour stems from contributors listed in the compose call (keep the order stable when inserting new ones).
- Contributors must stay pure: no `useService` calls, only guard checks + group/entry mutations.
- UI components live in `src/properties/entries/` and are exported through `helpers/entries.ts` so contributors share the same import path.
- Helper modules (`helpers/dmn.ts`, `helpers/flowable-events.ts`, `helpers/variable-aggregations.ts`, etc.) encapsulate moddle access/manipulation for reuse across entries/contributors.
- Modeler wiring spans `src/main.ts` (wiring), `src/modeler-setup.ts` (bootstrap + defaults), `src/model-transformations.ts` (export tweaks), and `src/bpmn-xml-utils.ts` (shared XML helpers).
- Tab integration lives in `src/tab-manager.ts` with support modules (`change-tracker.ts`, `ui-controls.ts`, `file-operations.ts`); `main.ts` only exposes globals and sidecar glue.
 - Tauri integration:
   - `src-tauri/src/main.rs` → app builder, `tauri-plugin-single-instance`, `tauri-plugin-fs`, `tauri-plugin-dialog`, app‑level `open-files` emission, `pending_files_take` command.
   - `hosts/tauri/main.ts` → host bridge using plugin‑dialog/fs, drains `pending_files_take`, listens `open-files`, forwards via `doc.openExternal`.
   - `src/sidecar/shared/protocol.ts` → includes `doc.openExternal` op.
   - Capabilities files: `src-tauri/capabilities/main.json` enables `event.listen`, `dialog.open/save`, `fs.read/write` for window `main`.

## Tabs (Multi‑Diagram)
- Overview: Accessible tab system hosting BPMN modelers, DMN modelers, and the Event Registry editor side-by-side. Each tab owns its own modelling instance and layout (properties panel hidden automatically for event tabs).
- Files: `src/tab-manager.ts` (lifecycle), `src/bpmn-tabs/tabs.ts`/`tabs.css` (UI widget), `index.html` (tab bar + add menu markup), optional demo `src/bpmn-tabs/tabs-usage-bpmn.ts`.
- UX:
  - `＋ Neues Diagramm` opens a split-button menu for BPMN, DMN, or Event tabs; the empty state exposes the same choices as tiles.
  - No auto-tab on load or after closing the last tab. The empty state invites users to create/open content.
  - Context menu per tab: Close, Close Others, Close All. Ctrl/Cmd+W closes the active tab; middle‑click closes a tab.
  - Overflow arrows appear when the tablist scrolls; keyboard navigation uses Left/Right/Home/End and Enter/Space.
  - Dirty indicator (●) per tab based on hashed baseline (XML/JSON depending on diagram kind).
  - Toolbar buttons adapt to the active tab (Haupt-Button immer `Speichern`, SVG bleibt nur für BPMN aktiv) via `tab-manager`.
- Integration:
- `DiagramTabState` includes `{ id, kind, modeler, panelEl, layoutEl, canvasEl, propertiesEl, title, fileName?, dirty, baselineHash?, isImporting }` stored in a shared Map owned by `tab-manager.ts`.
- `change-tracker.ts` provides `setDirtyState`, `updateBaseline`, and DMN/event dirty scheduling; `main.ts` wires these helpers onto `window` for cross-module access.
- `file-operations.ts` handles imports (host/local/drag-drop), runs duplicate checks via `openXmlConsideringDuplicates`, and updates baselines after save/import.
- Active tab metadata persists in `localStorage` (`fleditor:lastActiveTab`) so reloads can re-activate a matching tab by title/file.
- `modeler-setup.ts` bootstraps BPMN/DMN modelers per tab, binds drag/drop, and applies Flowable defaults when new shapes appear.
- The store emits single-source-of-truth events (`TAB/*`, `EDITOR/*`); DMN dirty/title handling now listens via `effects.ts` instead of local debounces.

### New Tab Defaults
- BPMN: `computeNextProcessId()` scans open tabs, `createInitialXmlWithProcessId(pid)` fills IDs/DI, and tab titles default to the generated `Process_n` value.
- DMN: Tabs start from `Decision_<n>` IDs using `createInitialDmnXmlWithDecisionId()`; model changes bump `modelVersion` in the store, triggering centralised sync/title effects.
- Event: Tabs default to `Event_<n>` with an empty Flowable Event Registry model; the event editor keeps key and name in sync initially.

### Empty State
- `#emptyState` inside `.panels` toggles via `updateEmptyStateVisibility()` and offers start tiles for BPMN, DMN, and Event documents.

### Live Title Sync
- BPMN: `commandStack.changed` triggers `deriveProcessIdFromModel()` → `updateStateTitle(...)`.
- DMN: `dmn-support.ts` debounces name changes, updates IDs through the DMN modeling API, then refreshes tab titles.
- Event: `EventEditor` calls `onDirtyChange` which in turn updates dirty markers; titles follow the event key/name set by the editor and are mirrored into the store.

### Duplicate-Open Handling
- `openXmlConsideringDuplicates(xml, fileName?, source)` detects BPMN vs DMN (`detectDiagramType`) and derives the relevant ID (`deriveProcessId` / `deriveDmnId`).
- If a matching tab exists and is dirty, a confirm dialog gates overwriting; otherwise imports reuse the existing tab. Event JSON always opens into a new event tab via `openEventFile`. Store state follows these open/overwrite paths automatically.

### Tauri‑Safe Confirm Dialogs
- Use `showConfirmDialog(message, title?, options?)` instead of `window.confirm`. Styles live under `.tab-confirm-overlay` / `.tab-confirm` in `src/bpmn-tabs/tabs.css`.

### Toolbar & Buttons
- The old "Neu" button is replaced by the `＋ Neues Diagramm` split button; `tab-manager` toggles submenu visibility and routes selections to `createNewDiagram(kind)`.
- Zoom buttons auto-hide for DMN/Event tabs (`ui-controls.ts`), and the save button caption switches to `Speichern` for event tabs.

### Tabs Do / Don’t
- Do: Create/destroy modelling instances per tab; BPMN uses `BpmnModeler`, DMN uses the custom DMN modeler, event tabs use `EventEditor`.
- Do: Route per-tab operations through `runWithState(state, ...)` exposed by `tab-manager`; rely on `updateBaseline`/`setDirtyState` to maintain host signals. The store listens to these calls and keeps host/UI state in sync.
- Don’t: Reuse `modeler` globals outside `runWithState`; event tabs expose their API through the stored `modeler` reference.
- Don’t: Skip baseline updates—always call `updateBaseline(state)` after imports/saves (BPMN, DMN, and event). The autosave effect assumes baselines are current.

### Markup & Styles
- `index.html` now includes `.add-split` (split button + submenu) and `.start-tiles` inside `#emptyState` for the three diagram kinds.
- Each tab panel hosts a `.diagram-pane` wrapper with `.canvas`/`.properties`; event tabs receive `hide-properties` to collapse the properties column.
- `styles.css` keeps the responsive layout; `src/bpmn-tabs/tabs.css` styles the tab bar, add menu, confirm dialog, and empty state tiles.

## Event Editor
- Location: `src/event-editor/` (TS component, CSS, README). The `createEventEditor` factory is consumed by `tab-manager.ts` when `DiagramTabState.kind === 'event'`.
- Model: Flowable Event Registry JSON with `{ key, name, correlationParameters[], payload[] }`. Import via `.event` files or host `doc.openExternal` payloads.
- API surface: returned editor exposes `getModel()`, `setModel(model)`, `setReadOnly(flag)`, `updateBaseline()`, and `dispose()`—the tab stores the instance in `state.modeler` for reuse.
- Dirty tracking: `onDirtyChange` hooks into `change-tracker.setDirtyState`; `updateBaseline(state)` serialises JSON (pretty) to derive hashes.
- Saving: `file-operations.prepareXmlForExport()` returns JSON for event tabs; host `doc.save` receives `{ json, diagramType: 'event' }`. Browser fallback downloads `<eventKey>.event`.
- Toolbar: `tab-manager` renames the primary save button to `Speichern` and disables SVG export for event tabs automatically.
- Styling: `event-editor/event-editor.css` blends with the core design system; adjust here when changing layout (BEM-style class names, CSS variables shared with `styles.css`).

## Sidecar Integration
- Overview: The editor runs standalone, but can integrate with an external host (Angular, Tauri, Browser) via a versioned, bidirectional interface.
- Protocol: `bpmn-sidecar` with `handshake:init/ack`, `req/res`, `event`, `error`. Capabilities declare available host features and operations.
- Supported ops:
  - `doc.load` (Comp → Host): host returns BPMN/DMN XML (`{ xml, fileName? }`); empty/invalid responses abort without local fallback.
  - `doc.save` (Comp → Host): host persists BPMN/DMN XML (`{ xml, diagramType: 'bpmn' | 'dmn' }`) or Event JSON (`{ json, diagramType: 'event' }`).
  - `doc.saveSvg` (Comp → Host): host persists BPMN SVG exports (`{ svg, suggestedName }`).
  - `doc.openExternal` (Host → Comp): host forwards BPMN/DMN XML or Event JSON (`{ xml? , json?, fileName? }`) to open/merge in tabs.
  - `ui.setPropertyPanel` (Host → Comp): show/hide property panel.
  - `ui.setMenubar` (Host → Comp): show/hide editor menubar.
- Events (Comp → Host): `ui.state` (menubar/propertyPanel flags), `doc.changed` (dirty hint).
- Transports: DOM CustomEvents (same window), postMessage (iframe). Component auto-detects iframe and prefers postMessage.
- Component wiring (`src/main.ts` + helpers):
  - Startup performs repeated handshake attempts (800 ms timeout, 1 s retry) and once connected injects the sidecar instance into `file-operations` + `change-tracker` modules.
  - Open is host-only: waits ~2 s for connection before falling back to the local file picker; if the host responds with empty payload the action aborts without showing a second dialog.
  - Save/SVG run host-first (`doc.save`/`doc.saveSvg`) and revert to browser downloads on error/decline; event tabs skip SVG entirely and send JSON to the host.
  - UI requests (`ui.setPropertyPanel`, `ui.setMenubar`) mutate layout via `ui-controls.ts` and immediately emit the current `ui.state` back to the host.

### Run the Browser Host Demo
- Dev: `npm run dev`
- Open Host UI: `http://localhost:5173/hosts/browser/`
- Flow:
  - The host iframe-loads `/index.html` (the editor) and sends `handshake:ack`.
  - Toggle menubar/property panel via checkboxes (host sends `ui.set*`).
  - „Datei in Host laden…“ puffert XML im Host; im Editor „Öffnen“ triggert `doc.load` → Host liefert XML.
  - „Speichern“ im Editor triggert `doc.save` → Host lädt `<processId>.bpmn20.xml` oder `<decisionId>.dmn` herunter (Fallback `diagram.*`). Nach erfolgreichem Speichern setzt der aktive Tab seine Baseline (Dirty‑Dot verschwindet).
  - Event-Tabs senden `{ json, diagramType: 'event' }`; extend the host handler to export `<eventKey>.event` (the sample host currently ignores JSON, so editor-side download remains the reliable path).
  - „Speichern SVG“ im Editor triggert `doc.saveSvg` → Host lädt `<processId>.svg` herunter (ersatzweise `diagram.svg`).

### Host Security
- For postMessage hosts, add origin checks on the host side. The demo uses `'*'` for simplicity in dev.

### Adding New Ops
- Extend `OperationName` union in `src/sidecar/shared/protocol.ts` or use string ops for forward-compat.
- Register handlers via `bridge.onRequest(op, handler)` in the host and call via `bridge.request(op, payload)` from the component (and vice versa if needed).
 - Existing ops include: `doc.load`, `doc.save`, `doc.saveSvg`, `ui.setPropertyPanel`, `ui.setMenubar`.

### Tauri Host Behavior
- Dev window loads the editor directly (`index.html`); no separate host UI.
- Host harness (`hosts/tauri/main.ts`) acknowledges `handshake:init` and advertises storage/ui features. It retries briefly if Tauri globals are not ready yet.
- File dialogs and persistence use Tauri v2 plugins `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`.
- File associations: configured in `src-tauri/tauri.conf.json` (`bundle.fileAssociations`). On Windows prefer `.bpmn` (double suffix like `.bpmn20.xml` is effectively `.xml`).
- macOS: For stability we avoid a custom RunEvent handler; cold‑start via “Öffnen mit …” may start the app without auto‑opening the file. Double‑click while the app is running opens a new tab via the single‑instance plugin. In‑app “Öffnen” always works.
- Icons: explicit `bundle.icon` points to `src-tauri/icons/icon.icns|icon.ico|icon.png`. Rebuild the .app to update icons.
- Default file names:
  - XML: `<processId>.bpmn20.xml` extracted from the BPMN `process@id`; falls back to `diagram.bpmn20.xml`.
  - SVG: `<processId>.svg`; falls back to `diagram.svg`.
  - Invalid filename characters are sanitized to `_`.
  - Editor fallback (browser download) and browser host demo use the same naming scheme.

### Debug Logging
- Enable console logs via `?debug=1` or `localStorage.setItem('fleditor:debug','1')`.
- Editor logs (`[fleditor]`): handshake attempts/connected, host requests/responses for open/save/svg, fallback decisions (save only), and open aborts when host is unavailable.
- Tauri host logs (`[tauri-host]`): handshake ack (with potential short retries), `doc.load`/`doc.save`/`doc.saveSvg` requests and outcomes.

## Tauri v2 Capabilities
- Permissions are declared in capability files under `src-tauri/capabilities/` (not in `tauri.conf.json`).
- This app includes `src-tauri/capabilities/main.json` for window `main` with:
  - `core:event:allow-listen` (listen to `open-files`), `core:event:default`, `core:default`
  - `dialog:allow-open`, `dialog:allow-save`, `dialog:default`
  - `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:default`
  - NOTE: To avoid `forbidden path` errors when reading user files, the FS permissions are scoped to the user home: `{ path: "$HOME/**" }`. Extend if you need access outside `$HOME` (e.g., add `$DESKTOP/**`, `$DOCUMENTS/**`).
- If you add host features that use more APIs, extend this file accordingly (prefer least-privilege).

## Properties Panel Customizations
- General group: adds a visual separator after `ID` if extra fields are present.
- SequenceFlow: adds a "Condition Expression" (`bpmn:FormalExpression`) textarea.
- Execution group: injected for engine-executed tasks (Service/Send/Receive/BusinessRule/Script/CallActivity) in this order
  - `flowable:async`, `flowable:exclusive`, `flowable:asyncLeave`, `flowable:asyncLeaveExclusive`
  - spacer, then `isForCompensation` and (for CallActivity) `flowable:completeAsync`.
  - For ServiceTask with `flowable:type="external-worker"` the four async/exclusive checkboxes and spacer are hidden.

### Error Events
- Error Boundary: default Error group is removed. General shows, directly after `ID`:
  - `Error code`: binds to `errorEventDefinition.errorRef` (UI updates existing `<bpmn:error>` instead of creating per keystroke).
  - `Error variable name|transient|local scope`: stored on the `bpmn:ErrorEventDefinition` as Flowable attributes.
  - New group `Error mapping`: list UI over `flowable:in` with entries:
    - `Source` choice: `errorCode` | `errorMessage` | `error`
    - `Target variable` text
    - `Transient` checkbox
- Error Start Event: treated like Error Boundary (same fields and `Error mapping`).
- Message group removal: default Message group is hidden for Message Start/ICE/Message Boundary (we manage with Flowable sections); Error events retain their own custom UI.

### Message Boundary Events
- The three message sections (`Event key`, `Correlation parameter`, `Inbound event mapping`) are shown only for Message Boundary Events (not for Timer/Error boundaries).

### Service Task
- Implementation selector in General: `Delegate Expression` vs `External`.
  - Delegate Expression → `flowable:delegateExpression` text field.
  - External → `Topic` text field bound to `flowable:topic`.
  - Switching to External sets `flowable:type="external-worker"`, `flowable:exclusive=false` and clears `flowable:delegateExpression`, `flowable:(async|asyncLeave|asyncLeaveExclusive)`.
  - Export: writes pretty `extensionElements` with Design stencils for External Worker tasks:
    - `<design:stencilid><![CDATA[ExternalWorkerTask]]></design:stencilid>`
    - `<design:stencilsuperid><![CDATA[Task]]></design:stencilsuperid>`

### BusinessRuleTask (Flowable DMN)
- Import view: `bpmn:ServiceTask[flowable:type=dmn]` is shown as `bpmn:BusinessRuleTask`.
- General (after `ID`):
  - `Decision table reference` → `<flowable:field name="decisionTableReferenceKey"><flowable:string><![CDATA[value]]></flowable:string></flowable:field>`
  - `Throw error if no rules were hit` (checkbox) → `<flowable:field name="decisionTaskThrowErrorOnNoHits"><flowable:string><![CDATA[true|false]]></flowable:string></flowable:field>`
- Defaults (no UI; ensured on save):
  - `<flowable:field name="fallbackToDefaultTenant"><flowable:string><![CDATA[true]]></flowable:string></flowable:field>`
  - `<flowable:field name="sameDeployment"><flowable:string><![CDATA[true]]></flowable:string></flowable:field>`
  - `<flowable:decisionReferenceType><![CDATA[decisionTable]]></flowable:decisionReferenceType>`
  - Export view: `bpmn:BusinessRuleTask` → `bpmn:ServiceTask[flowable:type=dmn]` (defaults and fields preserved).

### Send Task (message send-event)
- General: `Event key (type)` → `<flowable:eventType>` (CDATA).
- Checkbox: `Send synchronously` → `<flowable:sendSynchronously><![CDATA[true]]>`.
- Section: `Outbound event mapping` → list of `<flowable:eventInParameter source target>`.
  - First add is prefilled with `source="${execution.getProcessInstanceBusinessKey()}"`, `target="businessKey"`.
- Export safety: ensures one default `eventInParameter` and one `<flowable:systemChannel/>` exist if none present.

### Receive Task (message receive)
- General: `Event key (type)` → `<flowable:eventType>` (CDATA).
- Section: `Correlation parameter` (single entry, not a list) → `<flowable:eventCorrelationParameter name value>`.
- Section: `Inbound event mapping` → list of `<flowable:eventOutParameter source target transient?>`.
- Defaults: newly created ReceiveTasks get a default correlation parameter (`businessKey` / `${execution.getProcessInstanceBusinessKey()}`).

### Intermediate Catch Event / Boundary Event (message-style)
- Same three sections as ReceiveTask when NOT a Timer or Error Boundary event.
- Default `Message` group is removed.
- Defaults: newly created ICE/Boundary get default correlation parameter (`businessKey` / `${execution.getProcessInstanceBusinessKey()}`), except for Timer or Error Boundary events.

### Start Event (message-style only)
- Shows the three sections only if Flowable message metadata exists (presence of `<flowable:eventType>` or `<flowable:eventCorrelationParameter>`) or a `bpmn:MessageEventDefinition` is present, and not a Timer Start.
- Setting `Event key (type)` auto-creates the default correlation parameter if missing.
- Export safety: ensures `<flowable:startEventCorrelationConfiguration><![CDATA[startNewInstance]]>` exists for message-starts.

### Call Activity
- General additions: `Process reference` (`calledElement`), `Business key` (`flowable:businessKey`), `Inherit business key` (`flowable:inheritBusinessKey`), `Inherit variables`.
- Inherit business key default logic: if explicit `flowable:businessKey` is present, default is false; otherwise defaults to true. Editing Business key sets `inheritBusinessKey=false` automatically.
- In/Out mappings: list UIs for `flowable:in` / `flowable:out` on `extensionElements` with pruning of incomplete `out` mappings on save.

### Multi-Instance (Loop Characteristics)
- Adds Flowable fields to MI section in order: `flowable:collection`, `flowable:elementVariable`, `flowable:elementIndexVariable`.
- Variable aggregations: new section shown only for MI elements.
  - Stored as `<flowable:variableAggregation>` under `loopCharacteristics > extensionElements`.
  - Each aggregation has `target`, creation mode (`createOverviewVariable` / `storeAsTransientVariable` / default), and a nested list of `Definitions`.
  - Definitions are unprefixed `<variable source target/>` children (we read legacy `flowable:variableAggregationDefinition` too). UI writes typed entries internally and rewrites to `<variable/>` on export.

Patterns to follow:
- Use `useService('modeling')` and `updateProperties` for simple properties; `updateModdleProperties` for nested/moddle instances.
- Respect `isEdited` helpers: text → `isTextFieldEntryEdited`/`isTextAreaEntryEdited`, checkbox → `isCheckboxEntryEdited`.
- Always prefer inserting under `ID` (fallback `Name`) to keep a stable UX.

## UI Filtering Customizations
In `src/main.ts` we prune unsupported elements from palette, context pad, replace menu, and popup menus. Keep filters minimal and robust by:
- Matching both IDs and labels (case-insensitive) to remain stable across versions.
- Avoid removing multi-instance loop features; do remove plain loop toggles and unsupported tasks/events.

## Conventions
- Labels: Use `translate` service when available; provide English fallback.
- IDs: Stable, kebab/prefix style (e.g., `flowable-asyncLeaveExclusive`, `bpmn-conditionExpression`).
- Logging: Wrap `console.debug` in try/catch to avoid errors; keep messages short.
- Registration priority: Properties provider registers with priority `500` (after defaults).
- Spacers: Use a dedicated component (thin top border, small spacing) to visually separate logical sections within a group.
 - Hooks: do not call `useService(...)` inside `getGroups` except within entry components. Mutations that need services should occur inside entry setters or in export helpers.

### Component Agnosticism
 - Host-agnostic editor: avoid environment checks like `isTauri`/`isAngular` in the component. Do not call host APIs directly from `src/main.ts`.
 - Use Sidecar ops: route host interactions via Sidecar (`doc.load`, `doc.save`, `doc.saveSvg`, `ui.*`). If new capabilities are needed, add an operation instead of branching on environment.
 - Host-specific code lives in host harnesses (e.g., `hosts/tauri/main.ts` using `@tauri-apps/*`).
 - Host-first behavior: Open is host-only (waits briefly for connection, then aborts), Save/SVG are host-first with browser fallback only on error/decline.
- Debug toggle: enable logs with `?debug=1` or `localStorage.setItem('fleditor:debug','1')`. Editor logs use `[fleditor]`, host logs use a host-specific prefix (e.g., `[tauri-host]`).

#### Do / Don’t Examples

- Don’t: Call Tauri APIs directly from the component.
  ```ts
  // src/main.ts (anti-pattern)
  if ((window as any).__TAURI__) {
    const { save } = await import('@tauri-apps/api/dialog');
    const { writeTextFile } = await import('@tauri-apps/api/fs');
    const path = await save({ defaultPath: 'diagram.bpmn' });
    if (path) await writeTextFile(path, xml);
  }
  ```

- Do: Route persistence via Sidecar in the component.
  ```ts
  // src/main.ts
  const res: any = await sidecar.request('doc.save', { xml }, 120000);
  if (res?.ok) {
    setStatus('Über Host gespeichert');
  } else if (res?.canceled) {
    setStatus('Speichern abgebrochen');
  } else {
    // fallback: browser download
    download('diagram.bpmn', xml, 'application/xml');
  }
  ```

- Do: Implement host-specific behavior inside the host harness.
  ```ts
  // hosts/tauri/main.ts
  host.onRequest('doc.save', async ({ xml }) => {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/api/dialog'),
      import('@tauri-apps/api/fs')
    ]);
    const path = await save({ defaultPath: 'diagram.bpmn', filters: [{ name: 'BPMN', extensions: ['bpmn','xml'] }] });
    if (!path) return { ok: false, canceled: true };
    await writeTextFile(path as string, xml);
    return { ok: true, path };
  });
  ```

## Agent Operating Procedure
- Planning: For multi-step tasks, use the Codex plan tool and keep steps concise.
- Preambles: Before running groups of shell commands, post a short (1–2 sentence) note.
- Editing files: Use `apply_patch` to add/update files. Keep diffs minimal and focused.
- Commits: Do not `git commit` or create branches unless explicitly asked.
- Validation: Prefer running `npm run build` to compile-check changes. Avoid unrelated fixes.

## Sandbox & Approvals
- Filesystem: workspace-write. Avoid writing outside the project.
- Network: restricted. Installing packages or network tasks require approval.
- Approvals mode: on-request. If a command fails due to sandboxing (e.g., Vite removing `dist`), rerun with escalation and a short justification.

## Common Recipes
- Add a checkbox property
  - Create an entry component using `CheckboxEntry` and `useService('modeling')`.
  - Add `isEdited: isCheckboxEntryEdited`.
  - Insert into the appropriate group after `ID`.
- Add a text/textarea property
  - Use `TextFieldEntry`/`TextAreaEntry`, fetch via `bo.get('ns:prop')`, persist via `updateProperties`.
  - For nested/moddle instances (e.g., `conditionExpression`), use `bpmnFactory` + `updateModdleProperties`.
- Insert a separator in a group
  - Use the existing spacer component pattern: a `div` with top border and small margin/padding.
  - Give it a stable ID and insert after `ID`.

## Definition of Done
- Functionally correct with minimal surface area changes.
- Labels translated (with fallback), stable ordering preserved.
- Build succeeds (`npm run build`).
- No unrelated code churn or formatting-only diffs.

## Future Ideas (Optional)
- Markdown Documentation editor (persist as `bpmn:Documentation` with `text/markdown`), optionally with preview.
- More robust condition expression helper UI (templates, validation hints).
- Optional code-splitting of app shell if bundle size becomes a concern.

## Troubleshooting
- Build fails to clean `dist/`: rerun with elevated permissions and a short justification.
- Properties not updating: ensure correct use of `updateProperties` vs. `updateModdleProperties` and that the element/BO supports the attribute.
- Entry not shown: verify `getGroups` conditions, group ID match (`general`, `multiInstance`), and that `entries` array is updated in-place.
- Message icon not shown: we inject `bpmn:MessageEventDefinition` for Start/ICE/Boundary at import if Flowable event metadata exists; we remove it only from the exported XML, not from the in-memory model.
- SubProcess appears collapsed: import expands all matching `bpmndi:BPMNShape` with `isExpanded="true"`.
 - Double file dialogs: Open is host-only and waits briefly for connection; it will not open a local dialog after handshake to avoid dual prompts.
 - Permissions denied (e.g., `event.listen not allowed`, `dialog.open not allowed`): ensure `src-tauri/capabilities/main.json` contains the required permissions and restart dev/build.
 - NSURLErrorDomain -999 on save: indicates browser-download fallback was triggered and then aborted by navigation. Ensure host save works (capabilities allow `dialog.save` + fs write) and that Sidecar responses are matched (bridge uses `inReplyTo`).
 - Startup flicker: we load `src/bpmn-tabs/tabs.css` early in `index.html` to prevent FOUC. Keep it in-place if you touch startup.
- Tauri dev port busy (5173): stop other Vite instances or change port; dev uses `--strictPort`.
- macOS “Open with …” crash (cold start): On some macOS versions a native Tao/OpenURL path may crash during cold start before JS runs. Workarounds:
  - Preferred: Launch the app first, then use “Öffnen mit …” (works reliably via single-instance).
  - The host harness drains files via `pending_files_take` after page load to avoid races; ensure FS capability allows the target path (`$HOME/**`).
  - Windows is the primary target (95%); this issue may not apply there.

## Open With (OS) — Implementation Notes (2025-09)
- Host harness (`hosts/tauri/main.ts`):
  - Sends `handshake:ack` and advertises `doc.openExternal`.
  - Queues external files (`enqueueExternal`) until the component handshake is seen, then forwards via `doc.openExternal`.
  - Drains the Rust-side buffer with `invoke('pending_files_take')` on startup; also listens to `open-files` for subsequent files.
  - Writes short status messages into `#status` (e.g., `pending_files_take: N`, `read …`, `forwarding …`, `component replied: ok`). These are safe for release builds and help debugging without DevTools.
- Component (`src/main.ts`):
  - Handles `doc.openExternal` by opening a new tab or importing into existing with duplicate-checks.
  - Shows `Host: Datei empfangen – <fileName>` in the status bar on receipt.
- Rust (`src-tauri/src/main.rs`):
  - Buffers any incoming file paths (argv/single-instance/macOS OpenURL) in `PendingFiles` and exposes them via `pending_files_take`.
  - On page load we no longer emit `open-files` automatically to avoid races; the JS host drains explicitly.
  - FS capability is scoped to `$HOME/**` to prevent `forbidden path` errors when reading user files.
- Windows packaging:
  - Scripts: `npm run build:win:nsis`, `npm run build:win:msi`, or `npm run build:win` for both.
  - Prereqs: Rust (MSVC), VS Build Tools, NSIS (for NSIS), WiX v3 (for MSI).
  - File associations: Prefer `.bpmn`. Double suffixes like `.bpmn20.xml` are effectively `.xml` on Windows.

---
This guide is intentionally concise. When in doubt, prefer small, targeted changes and verify with a build. If a task requires broader edits, propose a plan first.

## Import / Export Behaviors (Summary)
- Import helpers (model is updated for better UX):
  - Add `bpmn:MessageEventDefinition` to Start/IntermediateCatch/Boundary if Flowable event metadata exists (for icon rendering).
  - Expand all SubProcess DI shapes (`bpmndi:BPMNShape[isExpanded=true]`).
  - Map `bpmn:ServiceTask[flowable:type=send-event]` to SendTask for display.
  - Map `bpmn:ServiceTask[flowable:type=dmn]` to BusinessRuleTask for display.
  - Normalize Flowable error start/boundary `errorRef` values expressed as codes:
    - If `errorRef="code"` and `<bpmn:error errorCode="code">` exists, rewrite reference to that error `id`.
    - If missing, create a `<bpmn:error id=name=errorCode="code"/>` and reference it.
- Export helpers (string-level XML rewrites; model remains intact):
  - Wrap bodies in CDATA for condition expressions, `flowable:eventType`, `flowable:sendSynchronously`, `flowable:startEventCorrelationConfiguration`, `flowable:string`, and `flowable:decisionReferenceType`.
  - Ensure message-start correlation configuration and required defaults (Receive/Boundary/Start Correlation, SendTask defaults, systemChannel) are present.
  - Remove `messageEventDefinition` only from the serialized XML for Start/ICE/Boundary (flowable event-registry style), keep it in-memory for icons.
  - Map SendTask → ServiceTask with `flowable:type="send-event"` in XML.
  - Map BusinessRuleTask → ServiceTask with `flowable:type="dmn"` in XML.
  - External Worker: ensure pretty `extensionElements` contain the Design stencils (`stencilid=ExternalWorkerTask`, `stencilsuperid=Task`).
  - Error Events: write `errorRef` as `errorCode`; reconcile error definitions by removing unreferenced `<bpmn:error>` and adding missing ones (`id=name=errorCode=value`).
  - Normalize Flowable variable aggregation definitions to unprefixed `<variable/>` in XML.
  - DMN export: sync decision IDs with names, wrap table values in CDATA, and strip DMNDI blocks for Flowable/Camunda tooling.

## Moddle Extensions (Flowable)
- Added types used by the UI/export:
  - `flowable:String` (body CDATA)
  - `flowable:Field` (attributes: `name`, child: `string`)
  - `flowable:DecisionReferenceType` (body CDATA)
  - `flowable:In.transient:Boolean` (attribute on mappings)
  - Error EventDefinition props: `flowable:errorVariableName|errorVariableTransient|errorVariableLocalScope`
