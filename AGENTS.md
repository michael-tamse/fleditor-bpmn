# AGENTS.md

This document guides agents (and contributors) working on this BPMN editor. It covers the codebase layout, conventions, and how to safely make changes via the Codex CLI.

## Overview
- Scope: Lightweight BPMN editor using `bpmn-js` + Properties Panel with Flowable-specific tweaks.
- Goals: Keep UX simple, remove unsupported BPMN constructs, add Flowable-centric properties where helpful.
- Style: Minimal, focused changes. Avoid broad refactors and keep behavior predictable.

## Tech Stack
- Core: `bpmn-js`, `bpmn-js-properties-panel`, `@bpmn-io/properties-panel` (Preact-based entries)
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

Note: Large bundle warnings are expected; not a blocker.

## Key Files
- `src/main.ts`: App bootstrap, canvas + properties panel wiring, palette/context pad/replace menu filtering, file I/O, zoom. Also hosts import/export helpers (icon/DI fixes, XML rewrites) and small migrations/defaults.
- `src/flowable-moddle.ts`: Flowable moddle extension declaration (namespaces and types) including Event/Mapping/Variable Aggregation/Start Correlation types.
- `src/flowable-properties-provider.ts`: Custom properties provider logic. Adds/adjusts entries and groups and integrates with the default provider.
- `styles.css`, `index.html`: Base UI shell.
- Tabs (multi‑diagram support):
  - `src/bpmn-tabs/tabs.ts`: Accessible tabs manager (add/activate/close, overflow scroll buttons, keyboard support, context menu, dirty marker).
  - `src/bpmn-tabs/tabs.css`: Styles for tab bar, panels, overflow arrows, add button, context menu.
  - `src/bpmn-tabs/tabs.html`: Markup reference used by `index.html`.
  - `src/bpmn-tabs/tabs-usage-bpmn.ts`: Standalone demo usage for tabs + bpmn-js (not used by app boot, for reference/tests).
 - Sidecar (component ↔ host interface):
 - `src/sidecar/shared/protocol.ts`: PROTOCOL_ID/Version, message types (handshake, req/res, events, error), capabilities, operation names.
   - `src/sidecar/transports/dom.ts`: DOM CustomEvent transport (Angular/same-window).
   - `src/sidecar/transports/postMessage.ts`: postMessage transport (iframe/parent).
   - `src/sidecar/transports/memory.ts`: Memory transport (tests).
   - `src/sidecar/bridge.ts`: Thin request/response/event bridge with timeouts and handlers.
 - Browser Host Demo:
   - `hosts/browser/index.html`: Host UI (buttons, toggles) + iframe embedding the editor.
   - `hosts/browser/main.ts`: Host logic (handshake ack, ui ops, doc.load/save via downloads).
 - Tauri Host Harness (no UI):
   - `hosts/tauri/main.ts`: Tauri v2 host harness. Handles `doc.load`, `doc.save`, `doc.saveSvg` using `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`. Responds to `handshake:init`, listens for app‑level `open-files` events and forwards files to the component via `doc.openExternal`.
   - Capabilities (permissions) are defined via files in `src-tauri/capabilities/` (see “Tauri v2 Capabilities”).

Quick anchors (open in IDE):
- `src/flowable-properties-provider.ts` → `FlowablePropertiesProvider`, `createExecutionGroup`, Send/Receive/Start/ICE/Boundary sections, Error Start/Boundary sections, BusinessRuleTask (DMN) entries, Variable Aggregations.
- `src/main.ts` → modeler wiring, import/export helpers (`expandSubProcessShapesInDI`, CDATA wrappers, sendTask/DMN mappings, errorRef normalization/rewrite, external-worker stencil writer, icon helpers). Sidecar wiring: handshake init, ui ops handlers, `doc.load`/`doc.save`/`doc.saveSvg` fallbacks.
- Tabs integration in `src/main.ts` → `DiagramTabState`, `initTabs`, `createDiagramTab`, per‑tab modeler lifecycle, dirty/baseline handling, last‑active persistence.
 - Tauri integration:
   - `src-tauri/src/main.rs` → app builder, `tauri-plugin-single-instance`, `tauri-plugin-fs`, `tauri-plugin-dialog`, app‑level `open-files` emission, `pending_files_take` command.
   - `hosts/tauri/main.ts` → host bridge using plugin‑dialog/fs, drains `pending_files_take`, listens `open-files`, forwards via `doc.openExternal`.
   - `src/sidecar/shared/protocol.ts` → includes `doc.openExternal` op.
   - Capabilities files: `src-tauri/capabilities/main.json` enables `event.listen`, `dialog.open/save`, `fs.read/write` for window `main`.

