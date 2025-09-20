import { ensureExtensionElements, getExtensionElements } from './ext';

export function getFlowableVariableAggregations(bo: any) {
  if (!bo) return [];
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.filter((value: any) => {
    const type = value && value.$type;
    return type === 'flowable:VariableAggregation' || type === 'flowable:variableAggregation';
  });
}

export function addVariableAggregation(element: any, loopBo: any, bpmnFactory: any, modeling: any) {
  if (!loopBo) return;
  const ext = ensureExtensionElements(element, loopBo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const aggregation = bpmnFactory.create('flowable:VariableAggregation', {});
  modeling.updateModdleProperties(element, ext, { values: values.concat([ aggregation ]) });
}

export function removeVariableAggregation(element: any, loopBo: any, aggregation: any, modeling: any) {
  if (!loopBo) return;
  const ext = getExtensionElements(loopBo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const filtered = values.filter((value: any) => value !== aggregation);
  modeling.updateModdleProperties(element, ext, { values: filtered });
}

export function getAggregationDefinitions(aggregation: any) {
  if (!aggregation) return [];
  return (aggregation.get ? aggregation.get('definitions') : aggregation.definitions) || [];
}

export function addAggregationDefinition(element: any, aggregation: any, bpmnFactory: any, modeling: any) {
  const definitions = getAggregationDefinitions(aggregation);
  const definition = bpmnFactory.create('flowable:Variable', {});
  modeling.updateModdleProperties(element, aggregation, { definitions: definitions.concat([ definition ]) });
}

export function removeAggregationDefinition(element: any, aggregation: any, definition: any, modeling: any) {
  if (!aggregation) return;
  const definitions = (aggregation.get ? aggregation.get('definitions') : aggregation.definitions) || [];
  const filtered = definitions.filter((item: any) => item !== definition);
  modeling.updateModdleProperties(element, aggregation, { definitions: filtered });
}
