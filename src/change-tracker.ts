import { debug } from './ui-controls';
import { DiagramTabState, SidecarBridge } from './types';

let tabsControl: any = null;
let sidecar: SidecarBridge | null = null;

export function setTabsControl(control: any) {
  tabsControl = control;
}

export function setSidecar(s: SidecarBridge | null) {
  sidecar = s;
}

function hostAvailable(): boolean {
  try { return !!(sidecar && (sidecar as any).capabilities); } catch { return false; }
}

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
  if (state.dirty === dirty) return;
  state.dirty = dirty;
  tabsControl?.markDirty(state.id, dirty);
  if (tabsControl?.getActiveId() === state.id && hostAvailable()) {
    try { sidecar?.emitEvent('doc.changed', { dirty }); debug('event: doc.changed -> host'); } catch {}
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
    const { xml } = await runWithState(state, () => state.modeler.saveXML({ format: true }));
    state.baselineHash = hashString(xml);

    let derivedTitle: string | null;
    if (state.kind === 'dmn') {
      // DMN title derivation handled by DMN support module
      derivedTitle = null;
    } else {
      derivedTitle = getIdForState(state);
    }

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

export function scheduleDirtyCheckDmn(state: DiagramTabState) {
  const timeSinceImport = state.lastImportTime ? Date.now() - state.lastImportTime : Infinity;
  console.log('DMN scheduleDirtyCheckDmn called, isImporting:', state.isImporting, 'timeSinceImport:', timeSinceImport, 'tabId:', state.id);

  if (state.isImporting) {
    console.log('DMN scheduleDirtyCheckDmn: Skipping dirty check during import');
    return;
  }

  // Skip dirty check for 2 seconds after import to prevent false positives from initial events
  if (timeSinceImport < 2000) {
    console.log('DMN scheduleDirtyCheckDmn: Skipping dirty check - too soon after import (', timeSinceImport, 'ms)');
    return;
  }
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
  const eventBus = state.modeler.get('eventBus');
  if (eventBus) {
    eventBus.on('commandStack.changed', () => {
      scheduleDirtyCheck(state);
      try {
        const id = getIdForState(state);
        if (id) {
          const updateStateTitle = (window as any).updateStateTitle;
          if (updateStateTitle) updateStateTitle(state, id);
        }
      } catch {}
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
  let unbindActiveViewer = () => {};

  function bindActiveViewer() {
    unbindActiveViewer();
    const activeViewer = state.modeler.getActiveViewer();
    if (!activeViewer) return;

    try {
      const eventBus = activeViewer.get('eventBus');
      const markDirty = debounce(() => {
        if (state.isImporting) {
          console.log('DMN Event: Change detected during import - skipping dirty check');
          return;
        }
        console.log('DMN Event: Change detected in active viewer');
        scheduleDirtyCheckDmn(state);
      }, 100);

      const updateTitle = debounce(() => {
        console.log('DMN Event: Updating tab title due to change');
        syncDmnDecisionIdWithName(state);
        updateDmnTabTitle(state);
      }, 200);

      eventBus.on('elements.changed', markDirty);
      eventBus.on('commandStack.changed', markDirty);
      eventBus.on('elements.changed', updateTitle);
      eventBus.on('commandStack.changed', updateTitle);

      unbindActiveViewer = () => {
        eventBus.off('elements.changed', markDirty);
        eventBus.off('commandStack.changed', markDirty);
        eventBus.off('elements.changed', updateTitle);
        eventBus.off('commandStack.changed', updateTitle);
      };

      console.log('DMN Event: Bound to active viewer:', activeViewer.type || 'unknown');
    } catch (e) {
      console.warn('Failed to bind to active DMN viewer:', e);
    }
  }

  try {
    state.modeler.on('views.changed', () => {
      console.log('DMN Event: views.changed fired - rebinding to new active viewer');
      bindActiveViewer();
      updateDmnTabTitle(state);
    });

    state.modeler.on('view.contentChanged', () => {
      console.log('DMN Event: view.contentChanged fired');
      if (!state.isImporting) {
        scheduleDirtyCheckDmn(state);
      }
      updateDmnTabTitle(state);
    });

    state.modeler.on('import.done', () => {
      console.log('DMN Event: import.done - initial binding');
      bindActiveViewer();
      updateDmnTabTitle(state);
    });

  } catch (e) {
    console.warn('Failed to bind DMN events:', e);
  }
}