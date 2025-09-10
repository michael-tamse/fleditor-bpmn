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
- `src/main.ts`: App bootstrap, canvas + properties panel wiring, palette/context pad/replace menu filtering, file I/O, zoom, small migrations.
- `src/flowable-moddle.ts`: Flowable moddle extension declaration (namespaces and types).
- `src/flowable-properties-provider.ts`: Custom properties provider logic. Adds/adjusts entries and groups and integrates with the default provider.
- `styles.css`, `index.html`: Base UI shell.

Code references (clickable in IDE):
- `src/flowable-properties-provider.ts:424` (`FlowablePropertiesProvider` registration and `getGroups` override)
- `src/flowable-properties-provider.ts:401` (`createExecutionGroup` with ordering and spacer)
- `src/main.ts:17` (Modeler initialization + additional modules)

## Properties Panel Customizations
- Execution group is injected for "engine-executed" tasks (Service/Send/Receive/BusinessRule/Script/CallActivity) with ordered flags:
  - `flowable:async`, `flowable:exclusive`, `flowable:asyncLeave`, `flowable:asyncLeaveExclusive`
  - Spacer between async/exclusive markers and generic flags; then `isForCompensation`.
- General group helper adds a visual separator after `ID` when any extra fields beyond Name/ID are present.
- SequenceFlow adds a "Condition Expression" textarea stored as `bpmn:FormalExpression`.
- ServiceTask adds Flowable "Delegate expression" to General.

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

---
This guide is intentionally concise. When in doubt, prefer small, targeted changes and verify with a build. If a task requires broader edits, propose a plan first.
