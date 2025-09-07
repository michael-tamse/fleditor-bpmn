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

// Optional: keep for completeness if imported elsewhere
declare module 'bpmn-moddle' {
  export type ModdleElement = any;
  const _default: any;
  export default _default;
}

