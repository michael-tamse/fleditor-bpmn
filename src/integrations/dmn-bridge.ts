import { store } from '../state/rootStore';
import type { DiagramTabState } from '../types';
import type { EditorBinding } from './editor-registry';
import { throttle } from '../util/throttle';

const SUPPRESS_AFTER_IMPORT_MS = 400;

export function createDmnBinding(state: DiagramTabState): EditorBinding | null {
  const modeler: any = state.modeler;
  if (!modeler) return null;

  const emitModelChanged = throttle((origin: 'commandStack' | 'elements' | 'view') => {
    if (state.isImporting) {
      return;
    }

    if (origin !== 'commandStack') {
      const lastImport = state.lastImportTime;
      if (typeof lastImport === 'number' && (Date.now() - lastImport) < SUPPRESS_AFTER_IMPORT_MS) {
        return;
      }
    }

    store.dispatch({ type: 'EDITOR/MODEL_CHANGED', id: state.id });

    const updateTitle = (window as any).updateDmnTabTitle;
    if (typeof updateTitle === 'function') {
      try { updateTitle(state); } catch (error) { console.warn('DMN title bridge update failed:', error); }
    }
  }, 150);

  let cleanupViewer = () => {};

  const bindActiveViewer = () => {
    cleanupViewer();

    const activeViewer = modeler.getActiveViewer?.();
    if (!activeViewer) {
      cleanupViewer = () => {};
      return;
    }

    const eventBus = activeViewer.get?.('eventBus');
    const commandStack = activeViewer.get?.('commandStack');

    if (!eventBus) {
      cleanupViewer = () => {};
      return;
    }

    const onSelectionChanged = (event: any) => {
      const selection = Array.isArray(event?.newSelection) ? event.newSelection[0] : undefined;
      const selectionId = selection ? String(selection.id) : undefined;
      store.dispatch({ type: 'EDITOR/SELECTION_CHANGED', id: state.id, selectionId });
    };

    const onElementsChanged = () => emitModelChanged('elements');

    eventBus.on('selection.changed', onSelectionChanged);
    eventBus.on('elements.changed', onElementsChanged);

    if (commandStack && typeof commandStack.on === 'function' && typeof commandStack.off === 'function') {
      const onCommandStackChanged = () => emitModelChanged('commandStack');
      commandStack.on('changed', onCommandStackChanged);
      cleanupViewer = () => {
        eventBus.off('selection.changed', onSelectionChanged);
        eventBus.off('elements.changed', onElementsChanged);
        commandStack.off('changed', onCommandStackChanged);
      };
    } else {
      const onCommandStackChanged = () => emitModelChanged('commandStack');
      eventBus.on('commandStack.changed', onCommandStackChanged);
      cleanupViewer = () => {
        eventBus.off('selection.changed', onSelectionChanged);
        eventBus.off('elements.changed', onElementsChanged);
        eventBus.off('commandStack.changed', onCommandStackChanged);
      };
    }
  };

  const onViewsChanged = () => bindActiveViewer();
  const onContentChanged = () => emitModelChanged('view');
  const onImportDone = () => bindActiveViewer();

  modeler.on?.('views.changed', onViewsChanged);
  modeler.on?.('view.contentChanged', onContentChanged);
  modeler.on?.('import.done', onImportDone);

  bindActiveViewer();

  return {
    dispose() {
      cleanupViewer();
      modeler.off?.('views.changed', onViewsChanged);
      modeler.off?.('view.contentChanged', onContentChanged);
      modeler.off?.('import.done', onImportDone);
    }
  };
}
