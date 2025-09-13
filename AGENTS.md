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

## Run & Build
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

Note: Large bundle warnings are expected; not a blocker.

## Key Files
- `src/main.ts`: App bootstrap, canvas + properties panel wiring, palette/context pad/replace menu filtering, file I/O, zoom. Also hosts import/export helpers (icon/DI fixes, XML rewrites) and small migrations/defaults.
- `src/flowable-moddle.ts`: Flowable moddle extension declaration (namespaces and types) including Event/Mapping/Variable Aggregation/Start Correlation types.
- `src/flowable-properties-provider.ts`: Custom properties provider logic. Adds/adjusts entries and groups and integrates with the default provider.
- `styles.css`, `index.html`: Base UI shell.

Quick anchors (open in IDE):
- `src/flowable-properties-provider.ts` → `FlowablePropertiesProvider`, `createExecutionGroup`, Send/Receive/Start/ICE/Boundary sections, Variable Aggregations.
- `src/main.ts` → modeler wiring, import/export helpers (`expandSubProcessShapesInDI`, CDATA wrappers, sendTask mapping, icon helpers).

## Properties Panel Customizations
- General group: adds a visual separator after `ID` if extra fields are present.
- SequenceFlow: adds a "Condition Expression" (`bpmn:FormalExpression`) textarea.
- Execution group: injected for engine-executed tasks (Service/Send/Receive/BusinessRule/Script/CallActivity) in this order
  - `flowable:async`, `flowable:exclusive`, `flowable:asyncLeave`, `flowable:asyncLeaveExclusive`
  - spacer, then `isForCompensation` and (for CallActivity) `flowable:completeAsync`.
  - For ServiceTask with `flowable:type="external-worker"` the four async/exclusive checkboxes and spacer are hidden.

### Service Task
- Implementation selector in General: `Delegate Expression` vs `External`.
  - Delegate Expression → `flowable:delegateExpression` text field.
  - External → `Topic` text field bound to `flowable:topic`.
  - Switching to External sets `flowable:type="external-worker"`, `flowable:exclusive=false` and clears `flowable:delegateExpression`, `flowable:(async|asyncLeave|asyncLeaveExclusive)`.

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
- Same three sections as ReceiveTask when NOT a Timer event.
- Default `Message` group is removed.
- Defaults: newly created ICE/Boundary get default correlation parameter (`businessKey` / `${execution.getProcessInstanceBusinessKey()}`).

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

---
This guide is intentionally concise. When in doubt, prefer small, targeted changes and verify with a build. If a task requires broader edits, propose a plan first.

## Import / Export Behaviors (Summary)
- Import helpers (model is updated for better UX):
  - Add `bpmn:MessageEventDefinition` to Start/IntermediateCatch/Boundary if Flowable event metadata exists (for icon rendering).
  - Expand all SubProcess DI shapes (`bpmndi:BPMNShape[isExpanded=true]`).
  - Map `bpmn:ServiceTask[flowable:type=send-event]` to SendTask for display.
- Export helpers (string-level XML rewrites; model remains intact):
  - Wrap bodies in CDATA for condition expressions, `flowable:eventType`, `flowable:sendSynchronously`, and `flowable:startEventCorrelationConfiguration`.
  - Ensure message-start correlation configuration and required defaults (Receive/Boundary/Start Correlation, SendTask defaults, systemChannel) are present.
  - Remove `messageEventDefinition` only from the serialized XML for Start/ICE/Boundary (flowable event-registry style), keep it in-memory for icons.
  - Map SendTask → ServiceTask with `flowable:type="send-event"` in XML.
  - Normalize Flowable variable aggregation definitions to unprefixed `<variable/>` in XML.
