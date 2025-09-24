import type { Store } from '../state/store';
import type { Action, AppState, TabState } from '../state/types';
import { selectDirtyTabs } from '../state/selectors';

interface ActionLogEntry {
  action: Action;
  ts: number;
  snapshot: AppState;
}

const ACTION_LOG_LIMIT = 50;
const actionLog: ActionLogEntry[] = [];

let storeRef: Store<AppState, Action> | null = null;
let originalDispatch: ((action: Action) => void) | null = null;
let unsubscribe: (() => void) | null = null;

const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const dmnSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

let previousState: AppState | null = null;

export function attachEffects(store: Store<AppState, Action>) {
  if (storeRef) return;

  storeRef = store;
  originalDispatch = store.dispatch.bind(store);

  (store.dispatch as typeof store.dispatch) = ((action: Action) => {
    originalDispatch!(action);
    const snapshot = store.getState();
    actionLog.push({ action, ts: Date.now(), snapshot });
    if (actionLog.length > ACTION_LOG_LIMIT) actionLog.shift();
  }) as typeof store.dispatch;

  previousState = store.getState();
  unsubscribe = store.subscribe(() => {
    if (!previousState) {
      previousState = store.getState();
      return;
    }
    const current = store.getState();
    handleStateChange(previousState, current);
    previousState = current;
  });
}

export const getActionLog = () => actionLog.slice();

function handleStateChange(prev: AppState, next: AppState) {
  const prevTabs = prev.tabs;
  const nextTabs = next.tabs;

  // Clean up timers for closed tabs
  for (const id of Object.keys(prevTabs)) {
    if (!nextTabs[id]) {
      cancelAutoSave(id);
      cancelDmnSync(id);
    }
  }

  for (const [id, tab] of Object.entries(nextTabs)) {
    const before = prevTabs[id];

    if (!before || before.dirty !== tab.dirty) {
      if (tab.dirty) scheduleAutoSave(tab);
      else cancelAutoSave(id);
    }

    if (tab.kind === 'dmn') {
      if (!before || before.modelVersion !== tab.modelVersion) {
        scheduleDmnSync(id);
      }
    }
  }
}

function scheduleAutoSave(tab: TabState) {
  cancelAutoSave(tab.id);
  const timer = setTimeout(() => {
    autosaveTimers.delete(tab.id);
    runAutoSave(tab.id).catch((err) => console.warn('AutoSave failed:', err));
  }, 600);
  autosaveTimers.set(tab.id, timer);
}

function cancelAutoSave(tabId: string) {
  const timer = autosaveTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    autosaveTimers.delete(tabId);
  }
}

function scheduleDmnSync(tabId: string) {
  cancelDmnSync(tabId);
  const timer = setTimeout(() => {
    dmnSyncTimers.delete(tabId);
    syncDmnTitleAndId(tabId);
  }, 200);
  dmnSyncTimers.set(tabId, timer);
}

function cancelDmnSync(tabId: string) {
  const timer = dmnSyncTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    dmnSyncTimers.delete(tabId);
  }
}

async function runAutoSave(tabId: string) {
  if (!storeRef) return;
  const state = resolveDiagramState(tabId);
  if (!state) return;

  const updateBaseline = (window as any).updateBaseline;
  if (typeof updateBaseline === 'function') {
    await updateBaseline(state);
    return;
  }

  // Fallback: if baseline helper is unavailable, mark tab clean to avoid stale dirty flags
  storeRef.dispatch({ type: 'EDITOR/DIRTY_SET', id: tabId, dirty: false });
}

function syncDmnTitleAndId(tabId: string) {
  const state = resolveDiagramState(tabId);
  if (!state) return;

  const sync = (window as any).syncDmnDecisionIdWithName;
  const updateTitle = (window as any).updateDmnTabTitle;

  try { sync?.(state); } catch (error) { console.warn('DMN sync failed:', error); }
  try { updateTitle?.(state); } catch (error) { console.warn('DMN title update failed:', error); }
}

function resolveDiagramState(tabId: string): any | null {
  try {
    const getTabStates = (window as any).getTabStates;
    const map = getTabStates?.();
    if (map && typeof map.get === 'function') {
      return map.get(tabId) ?? null;
    }
  } catch (error) {
    console.warn('Failed to resolve diagram state:', error);
  }
  return null;
}

// Expose helper for debugging dirty tabs
export const getDirtyTabsSnapshot = () => {
  if (!storeRef) return [] as TabState[];
  return selectDirtyTabs(storeRef.getState());
};
