export function getExtensionElements(bo: any) {
  return (bo && (bo.get ? bo.get('extensionElements') : bo.extensionElements)) || null;
}

export function ensureExtensionElements(element: any, bo: any, bpmnFactory: any, modeling: any) {
  let ext = getExtensionElements(bo);
  if (!ext) {
    ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
    modeling.updateModdleProperties(element, bo, { extensionElements: ext });
  }
  return ext;
}

export function getDefinitions(bo: any): any | null {
  let current = bo;
  while (current && current.$parent) {
    if (current.$type === 'bpmn:Definitions') {
      return current;
    }
    current = current.$parent;
  }
  return null;
}
