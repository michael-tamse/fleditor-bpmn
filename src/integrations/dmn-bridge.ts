import { store } from '../state/rootStore';
import type { Action } from '../state/types';
import { throttle } from '../util/throttle';

interface BindingState {
  tabId: string;
  cleanupModeler(): void;
  cleanupViewer(): void;
  restoreDestroy?: () => void;
}

const bindings = new WeakMap<any, BindingState>();

function dispatch(action: Action) {
  store.dispatch(action);
}

function createViewerBinding(modeler: any, tabId: string): () => void {
  try {
    const activeViewer = modeler.getActiveViewer?.();
    if (!activeViewer) return () => {};

    const eventBus = activeViewer.get?.('eventBus');
    const commandStack = activeViewer.get?.('commandStack');

    if (!eventBus || !commandStack) return () => {};

    const emitModelChanged = throttle(() => {
      dispatch({ type: 'EDITOR/MODEL_CHANGED', id: tabId });
    }, 150);

    const onSelectionChanged = (evt: any) => {
      const next = Array.isArray(evt?.newSelection) ? evt.newSelection[0] : undefined;
      const selectionId = next ? String(next.id) : undefined;
      dispatch({ type: 'EDITOR/SELECTION_CHANGED', id: tabId, selectionId });
    };

    eventBus.on?.('selection.changed', onSelectionChanged);
    eventBus.on?.('elements.changed', emitModelChanged);
    commandStack.on?.('changed', emitModelChanged);

    return () => {
      eventBus.off?.('selection.changed', onSelectionChanged);
      eventBus.off?.('elements.changed', emitModelChanged);
      commandStack.off?.('changed', emitModelChanged);
    };
  } catch (error) {
    console.warn('Failed to bind DMN active viewer:', error);
    return () => {};
  }
}

export function bindDmn(modeler: any, tabId: string) {
  if (!modeler || bindings.has(modeler)) return;

  const state: BindingState = {
    tabId,
    cleanupModeler: () => {},
    cleanupViewer: () => {}
  };

  const rebindViewer = () => {
    state.cleanupViewer();
    state.cleanupViewer = createViewerBinding(modeler, tabId);
  };

  const onViewsChanged = () => rebindViewer();
  const onImportDone = () => rebindViewer();
  const onContentChanged = throttle(() => {
    dispatch({ type: 'EDITOR/MODEL_CHANGED', id: tabId });
  }, 150);

  modeler.on?.('views.changed', onViewsChanged);
  modeler.on?.('view.contentChanged', onContentChanged);
  modeler.on?.('import.done', onImportDone);

  state.cleanupModeler = () => {
    modeler.off?.('views.changed', onViewsChanged);
    modeler.off?.('view.contentChanged', onContentChanged);
    modeler.off?.('import.done', onImportDone);
  };

  rebindViewer();

  const originalDestroy = typeof modeler.destroy === 'function' ? modeler.destroy.bind(modeler) : undefined;
  modeler.destroy = () => {
    unbindDmn(modeler);
    return originalDestroy?.();
  };
  state.restoreDestroy = () => {
    if (originalDestroy) {
      modeler.destroy = originalDestroy;
    }
  };

  bindings.set(modeler, state);
}

export function unbindDmn(modeler: any) {
  const state = bindings.get(modeler);
  if (!state) return;

  state.cleanupViewer();
  state.cleanupModeler();
  state.restoreDestroy?.();
  dispatch({ type: 'TAB/CLOSED', id: state.tabId });
  bindings.delete(modeler);
}
