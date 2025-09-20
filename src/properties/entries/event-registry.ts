import { CheckboxEntry, Group, ListGroup, TextFieldEntry, isCheckboxEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';

import type { BPMNElement } from '../types';
import {
  addEventParameter,
  getEventCorrelationParameter,
  getEventParameters,
  getEventTypeElement,
  getSendSynchronouslyElement,
  removeEventParameter
} from '../helpers/flowable-events';
import { ensureExtensionElements } from '../helpers/ext';
import { isStartEvent } from '../guards';

export function EventTypeEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;

  const getValue = () => {
    const definition = getEventTypeElement(bo);
    if (!definition) return '';
    const value = definition.get ? definition.get('value') ?? definition.get('text') : definition.value ?? definition.text;
    return value || '';
  };

  const setValue = (value: string) => {
    const next = (value || '').trim();
    let definition = getEventTypeElement(bo);

    if (!next) {
      if (definition) {
        const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const filtered = values.filter((current: any) => current !== definition);
        modeling.updateModdleProperties(element, ext, { values: filtered });
      }
      return;
    }

    if (!definition) {
      const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      definition = bpmnFactory.create('flowable:EventType', { value: next });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ definition ]) });
    } else {
      modeling.updateModdleProperties(element, definition, { value: next });
    }

    // ensure default correlation parameter for StartEvents
    try {
      if (isStartEvent(element)) {
        const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const correlation = getEventCorrelationParameter(bo);
        if (!correlation) {
          const created = bpmnFactory.create('flowable:EventCorrelationParameter', {
            name: 'businessKey',
            value: '${execution.getProcessInstanceBusinessKey()}'
          });
          modeling.updateModdleProperties(element, ext, { values: values.concat([ created ]) });
        }
      }
    } catch {}
  };

  return TextFieldEntry({
    id: 'flowable-eventType',
    element,
    label: translate ? translate('Event key (type)') : 'Event key (type)',
    getValue,
    setValue,
    debounce
  });
}

export function SendSynchronouslyEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const bo = element.businessObject;

  const getValue = () => {
    const definition = getSendSynchronouslyElement(bo);
    if (!definition) return false;
    const value = definition.get ? definition.get('value') ?? definition.get('text') : definition.value ?? definition.text;
    return String(value || '').trim().toLowerCase() === 'true';
  };

  const setValue = (checked: boolean) => {
    let definition = getSendSynchronouslyElement(bo);
    if (!checked) {
      if (definition) {
        const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const filtered = values.filter((current: any) => current !== definition);
        modeling.updateModdleProperties(element, ext, { values: filtered });
      }
      return;
    }

    const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
    const values = (ext.get ? ext.get('values') : ext.values) || [];
    if (!definition) {
      definition = bpmnFactory.create('flowable:SendSynchronously', { value: 'true' });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ definition ]) });
    } else {
      modeling.updateModdleProperties(element, definition, { value: 'true' });
    }
  };

  return CheckboxEntry({
    id: 'flowable-sendSynchronously',
    element,
    label: translate ? translate('Send synchronously') : 'Send synchronously',
    getValue,
    setValue
  });
}

