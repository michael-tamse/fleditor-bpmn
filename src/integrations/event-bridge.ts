import { store } from '../state/rootStore';
import type { DiagramTabState } from '../types';
import type { EditorBinding } from './editor-registry';
import { throttle } from '../util/throttle';

type EventEditorInstance = {
  options?: {
    onChange?: (model: unknown) => void;
    onDirtyChange?: (dirty: boolean) => void;
    [key: string]: any;
  } & Record<string, any>;
};

export function createEventBinding(state: DiagramTabState): EditorBinding | null {
  const editor = state.modeler as EventEditorInstance;
  if (!editor) return null;

  const options = editor.options;
  if (!options) return null;
  if (options.__storeBindingApplied) return null;

  const emitModelChanged = throttle(() => {
    store.dispatch({ type: 'EDITOR/MODEL_CHANGED', id: state.id });
  }, 150);

  const originalOnChange = options.onChange;
  const originalOnDirtyChange = options.onDirtyChange;

  options.onChange = (model: unknown) => {
    emitModelChanged();
    if (typeof originalOnChange === 'function') {
      originalOnChange(model);
    }
  };

  options.onDirtyChange = (dirty: boolean) => {
    if (dirty) emitModelChanged();
    if (typeof originalOnDirtyChange === 'function') {
      originalOnDirtyChange(dirty);
    }
  };

  Object.defineProperty(options, '__storeBindingApplied', {
    value: true,
    enumerable: false,
    configurable: true
  });

  return {
    dispose() {
      options.onChange = originalOnChange;
      options.onDirtyChange = originalOnDirtyChange;
      try {
        delete (options as any).__storeBindingApplied;
      } catch {
        (options as any).__storeBindingApplied = undefined;
      }
    }
  };
}