## Tabs (Multi‑Diagram)
- Overview: The editor supports multiple BPMN diagrams in parallel via an accessible tab system. Each tab owns a separate `bpmn-js` Modeler and its Properties Panel.
- Files: `src/bpmn-tabs/tabs.ts`, `src/bpmn-tabs/tabs.css`, `index.html` (tabbar markup), optional demo `src/bpmn-tabs/tabs-usage-bpmn.ts`.
- UX:
  - Add button in the tabbar creates a new diagram tab.
  - No auto-tab on startup and after closing the last tab. An empty state is shown when no tabs are open; use the `＋` button or "Öffnen" to start.
  - Context menu per tab: Close, Close Others, Close All. Ctrl/Cmd+W closes the active tab; middle‑click closes a tab.
  - Overflow arrows appear when the tablist scrolls horizontally; keyboard nav uses Left/Right/Home/End and Enter/Space to activate.
  - Dirty indicator (●) on tab when unsaved changes exist (tracked via hashed XML baseline).
  - Properties panel visibility applies per active tab (layout stays consistent).
- Integration:
  - `src/main.ts` manages tabs via `DiagramTabState` objects stored in a Map: `{ id, modeler, panelEl, canvasEl, propertiesEl, title, fileName?, dirty, baselineHash? }`.
  - Use helpers: `runWithState(state, fn)` to execute logic against a specific modeler; `updateBaseline(state)` to reset dirty after save/import; `setDirtyState(state, dirty)` to update UI and emit `doc.changed` for the active tab.
  - Active tab is persisted in `localStorage` (`fleditor:lastActiveTab`) with `{ title?, fileName? }` so the last active tab can be restored heuristically on reload.
  - Host open (`doc.load`) creates a new tab with the received XML; local file open creates a new tab too. Drag & drop onto a canvas imports into that specific tab.
  - Saving (host/browser) updates the tab’s baseline and clears dirty; suggested filenames derive from current `process@id` and are sanitized.

### New Tab Defaults
- The `＋` button creates a fresh diagram whose `process@id` is unique across open tabs, following `Process_1`, `Process_2`, ... numbering. Implementation:
  - `computeNextProcessId()` scans open tabs and picks the next free number.
  - `createInitialXmlWithProcessId(pid)` derives an initial XML with both the `bpmn:process@id` and the DI `bpmnElement` set to `pid`.
  - The tab title initializes from that Process ID.

### Empty State
- When there are no tabs, an empty-state hint is rendered inside `.panels` (see `index.html` `#emptyState`).
- Visibility toggled via `updateEmptyStateVisibility()` whenever tabs are created/destroyed.

### Live Title Sync
- The tab title updates live when the BPMN `process@id` changes.
  - Hooked on `commandStack.changed`; reads the id via `deriveProcessIdFromModel()` and calls `updateStateTitle(...)`.

### Duplicate-Open Handling
- Opening BPMN XML (via host `doc.load` or local file) checks for an existing tab with the same Process ID:
  - No existing tab → new tab is created.
  - Existing and not dirty → the diagram is imported into that tab and the tab is activated.
  - Existing and dirty → a confirm dialog asks whether to overwrite the changes; "Abbrechen" cancels the open.
- Logic centralized in `openXmlConsideringDuplicates(xml, fileName?, source)`; tab lookup via `findTabByProcessId(pid)`.

### Tauri‑Safe Confirm Dialogs
- Avoid native `window.confirm` in Tauri (not allowlisted). Use the in-app confirm overlay instead:
  - `showConfirmDialog(message, title?, options?)` renders an accessible modal (`Esc` cancels, `Enter` confirms) and returns a Promise<boolean>.
  - Button labels can be customized; duplicate-open uses `okLabel: 'Ja'`.
  - Styles live in `src/bpmn-tabs/tabs.css` under `.tab-confirm-overlay` / `.tab-confirm`.

