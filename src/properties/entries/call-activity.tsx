import { CheckboxEntry, TextFieldEntry } from '@bpmn-io/properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';
import { useMemo, useRef } from '@bpmn-io/properties-panel/preact/hooks';
import { useService } from 'bpmn-js-properties-panel';

import { deriveProcessId } from '../../bpmn-xml-utils';
import type { BPMNElement } from '../types';

import '../styles/properties-panel-ext.css';

export function CalledElementEntry(props: { element: BPMNElement }) {
  const element = props.element;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const bo = element.businessObject;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useMemo(() => `bio-properties-panel-calledElement-${element.id}`, [ element.id ]);

  const label = translate ? translate('Process reference') : 'Process reference';
  const buttonLabel = translate ? translate('Load…') : 'Laden…';

  const getValue = () => (bo.get ? bo.get('calledElement') : bo.calledElement) || '';

  const setValue = (value: string) => {
    modeling.updateProperties(element, { calledElement: (value || '').trim() || undefined });
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
      const processId = deriveProcessId(text);
      if (processId) {
        setValue(processId);
      } else {
        console.debug?.('[FlowableCallActivity] Process ID not found in selected file', file.name);
      }
    } catch (err) {
      console.debug?.('[FlowableCallActivity] Failed to load process reference', err);
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
          name="bpmn-calledElement"
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
        accept=".bpmn,.bpmn20.xml,.bpmn.xml,.xml,application/xml,text/xml"
        onChange={onLocalFile}
      />
    </div>
  );
}

export function BusinessKeyEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => (bo.get ? bo.get('flowable:businessKey') : (bo as any)['flowable:businessKey']) || '';
  const setValue = (value: string) => {
    const v = (value || '').trim() || undefined;
    const updates: any = {
      'flowable:businessKey': v,
      'flowable:fallbackToDefaultTenant': true,
      'flowable:sameDeployment': true
    };
    if (typeof v !== 'undefined') {
      updates['flowable:inheritBusinessKey'] = false;
    }
    modeling.updateProperties(element, updates);
  };
  return TextFieldEntry({ id: 'flowable-businessKey', element, label: translate ? translate('Business key') : 'Business key', getValue, setValue, debounce });
}

export function InheritBusinessKeyEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => {
    const v = bo && (bo.get ? bo.get('flowable:inheritBusinessKey') : (bo as any)['flowable:inheritBusinessKey']);
    if (typeof v === 'boolean') return v;
    const hasBusinessKey = !!(bo && (bo.get ? bo.get('flowable:businessKey') : (bo as any)['flowable:businessKey']));
    return hasBusinessKey ? false : true;
  };
  const setValue = (value: boolean) => {
    const updates: any = {
      'flowable:inheritBusinessKey': !!value,
      'flowable:sameDeployment': true,
      'flowable:fallbackToDefaultTenant': true
    };
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-inheritBusinessKey', element, label: translate ? translate('Inherit business key') : 'Inherit business key', getValue, setValue });
}

export function InheritVariablesEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => {
    const v = bo && (bo.get ? bo.get('flowable:inheritVariables') : (bo as any)['flowable:inheritVariables']);
    return typeof v === 'boolean' ? v : true;
  };
  const setValue = (value: boolean) => {
    const updates: any = {
      'flowable:inheritVariables': !!value,
      'flowable:sameDeployment': true,
      'flowable:fallbackToDefaultTenant': true
    };
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-inheritVariables', element, label: translate ? translate('Inherit variables') : 'Inherit variables', getValue, setValue });
}