function EventInParamSourceEntry(props: { element: BPMNElement; param: any; id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('source') : param.source) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { source: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Map from') : 'Map from', getValue, setValue, debounce });
}

function EventInParamTargetEntry(props: { element: BPMNElement; param: any; id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('target') : param.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { target: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('To event payload') : 'To event payload', getValue, setValue, debounce });
}

export function OutboundEventMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const mappings = getEventParameters(bo, 'In');

  const items = mappings.map((mapping: any, index: number) => {
    const entryLabel = (mapping.get ? (mapping.get('target') || mapping.get('source')) : (mapping.target || mapping.source)) || '';
    const entries = [
      { id: `flowable-eventIn-${index}-source`, element, param: mapping, component: EventInParamSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-eventIn-${index}-target`, element, param: mapping, component: EventInParamTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeEventParameter(element, mapping, modeling);
    return { id: `flowable-eventIn-item-${index}`, label: entryLabel, entries, remove, autoFocusEntry: `flowable-eventIn-${index}-source` };
  });

  const add = (event?: any) => {
    try { event && event.stopPropagation && event.stopPropagation(); } catch {}
    addEventParameter(element, bo, 'In', bpmnFactory, modeling);
  };

  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Outbound event mapping') : 'Outbound event mapping'),
    element,
    items,
    add,
    shouldSort: false
  });
}

function EventOutParamSourceEntry(props: { element: BPMNElement; param: any; id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('source') : param.source) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { source: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Payload from event') : 'Payload from event', getValue, setValue, debounce });
}

function EventOutParamTargetEntry(props: { element: BPMNElement; param: any; id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('target') : param.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { target: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Map to') : 'Map to', getValue, setValue, debounce });
}

function EventOutParamTransientEntry(props: { element: BPMNElement; param: any; id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => !!(param.get ? param.get('transient') : param.transient);
  const setValue = (checked: boolean) => modeling.updateModdleProperties(element, param, { transient: !!checked });
  return CheckboxEntry({ id, element, label: translate ? translate('Transient') : 'Transient', getValue, setValue });
}

export function InboundEventMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const mappings = getEventParameters(bo, 'Out');

  const items = mappings.map((mapping: any, index: number) => {
    const entryLabel = (mapping.get ? (mapping.get('target') || mapping.get('source')) : (mapping.target || mapping.source)) || '';
    const entries = [
      { id: `flowable-eventOut-${index}-source`, element, param: mapping, component: EventOutParamSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-eventOut-${index}-target`, element, param: mapping, component: EventOutParamTargetEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-eventOut-${index}-transient`, element, param: mapping, component: EventOutParamTransientEntry, isEdited: isCheckboxEntryEdited }
    ];
    const remove = () => removeEventParameter(element, mapping, modeling);
    return { id: `flowable-eventOut-item-${index}`, label: entryLabel, entries, remove, autoFocusEntry: `flowable-eventOut-${index}-source` };
  });

  const add = (event?: any) => {
    try { event && event.stopPropagation && event.stopPropagation(); } catch {}
    addEventParameter(element, bo, 'Out', bpmnFactory, modeling);
  };

  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Inbound event mapping') : 'Inbound event mapping'),
    element,
    items,
    add,
    shouldSort: false
  });
}

export function createOutboundEventMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-outbound-event-mapping',
    component: OutboundEventMappingGroupComponent
  } as any;
}

export function createInboundEventMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-inbound-event-mapping',
    component: InboundEventMappingGroupComponent
  } as any;
}

export function EventCorrelationParamNameEntry(props: { element: BPMNElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = element.businessObject;

  const getValue = () => {
    const parameter = getEventCorrelationParameter(bo);
    return parameter && (parameter.get ? parameter.get('name') : parameter.name) || '';
  };

  const setValue = (value: string) => {
    const next = (value || '').trim();
    let parameter = getEventCorrelationParameter(bo);
    if (!next) {
      if (parameter) {
        modeling.updateModdleProperties(element, parameter, { name: undefined });
      }
      return;
    }

    if (!parameter) {
      const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      parameter = bpmnFactory.create('flowable:EventCorrelationParameter', { name: next });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ parameter ]) });
    } else {
      modeling.updateModdleProperties(element, parameter, { name: next });
    }
  };

  return TextFieldEntry({ id, element, label: translate ? translate('Parameter name') : 'Parameter name', getValue, setValue, debounce });
}

export function EventCorrelationParamValueEntry(props: { element: BPMNElement; id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bpmnFactory = useService('bpmnFactory');
  const bo = element.businessObject;

  const getValue = () => {
    const parameter = getEventCorrelationParameter(bo);
    return parameter && (parameter.get ? parameter.get('value') : parameter.value) || '';
  };

  const setValue = (value: string) => {
    const next = (value || '').trim();
    let parameter = getEventCorrelationParameter(bo);
    if (!next) {
      if (parameter) {
        modeling.updateModdleProperties(element, parameter, { value: undefined });
      }
      return;
    }

    if (!parameter) {
      const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      parameter = bpmnFactory.create('flowable:EventCorrelationParameter', { value: next });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ parameter ]) });
    } else {
      modeling.updateModdleProperties(element, parameter, { value: next });
    }
  };

  return TextFieldEntry({ id, element, label: translate ? translate('Parameter value') : 'Parameter value', getValue, setValue, debounce });
}

export function createCorrelationParametersGroup(_element: BPMNElement) {
  return {
    id: 'flowable-correlation-parameters',
    label: 'Correlation parameter',
    entries: [
      { id: 'flowable-eventCorr-name', component: EventCorrelationParamNameEntry, isEdited: isTextFieldEntryEdited },
      { id: 'flowable-eventCorr-value', component: EventCorrelationParamValueEntry, isEdited: isTextFieldEntryEdited }
    ],
    component: Group
  } as any;
}
