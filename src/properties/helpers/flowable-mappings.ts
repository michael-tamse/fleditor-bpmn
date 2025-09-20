import { ensureExtensionElements, getExtensionElements } from './ext';

type MappingKind = 'In' | 'Out';

type MappingType = 'source' | 'sourceExpression';

export function getFlowableMappings(bo: any, which: MappingKind) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  const type = `flowable:${which}`;
  const typeLower = `flowable:${String(which).toLowerCase()}`;
  return values.filter((value: any) => {
    const vType = value && value.$type;
    return vType === type || vType === typeLower;
  });
}

export function addFlowableMapping(element: any, which: MappingKind, bpmnFactory: any, modeling: any) {
  const bo = element.businessObject;
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const mapping = bpmnFactory.create(`flowable:${which}`, {});
  modeling.updateModdleProperties(element, ext, { values: values.concat([ mapping ]) });
}

export function removeFlowableMapping(element: any, mapping: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((value: any) => value !== mapping);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

export function getMappingType(mapping: any): MappingType {
  const uiType = (mapping as any).__flowableType;
  if (uiType === 'source' || uiType === 'sourceExpression') {
    return uiType;
  }

  const has = (name: string) => {
    const value = mapping.get ? mapping.get(name) : (mapping as any)[name];
    return typeof value !== 'undefined';
  };

  if (has('sourceExpression') && !has('source')) {
    return 'sourceExpression';
  }

  return 'source';
}
