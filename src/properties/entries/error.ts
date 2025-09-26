import { CheckboxEntry, ListGroup, SelectEntry, TextFieldEntry, isCheckboxEntryEdited, isSelectEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';

import type { BPMNElement } from '../types';
import { ensureExtensionElements, getDefinitions } from '../helpers/ext';
import { addFlowableMapping, getFlowableMappings, getMappingType, removeFlowableMapping } from '../helpers/flowable-mappings';
import { getErrorEventDefinition } from '../helpers/errors';

export function ErrorVariableNameEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => (bo.get ? bo.get('flowable:errorVariableName') : (bo as any)['flowable:errorVariableName']) || '';
  const setValue = (value: string) => modeling.updateProperties(element, { 'flowable:errorVariableName': (value || '').trim() || undefined });
  return TextFieldEntry({ id: 'flowable-errorVariableName', element, label: translate ? translate('Error variable name') : 'Error variable name', getValue, setValue, debounce });
}

export function ErrorVariableTransientEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:errorVariableTransient') : (bo as any)['flowable:errorVariableTransient']);
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:errorVariableTransient': !!value });
  return CheckboxEntry({ id: 'flowable-errorVariableTransient', element, label: translate ? translate('Error variable transient') : 'Error variable transient', getValue, setValue });
}

export function ErrorVariableLocalScopeEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:errorVariableLocalScope') : (bo as any)['flowable:errorVariableLocalScope']);
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:errorVariableLocalScope': !!value });
  return CheckboxEntry({ id: 'flowable-errorVariableLocalScope', element, label: translate ? translate('Error variable local scope') : 'Error variable local scope', getValue, setValue });
}

export function ErrorDef_VariableNameEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const definition = getErrorEventDefinition(element);
  const getValue = () => (definition && (definition.get ? definition.get('flowable:errorVariableName') : (definition as any)['flowable:errorVariableName'])) || '';
  const setValue = (value: string) => {
    if (!definition) return;
    modeling.updateModdleProperties(element, definition, { 'flowable:errorVariableName': (value || '').trim() || undefined });
  };
  return TextFieldEntry({ id: 'flowable-errorDef-errorVariableName', element, label: translate ? translate('Error variable name') : 'Error variable name', getValue, setValue, debounce });
}

export function ErrorDef_VariableTransientEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const definition = getErrorEventDefinition(element);
  const getValue = () => !!(definition && (definition.get ? definition.get('flowable:errorVariableTransient') : (definition as any)['flowable:errorVariableTransient']));
  const setValue = (value: boolean) => {
    if (!definition) return;
    modeling.updateModdleProperties(element, definition, { 'flowable:errorVariableTransient': !!value });
  };
  return CheckboxEntry({ id: 'flowable-errorDef-errorVariableTransient', element, label: translate ? translate('Error variable transient') : 'Error variable transient', getValue, setValue });
}

export function ErrorDef_VariableLocalScopeEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const definition = getErrorEventDefinition(element);
  const getValue = () => !!(definition && (definition.get ? definition.get('flowable:errorVariableLocalScope') : (definition as any)['flowable:errorVariableLocalScope']));
  const setValue = (value: boolean) => {
    if (!definition) return;
    modeling.updateModdleProperties(element, definition, { 'flowable:errorVariableLocalScope': !!value });
  };
  return CheckboxEntry({ id: 'flowable-errorDef-errorVariableLocalScope', element, label: translate ? translate('Error variable local scope') : 'Error variable local scope', getValue, setValue });
}

export function ErrorCodeEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const definition = getErrorEventDefinition(element);
  const bo = element.businessObject;
  const getValue = () => {
    const reference = definition && (definition.get ? definition.get('errorRef') : (definition as any).errorRef);
    const code = reference && (reference.get ? reference.get('errorCode') : (reference as any).errorCode);
    return code || '';
  };
  const setValue = (value: string) => {
    if (!definition) return;
    const next = (value || '').trim();
    const reference = definition.get ? definition.get('errorRef') : (definition as any).errorRef;
    if (!next) {
      modeling.updateModdleProperties(element, definition, { errorRef: undefined });
      return;
    }
    if (reference) {
      const currentCode = reference.get ? reference.get('errorCode') : (reference as any).errorCode;
      if (currentCode !== next) {
        modeling.updateModdleProperties(element, reference, { errorCode: next, name: next });
      }
      return;
    }
    const definitions = getDefinitions(bo);
    const rootElements = (definitions && (definitions.get ? definitions.get('rootElements') : definitions.rootElements)) || [];
    let target = rootElements.find((entry: any) => entry && entry.$type === 'bpmn:Error' && ((entry.get ? entry.get('errorCode') : entry.errorCode) === next));
    if (!target) {
      target = bpmnFactory.create('bpmn:Error', { id: 'Error_' + Math.random().toString(36).slice(2, 10), name: next, errorCode: next });
      if (definitions) {
        modeling.updateModdleProperties(element, definitions, { rootElements: rootElements.concat([ target ]) });
      }
    }
    modeling.updateModdleProperties(element, definition, { errorRef: target });
  };
  return TextFieldEntry({ id: 'bpmn-error-code', element, label: translate ? translate('Error code') : 'Error code', getValue, setValue, debounce });
}

function addErrorMapping(element: BPMNElement, bpmnFactory: any, modeling: any) {
  const bo = element.businessObject;
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const mapping = bpmnFactory.create('flowable:In', { source: 'errorCode' });
  modeling.updateModdleProperties(element, ext, { values: values.concat([ mapping ]) });
}

