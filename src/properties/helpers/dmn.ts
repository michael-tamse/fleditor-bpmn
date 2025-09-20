import { ensureExtensionElements, getExtensionElements } from './ext';

export function findFlowableFieldByName(bo: any, name: string) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((value: any) => {
    const type = value && value.$type;
    const fieldName = value && (value.get ? value.get('name') : value.name);
    return /flowable:(field)$/i.test(String(type || '')) && fieldName === name;
  });
}

export function ensureFlowableField(element: any, bo: any, name: string, bpmnFactory: any, modeling: any) {
  let field = findFlowableFieldByName(bo, name);
  if (field) return field;
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  field = bpmnFactory.create('flowable:Field', { name });
  modeling.updateModdleProperties(element, ext, { values: values.concat([ field ]) });
  return field;
}

export function getFieldStringValue(field: any): string {
  if (!field) return '';
  const node = field.get ? field.get('string') : field.string;
  if (!node) return '';
  const value = node.get ? node.get('value') ?? node.get('text') : node.value ?? node.text;
  return value || '';
}

export function setFieldStringValue(element: any, field: any, value: string, bpmnFactory: any, modeling: any) {
  if (!field) return;
  let node = field.get ? field.get('string') : field.string;
  if (!value) {
    if (node) {
      modeling.updateModdleProperties(element, field, { string: undefined });
    }
    return;
  }
  if (!node) {
    node = bpmnFactory.create('flowable:String', { value });
  }
  modeling.updateModdleProperties(element, field, { string: node });
  modeling.updateModdleProperties(element, node, { value });
}

export function ensureBusinessRuleDefaults(element: any, bo: any, bpmnFactory: any, modeling: any) {
  if (!element || !bo) return;
  const fallbackField = ensureFlowableField(element, bo, 'fallbackToDefaultTenant', bpmnFactory, modeling);
  setFieldStringValue(element, fallbackField, 'true', bpmnFactory, modeling);

  const sameDeploymentField = ensureFlowableField(element, bo, 'sameDeployment', bpmnFactory, modeling);
  setFieldStringValue(element, sameDeploymentField, 'true', bpmnFactory, modeling);

  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  let decisionRefType = values.find((value: any) => /flowable:(decisionReferenceType)$/i.test(String(value?.$type || '')));
  if (!decisionRefType) {
    decisionRefType = bpmnFactory.create('flowable:DecisionReferenceType', { value: 'decisionTable' });
    modeling.updateModdleProperties(element, ext, { values: values.concat([ decisionRefType ]) });
  } else {
    modeling.updateModdleProperties(element, decisionRefType, { value: 'decisionTable' });
  }
}
