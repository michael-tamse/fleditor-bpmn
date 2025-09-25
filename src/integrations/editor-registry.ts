import { createBpmnBinding } from './bpmn-bridge';
import { createDmnBinding } from './dmn-bridge';
import { createEventBinding } from './event-bridge';
import type { DiagramTabState } from '../types';
import type { EditorKind } from '../state/types';

export interface EditorBinding {
  dispose(): void;
}

type BindingFactory = (state: DiagramTabState) => EditorBinding | null;

const factories: Record<EditorKind, BindingFactory> = {
  bpmn: createBpmnBinding,
  dmn: createDmnBinding,
  event: createEventBinding
};

export function createEditorBinding(state: DiagramTabState): EditorBinding | null {
  const factory = factories[state.kind];
  return factory ? factory(state) : null;
}