function ErrorInSourceEntry(props: { element: BPMNElement; mapping: any; id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => (mapping.get ? mapping.get('source') : mapping.source) || 'errorCode';
  const setValue = (value: 'errorCode' | 'errorMessage' | 'error') => modeling.updateModdleProperties(element, mapping, { source: value });
  const getOptions = () => ([
    { label: translate ? translate('Error code') : 'Error code', value: 'errorCode' },
    { label: translate ? translate('Error message') : 'Error message', value: 'errorMessage' },
    { label: translate ? translate('BPMN Error') : 'BPMN Error', value: 'error' }
  ]);
  return SelectEntry({ element, id, label: translate ? translate('Source') : 'Source', getValue, setValue, getOptions });
}

function ErrorInTargetEntry(props: { element: BPMNElement; mapping: any; id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (mapping.get ? mapping.get('target') : mapping.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, mapping, { target: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Target variable') : 'Target variable', getValue, setValue, debounce });
}

function ErrorInTransientEntry(props: { element: BPMNElement; mapping: any; id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => !!(mapping.get ? mapping.get('transient') : mapping.transient);
  const setValue = (value: boolean) => modeling.updateModdleProperties(element, mapping, { transient: !!value });
  return CheckboxEntry({ id, element, label: translate ? translate('Transient') : 'Transient', getValue, setValue });
}

function ErrorMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const mappings = getFlowableMappings(element.businessObject, 'In');
  const items = mappings.map((mapping: any, index: number) => {
    const entryLabel = (mapping.get ? (mapping.get('target') || mapping.get('source')) : (mapping.target || mapping.source)) || '';
    const entries = [
      { id: `flowable-error-in-${index}-source`, element, mapping, component: ErrorInSourceEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-error-in-${index}-target`, element, mapping, component: ErrorInTargetEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-error-in-${index}-transient`, element, mapping, component: ErrorInTransientEntry, isEdited: isCheckboxEntryEdited }
    ];
    const remove = () => removeFlowableMapping(element, mapping, modeling);
    return { id: `flowable-error-in-item-${index}`, label: entryLabel, entries, remove, autoFocusEntry: `flowable-error-in-${index}-source` };
  });
  const add = (event?: any) => {
    try { event && event.stopPropagation && event.stopPropagation(); } catch {}
    addErrorMapping(element, bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Error mapping') : 'Error mapping'),
    element,
    items,
    add,
    shouldSort: false
  });
}

export function createErrorMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-error-mapping',
    component: ErrorMappingGroupComponent
  } as any;
}

function ErrorOutMappingTypeEntry(props: { element: BPMNElement; mapping: any; id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => getMappingType(mapping);
  const setValue = (value: 'source' | 'sourceExpression') => {
    (mapping as any).__flowableType = value;
    if (value === 'source') {
      modeling.updateModdleProperties(element, mapping, { sourceExpression: undefined });
    } else {
      modeling.updateModdleProperties(element, mapping, { source: undefined });
    }
  };
  const getOptions = () => ([
    { label: translate ? translate('Variable') : 'Variable', value: 'source' },
    { label: translate ? translate('Expression') : 'Expression', value: 'sourceExpression' }
  ]);
  return SelectEntry({
    element,
    id,
    label: translate ? translate('Source type') : 'Source type',
    getValue,
    setValue,
    getOptions
  });
}

function ErrorOutMappingSourceEntry(props: { element: BPMNElement; mapping: any; id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => {
    const type = getMappingType(mapping);
    return type === 'source'
      ? ((mapping.get ? mapping.get('source') : mapping.source) || '')
      : ((mapping.get ? mapping.get('sourceExpression') : mapping.sourceExpression) || '');
  };
  const setValue = (value: string) => {
    const clean = (value || '').trim() || undefined;
    const type = getMappingType(mapping);
    if (type === 'source') {
      modeling.updateModdleProperties(element, mapping, { source: clean });
      return;
    }
    modeling.updateModdleProperties(element, mapping, { sourceExpression: clean });
  };
  const label = translate ? translate('Source (Variable / Expression)') : 'Source (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

function ErrorOutMappingTargetEntry(props: { element: BPMNElement; mapping: any; id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (mapping.get ? mapping.get('target') : mapping.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, mapping, { target: (value || '').trim() || undefined });
  return TextFieldEntry({
    id,
    element,
    label: translate ? translate('Target') : 'Target',
    getValue,
    setValue,
    debounce
  });
}

function ErrorOutMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const mappings = getFlowableMappings(element.businessObject, 'Out');
  const items = mappings.map((mapping: any, index: number) => {
    const entryLabel = (mapping.get ? mapping.get('target') : mapping.target) || '';
    const entries = [
      { id: `flowable-error-out-${index}-type`, element, mapping, component: ErrorOutMappingTypeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-error-out-${index}-source`, element, mapping, component: ErrorOutMappingSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-error-out-${index}-target`, element, mapping, component: ErrorOutMappingTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeFlowableMapping(element, mapping, modeling);
    return {
      id: `flowable-error-out-item-${index}`,
      label: entryLabel,
      entries,
      remove,
      autoFocusEntry: `flowable-error-out-${index}-source`
    };
  });
  const add = (event?: any) => {
    try { event && event.stopPropagation && event.stopPropagation(); } catch {}
    addFlowableMapping(element, 'Out', bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Error mapping') : 'Error mapping'),
    element,
    items,
    add,
    shouldSort: false
  });
}

export function createErrorOutMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-error-mapping',
    component: ErrorOutMappingGroupComponent
  } as any;
}
