import { CheckboxEntry } from '@bpmn-io/properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';
import { useMemo, useRef } from '@bpmn-io/properties-panel/preact/hooks';
import { useService } from 'bpmn-js-properties-panel';

import { deriveDmnId } from '../../bpmn-xml-utils';
import type { BPMNElement } from '../types';
import {
  ensureBusinessRuleDefaults,
  ensureFlowableField,
  findFlowableFieldByName,
  getFieldStringValue,
  setFieldStringValue
} from '../helpers/dmn';

import '../styles/properties-panel-ext.css';

export function DecisionTableReferenceEntry(props: { element: BPMNElement }) {
  const element = props.element;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const bo = element.businessObject;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useMemo(() => `bio-properties-panel-decision-ref-${element.id}`, [ element.id ]);

  const label = translate ? translate('Decision table reference') : 'Decision table reference';
  const buttonLabel = translate ? translate('Load…') : 'Laden…';

  const getValue = () => {
    const field = findFlowableFieldByName(bo, 'decisionTableReferenceKey');
    return getFieldStringValue(field);
  };

  const setValue = (value: string) => {
    const field = ensureFlowableField(element, bo, 'decisionTableReferenceKey', bpmnFactory, modeling);
    setFieldStringValue(element, field, (value || '').trim(), bpmnFactory, modeling);
    ensureBusinessRuleDefaults(element, bo, bpmnFactory, modeling);
  };

  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    setValue(target.value);
  };

  const triggerPicker = () => {
    const input = fileInputRef.current;
    input?.click();
  };

  const onPick = (event?: Event) => {
    try { event?.preventDefault(); } catch {}
    triggerPicker();
  };

  const onLocalFile = async (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const decisionId = deriveDmnId(text);
      if (decisionId) {
        setValue(decisionId);
      } else {
        console.debug?.('[FlowableBusinessRuleTask] Decision ID not found in selected file', file.name);
      }
    } catch (err) {
      console.debug?.('[FlowableBusinessRuleTask] Failed to load decision reference', err);
    } finally {
      try {
        if (input) {
          input.value = '';
        }
      } catch {}
    }
  };

  const value = getValue();

  return (
    <div className="bio-properties-panel-entry flowable-load-entry">
      <label className="bio-properties-panel-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="bio-properties-panel-textfield">
        <input
          id={inputId}
          name="flowable-decisionTableReferenceKey"
          type="text"
          spellCheck="false"
          autoComplete="off"
          className="bio-properties-panel-input"
          value={value}
          onInput={onInput}
        />
      </div>
      <div className="flowable-load-actions">
        <button
          type="button"
          className="bio-properties-panel-button flowable-load-button"
          onClick={onPick}
        >
          {buttonLabel}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".dmn,.dmn.xml,.xml,application/xml,text/xml"
        onChange={onLocalFile}
      />
    </div>
  );
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
