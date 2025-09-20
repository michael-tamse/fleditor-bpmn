import { CheckboxEntry, TextFieldEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

import type { BPMNElement } from '../types';

export function CalledElementEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => (bo.get ? bo.get('calledElement') : bo.calledElement) || '';
  const setValue = (value: string) => modeling.updateProperties(element, { calledElement: (value || '').trim() || undefined });
  return TextFieldEntry({ id: 'bpmn-calledElement', element, label: translate ? translate('Process reference') : 'Process reference', getValue, setValue, debounce });
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
