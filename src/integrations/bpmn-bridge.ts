import { store } from '../state/rootStore';
import type { DiagramTabState } from '../types';
import { throttle } from '../util/throttle';
import type { EditorBinding } from './editor-registry';

export function createBpmnBinding(state: DiagramTabState): EditorBinding | null {
  const modeler: any = state.modeler;
  if (!modeler) return null;

  const eventBus = modeler.get?.('eventBus');
  if (!eventBus) return null;

  const emitModelChanged = throttle(() => {
    store.dispatch({ type: 'EDITOR/MODEL_CHANGED', id: state.id });
  }, 150);

  const onCommandStackChanged = () => emitModelChanged();
  const onElementsChanged = () => emitModelChanged();

  const onSelectionChanged = (event: any) => {
    const selection = Array.isArray(event?.newSelection) ? event.newSelection[0] : undefined;
    const selectionId = selection ? String(selection.id) : undefined;
    store.dispatch({ type: 'EDITOR/SELECTION_CHANGED', id: state.id, selectionId });
  };

  eventBus.on('commandStack.changed', onCommandStackChanged);
  eventBus.on('elements.changed', onElementsChanged);
  eventBus.on('selection.changed', onSelectionChanged);

  return {
    dispose() {
      eventBus.off('commandStack.changed', onCommandStackChanged);
      eventBus.off('elements.changed', onElementsChanged);
      eventBus.off('selection.changed', onSelectionChanged);
    }
  };
}
