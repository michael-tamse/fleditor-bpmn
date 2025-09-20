import { CheckboxEntry, TextFieldEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

import type { BPMNElement } from '../types';
import {
  ensureBusinessRuleDefaults,
  ensureFlowableField,
  findFlowableFieldByName,
  getFieldStringValue,
  setFieldStringValue
} from '../helpers/dmn';

export function DecisionTableReferenceEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;

  const getValue = () => {
    const field = findFlowableFieldByName(bo, 'decisionTableReferenceKey');
    return getFieldStringValue(field);
  };

  const setValue = (value: string) => {
    const field = ensureFlowableField(element, bo, 'decisionTableReferenceKey', bpmnFactory, modeling);
    setFieldStringValue(element, field, (value || '').trim(), bpmnFactory, modeling);
    ensureBusinessRuleDefaults(element, bo, bpmnFactory, modeling);
  };

  return TextFieldEntry({
    id: 'flowable-decisionTableReferenceKey',
    element,
    label: translate ? translate('Decision table reference') : 'Decision table reference',
    getValue,
    setValue,
    debounce
  });
}

export function DecisionThrowOnNoHitsEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;

  const getValue = () => {
    const field = findFlowableFieldByName(bo, 'decisionTaskThrowErrorOnNoHits');
    return String(getFieldStringValue(field)).trim().toLowerCase() === 'true';
  };

  const setValue = (checked: boolean) => {
    const field = ensureFlowableField(element, bo, 'decisionTaskThrowErrorOnNoHits', bpmnFactory, modeling);
    setFieldStringValue(element, field, checked ? 'true' : 'false', bpmnFactory, modeling);
    ensureBusinessRuleDefaults(element, bo, bpmnFactory, modeling);
  };

  return CheckboxEntry({
    id: 'flowable-decisionTaskThrowErrorOnNoHits',
    element,
    label: translate ? translate('Throw error if no rules were hit') : 'Throw error if no rules were hit',
    getValue,
    setValue
  });
}
