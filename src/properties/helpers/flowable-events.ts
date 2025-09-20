import { ensureExtensionElements, getExtensionElements } from './ext';

type EventParameterKind = 'In' | 'Out';

export function getEventTypeElement(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((value: any) => value && /flowable:(eventType)$/i.test(String(value.$type || '')));
}

export function getSendSynchronouslyElement(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((value: any) => value && /flowable:(sendSynchronously)$/i.test(String(value.$type || '')));
}

export function getEventParameters(bo: any, kind: EventParameterKind) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  const type = `flowable:event${kind}Parameter`;
  return values.filter((value: any) => value && new RegExp(`flowable:(event${kind}Parameter)`, 'i').test(String(value.$type || '')));
}

export function addEventParameter(element: any, bo: any, kind: EventParameterKind, bpmnFactory: any, modeling: any) {
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const existing = getEventParameters(bo, kind);
  let defaults: Record<string, any> | undefined;

  if (kind === 'In') {
    const isFirst = !existing || existing.length === 0;
    defaults = isFirst
      ? { source: '${execution.getProcessInstanceBusinessKey()}', target: 'businessKey' }
      : undefined;
  }

  const param = bpmnFactory.create(`flowable:Event${kind}Parameter`, defaults || {});
  modeling.updateModdleProperties(element, ext, { values: values.concat([ param ]) });
}

export function removeEventParameter(element: any, param: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const filtered = values.filter((value: any) => value !== param);
  modeling.updateModdleProperties(element, ext, { values: filtered });
}

export function getEventCorrelationParameter(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((value: any) => value && /flowable:(eventCorrelationParameter)$/i.test(String(value.$type || '')));
}
