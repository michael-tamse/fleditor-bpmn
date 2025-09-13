declare module 'bpmn-js/lib/Modeler' {
  const Modeler: any;
  export default Modeler;
}

declare module 'bpmn-js-properties-panel' {
  export const BpmnPropertiesPanelModule: any;
  export const BpmnPropertiesProviderModule: any;
  export function useService<T = any>(name: string): any;
  const _default: any;
  export default _default;
}

declare module '@bpmn-io/properties-panel' {
  export const Group: any;
  export const CheckboxEntry: any;
  export const TextFieldEntry: any;
  export const TextAreaEntry: any;
  export const ListGroup: any;
  export const ListEntry: any;
  export const SelectEntry: any;
  export const isCheckboxEntryEdited: (node?: any) => boolean;
  export const isTextFieldEntryEdited: (node?: any) => boolean;
  export const isTextAreaEntryEdited: (node?: any) => boolean;
  export const isSelectEntryEdited: (node?: any) => boolean;
}

// Optional: keep for completeness if imported elsewhere
declare module 'bpmn-moddle' {
  export type ModdleElement = any;
  const _default: any;
  export default _default;
}
