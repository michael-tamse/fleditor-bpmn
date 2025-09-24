export type EditorKind = 'bpmn' | 'dmn' | 'event';

export interface TabState {
  id: string;
  kind: EditorKind;
  filePath?: string;
  dirty: boolean;
  selectionId?: string;
  modelVersion: number;
}

export interface AppState {
  activeTabId?: string;
  tabs: Record<string, TabState>;
}

export type Action =
  | { type: 'TAB/OPENED'; tab: TabState }
  | { type: 'TAB/ACTIVATED'; id?: string }
  | { type: 'TAB/DEACTIVATED' }
  | { type: 'TAB/CLOSED'; id: string }
  | { type: 'EDITOR/SELECTION_CHANGED'; id: string; selectionId?: string }
  | { type: 'EDITOR/MODEL_CHANGED'; id: string }
  | { type: 'EDITOR/DIRTY_SET'; id: string; dirty: boolean };