### Toolbar & Buttons
- The dedicated "Neu" button was removed; creation happens via the `＋` in the tabbar.
- The `＋` tabbar button is centered via flex styles for crisp alignment.

### Tabs Do / Don’t
- Do: Create and destroy Modeler instances per tab; don’t share a singleton across tabs.
- Do: Route all per‑tab operations via `runWithState(state, ...)` to ensure the correct modeler is active.
- Do: When mutating model content before export, call the existing helpers (e.g., `ensureCallActivityDefaults()`, `ensureCorrelationParameterFor*`) inside the active state.
- Don’t: Access `modeler`-globals from outside active tab context; set `modeler = state.modeler` via `runWithState` instead of reassigning globally.
- Don’t: Bypass the tabs dirty/baseline helpers; always call `updateBaseline(state)` after successful imports/saves.

### Markup & Styles
- `index.html` swaps the single canvas for:
  - `<div class="tabs" id="diagramTabs">` with a `.tabbar` holding left/right scroll buttons, the `.tablist`, and a `button.add-tab`.
  - `.panels` contains per‑tab `.tabpanel` roots; each panel hosts a two‑column layout (`.diagram-pane`) with `.canvas` and `.properties`.
- `styles.css` defines `.diagram-pane` and responsive behavior; `src/bpmn-tabs/tabs.css` styles the tabbar/panels.

## Sidecar Integration
- Overview: The editor runs standalone, but can integrate with an external host (Angular, Tauri, Browser) via a versioned, bidirectional interface.
- Protocol: `bpmn-sidecar` with `handshake:init/ack`, `req/res`, `event`, `error`. Capabilities declare available host features and operations.
- Supported ops:
  - `doc.load` (Comp → Host): host returns BPMN XML string.
  - `doc.save` (Comp → Host): host persists XML.
  - `doc.saveSvg` (Comp → Host): host persists SVG.
  - `doc.openExternal` (Host → Comp): host forwards external file content + filename to open in a tab.
  - `ui.setPropertyPanel` (Host → Comp): show/hide property panel.
  - `ui.setMenubar` (Host → Comp): show/hide editor menubar.
- Events (Comp → Host): `ui.state` (menubar/propertyPanel flags), `doc.changed` (dirty hint).
- Transports: DOM CustomEvents (same window), postMessage (iframe). Component auto-detects iframe and prefers postMessage.
- Component wiring (in `src/main.ts`):
  - Startup performs a handshake with short, frequent retries (800ms timeout, 250ms interval, up to 16 attempts) to avoid races; editor remains functional without a host.
  - Open uses host-only: before invoking `doc.load`, the component waits up to ~2s for a host connection; if no host is available the action is aborted (no local dialog) to avoid dual prompts. Save/SVG use host-first and fall back to browser download only if the host declines or fails.
  - UI requests update DOM and emit `ui.state` back to host.

### Run the Browser Host Demo
- Dev: `npm run dev`
- Open Host UI: `http://localhost:5173/hosts/browser/`
- Flow:
  - The host iframe-loads `/index.html` (the editor) and sends `handshake:ack`.
  - Toggle menubar/property panel via checkboxes (host sends `ui.set*`).
  - „Datei in Host laden…“ puffert XML im Host; im Editor „Öffnen“ triggert `doc.load` → Host liefert XML.
  - „Speichern XML“ im Editor triggert `doc.save` → Host lädt `<processId>.bpmn20.xml` herunter (ersatzweise `diagram.bpmn20.xml`). Nach erfolgreichem Speichern setzt der aktive Tab seine Baseline (Dirty‑Dot verschwindet).
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

## Moddle Extensions (Flowable)
- Added types used by the UI/export:
  - `flowable:String` (body CDATA)
  - `flowable:Field` (attributes: `name`, child: `string`)
  - `flowable:DecisionReferenceType` (body CDATA)
  - `flowable:In.transient:Boolean` (attribute on mappings)
  - Error EventDefinition props: `flowable:errorVariableName|errorVariableTransient|errorVariableLocalScope`
