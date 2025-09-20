import { CheckboxEntry, ListGroup, SelectEntry, TextFieldEntry, isSelectEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';

import type { BPMNElement } from '../types';
import {
  addFlowableMapping,
  getFlowableMappings,
  getMappingType,
  removeFlowableMapping
} from '../helpers/flowable-mappings';

export function InOutMappingTypeEntry(props: { element: BPMNElement; id: string; mapping: any }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => getMappingType(mapping);
  const setValue = (val: 'source' | 'sourceExpression') => {
    (mapping as any).__flowableType = val;
    if (val === 'source') {
      modeling.updateModdleProperties(element, mapping, { sourceExpression: undefined });
    } else {
      modeling.updateModdleProperties(element, mapping, { source: undefined });
    }
  };
  const getOptions = () => ([
    { label: translate ? translate('Source') : 'Source', value: 'source' },
    { label: translate ? translate('Source expression') : 'Source expression', value: 'sourceExpression' }
  ]);
  return SelectEntry({ element, id, label: translate ? translate('Type') : 'Type', getValue, setValue, getOptions });
}

export function InOutMappingSourceEntry(props: { element: BPMNElement; id: string; mapping: any }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => {
    const type = getMappingType(mapping);
    if (type === 'source') {
      return (mapping.get ? mapping.get('source') : mapping.source) || '';
    }
    return (mapping.get ? mapping.get('sourceExpression') : mapping.sourceExpression) || '';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim() || undefined;
    const type = getMappingType(mapping);
    if (type === 'source') {
      modeling.updateModdleProperties(element, mapping, { source: v });
    } else {
      modeling.updateModdleProperties(element, mapping, { sourceExpression: v });
    }
  };
  const label = getMappingType(mapping) === 'source'
    ? (translate ? translate('Source') : 'Source')
    : (translate ? translate('Source expression') : 'Source expression');
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

export function InOutMappingTargetEntry(props: { element: BPMNElement; id: string; mapping: any }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (mapping.get ? mapping.get('target') : mapping.target) || '';
  const setValue = (value: string) => {
    modeling.updateModdleProperties(element, mapping, { target: (value || '').trim() || undefined });
  };
  return TextFieldEntry({ id, element, label: translate ? translate('Target') : 'Target', getValue, setValue, debounce });
}

export function InMappingsGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const mappings = getFlowableMappings(bo, 'In');
  const items = mappings.map((mapping: any, index: number) => {
    const entryLabel = (mapping.get ? mapping.get('target') : mapping.target) || '';
    const entries = [
      { id: `flowable-in-${index}-type`, mapping, component: InOutMappingTypeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-in-${index}-source`, mapping, component: InOutMappingSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-in-${index}-target`, mapping, component: InOutMappingTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeFlowableMapping(element, mapping, modeling);
    return { id: `flowable-in-item-${index}`, label: entryLabel, entries, remove, autoFocusEntry: `flowable-in-${index}-source` };
  });
  const add = (event?: any) => {
    try { event && event.stopPropagation && event.stopPropagation(); } catch {}
    addFlowableMapping(element, 'In', bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('In mappings') : 'In mappings'),
    element,
    items,
    add,
    shouldSort: false
  });
}

export function OutMappingsGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const mappings = getFlowableMappings(bo, 'Out');
  const items = mappings.map((mapping: any, index: number) => {
    const entryLabel = (mapping.get ? mapping.get('target') : mapping.target) || '';
    const entries = [
      { id: `flowable-out-${index}-type`, mapping, component: InOutMappingTypeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-out-${index}-source`, mapping, component: InOutMappingSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-out-${index}-target`, mapping, component: InOutMappingTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeFlowableMapping(element, mapping, modeling);
    return { id: `flowable-out-item-${index}`, label: entryLabel, entries, remove, autoFocusEntry: `flowable-out-${index}-source` };
  });
  const add = (event?: any) => {
    try { event && event.stopPropagation && event.stopPropagation(); } catch {}
    addFlowableMapping(element, 'Out', bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Out mappings') : 'Out mappings'),
    element,
    items,
    add,
    shouldSort: false
  });
}

export function UseLocalScopeForOutParametersEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:useLocalScopeForOutParameters') : (bo as any)['flowable:useLocalScopeForOutParameters']);
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:useLocalScopeForOutParameters': !!value });
  return CheckboxEntry({
    id: 'flowable-useLocalScopeForOutParameters',
    element,
    label: translate ? translate('Use local scope for out mapping') : 'Use local scope for out mapping',
    getValue,
    setValue
  });
}

export function OutMappingsOptionsComponent(props: any) {
  const { element, id } = props;
  return h('div', {
    className: 'bio-properties-panel-group',
    'data-group-id': `group-${id}`
  } as any, [
    h('div', { className: 'bio-properties-panel-group-entries open' } as any, [
      h(UseLocalScopeForOutParametersEntry as any, { element })
    ])
  ]);
}
