import { debug } from './ui-controls';
import { store } from './state/rootStore';
import type { TabState } from './state/types';
import { createEditorBinding, type EditorBinding } from './integrations/editor-registry';
import { DiagramTabState, SidecarBridge } from './types';

let tabsControl: any = null;
let sidecar: SidecarBridge | null = null;
const trackedStates = new Map<string, DiagramTabState>();
const editorBindings = new Map<string, EditorBinding>();

export function setTabsControl(control: any) {
  tabsControl = control;

  if (!control || (control as any).__storeActivationPatched) return;

  if (typeof control.activate === 'function') {
    const originalActivate = control.activate.bind(control);
    control.activate = (id: string | null) => {
      const result = originalActivate(id);
      if (typeof id === 'string') {
        store.dispatch({ type: 'TAB/ACTIVATED', id });
      } else {
        store.dispatch({ type: 'TAB/DEACTIVATED' });
      }
      return result;
    };
  }

  (control as any).__storeActivationPatched = true;
}

export function setSidecar(s: SidecarBridge | null) {
  sidecar = s;
}

function hostAvailable(): boolean {
  try { return !!(sidecar && (sidecar as any).capabilities); } catch { return false; }
}

function getStoreTab(id: string): TabState | undefined {
  return store.getState().tabs[id];
}

function applyDirtyPresentation(state: DiagramTabState, dirty: boolean) {
  tabsControl?.markDirty(state.id, dirty);
  if (tabsControl?.getActiveId() === state.id && hostAvailable()) {
    try {
      sidecar?.emitEvent('doc.changed', { dirty });
      debug('event: doc.changed -> host');
    } catch {}
  }
}

function disposeBinding(id: string) {
  const binding = editorBindings.get(id);
  if (binding) {
    try { binding.dispose(); } catch {}
    editorBindings.delete(id);
  }
}

function ensureBinding(state: DiagramTabState) {
  if (editorBindings.has(state.id)) return;
  const binding = createEditorBinding(state);
  if (binding) {
    editorBindings.set(state.id, binding);
  }
}

function registerTabState(state: DiagramTabState) {
  trackedStates.set(state.id, state);

  const existing = getStoreTab(state.id);
  if (!existing) {
    store.dispatch({
      type: 'TAB/OPENED',
      tab: {
        id: state.id,
        kind: state.kind,
        dirty: !!state.dirty,
        selectionId: undefined,
        modelVersion: 0,
        filePath: state.fileName
      }
    });
  }

  ensureBinding(state);
  patchLifecycleForState(state);
}

function patchLifecycleForState(state: DiagramTabState) {
  const modeler: any = state.modeler;
  if (!modeler || modeler.__storeDestroyPatched) return;

  const destroyFn = typeof modeler.destroy === 'function' ? 'destroy'
    : typeof modeler.dispose === 'function' ? 'dispose'
    : null;

  if (!destroyFn) {
    modeler.__storeDestroyPatched = true;
    return;
  }

  const original = modeler[destroyFn].bind(modeler);
  modeler[destroyFn] = () => {
    disposeBinding(state.id);
    trackedStates.delete(state.id);
    store.dispatch({ type: 'TAB/CLOSED', id: state.id });
    return original();
  };
  modeler.__storeDestroyPatched = true;
}

store.subscribe(() => {
  const appState = store.getState();
  for (const [id, tabState] of trackedStates.entries()) {
    const snapshot = appState.tabs[id];
    if (!snapshot) {
      disposeBinding(id);
      trackedStates.delete(id);
      continue;
    }
    if (tabState.dirty !== snapshot.dirty) {
      tabState.dirty = snapshot.dirty;
      applyDirtyPresentation(tabState, snapshot.dirty);
    }
  }
});

function runWithState<T>(state: DiagramTabState, fn: () => T | Promise<T>): T | Promise<T> {
  // Placeholder - implemented in tab manager
  return fn();
}

function getIdForState(state: DiagramTabState): string | null {
  // Placeholder - implemented in file operations
  return null;
}

function updateDmnTabTitle(state: DiagramTabState) {
  const updateFn = (window as any).updateDmnTabTitle;
  if (updateFn) updateFn(state);
}

function syncDmnDecisionIdWithName(state: DiagramTabState) {
  const syncFn = (window as any).syncDmnDecisionIdWithName;
  if (syncFn) syncFn(state);
}

export function setDirtyState(state: DiagramTabState, dirty: boolean) {
  registerTabState(state);

  if (state.dirty !== dirty) {
    state.dirty = dirty;
    applyDirtyPresentation(state, dirty);
  }

  const storeTab = getStoreTab(state.id);
  if (!storeTab || storeTab.dirty !== dirty) {
    store.dispatch({ type: 'EDITOR/DIRTY_SET', id: state.id, dirty });
  }
}

export function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h;
}

export async function updateBaseline(state: DiagramTabState) {
  try {
    let content: string;
    let derivedTitle: string | null;

    if (state.kind === 'event') {
      // For event tabs, get JSON content and update baseline in event editor
      const eventModel = await runWithState(state, () => state.modeler.getModel());
      content = JSON.stringify(eventModel, null, 2);
      derivedTitle = eventModel.name || eventModel.key || state.title;

      // Update baseline in the event editor instance
      if (state.modeler && typeof state.modeler.updateBaseline === 'function') {
        state.modeler.updateBaseline();
      }
    } else {
      // For BPMN/DMN tabs, get XML content
      const { xml } = await runWithState(state, () => state.modeler.saveXML({ format: true }));
      content = xml;

      if (state.kind === 'dmn') {
        // DMN title derivation handled by DMN support module
        derivedTitle = null;
      } else {
        derivedTitle = getIdForState(state);
      }
    }

    state.baselineHash = hashString(content);

    if (derivedTitle) {
      const updateStateTitle = (window as any).updateStateTitle;
      if (updateStateTitle) updateStateTitle(state, derivedTitle);
    }
    setDirtyState(state, false);
  } catch {}
}

export function scheduleDirtyCheck(state: DiagramTabState) {
  if (state.dirtyTimer) clearTimeout(state.dirtyTimer);
  state.dirtyTimer = setTimeout(async () => {
    try {
      const { xml } = await runWithState(state, () => state.modeler.saveXML({ format: true }));
      if (typeof state.baselineHash === 'number') {
        setDirtyState(state, hashString(xml) !== state.baselineHash);
      } else {
        setDirtyState(state, true);
      }
    } catch {
      setDirtyState(state, true);
    }
  }, 300);
}

export function bindModelerEvents(state: DiagramTabState) {
  // Skip event tabs - they use custom change tracking through their editor callbacks
  if (state.kind === 'event') {
    return;
  }

  registerTabState(state);
  ensureBinding(state);

  const eventBus = state.modeler.get('eventBus');
  if (eventBus) {
    eventBus.on('commandStack.changed', () => {
      scheduleDirtyCheck(state);
      if (state.kind !== 'dmn') {
        try {
          const id = getIdForState(state);
          if (id) {
            const updateStateTitle = (window as any).updateStateTitle;
            if (updateStateTitle) updateStateTitle(state, id);
          }
        } catch {}
      }
    });
  }
}

export function debounce(func: Function, wait: number) {
  let timeout: any;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function bindDmnTabEvents(state: DiagramTabState) {
  registerTabState(state);
  ensureBinding(state);
}

export function bindEventEditor(state: DiagramTabState) {
  registerTabState(state);
  ensureBinding(state);
}
