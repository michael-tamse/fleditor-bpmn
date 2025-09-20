import { CheckboxEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

import type { BPMNElement } from '../types';

export function AsyncEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:async');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:async': !!value };
    if (!value && bo.get('flowable:exclusive')) {
      updates['flowable:exclusive'] = false;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-async', element, label: translate ? translate('Enter asynchronously') : 'Enter asynchronously', getValue, setValue });
}

export function AsyncLeaveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:asyncLeave');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:asyncLeave': !!value };
    if (!value && bo.get('flowable:asyncLeaveExclusive')) {
      updates['flowable:asyncLeaveExclusive'] = false;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-asyncLeave', element, label: translate ? translate('Leave asynchronously') : 'Leave asynchronously', getValue, setValue });
}

export function ExclusiveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:exclusive');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:exclusive': !!value };
    if (value && !bo.get('flowable:async')) {
      updates['flowable:async'] = true;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-exclusive', element, label: translate ? translate('Enter exclusive') : 'Enter exclusive', getValue, setValue });
}

export function ExclusiveLeaveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:asyncLeaveExclusive');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:asyncLeaveExclusive': !!value };
    if (value && !bo.get('flowable:asyncLeave')) {
      updates['flowable:asyncLeave'] = true;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-asyncLeaveExclusive', element, label: translate ? translate('Leave exclusive') : 'Leave exclusive', getValue, setValue });
}

export function IsForCompensationEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('isForCompensation') : bo.isForCompensation);
  const setValue = (value: boolean) => modeling.updateProperties(element, { isForCompensation: !!value });
  return CheckboxEntry({ id: 'bpmn-isForCompensation', element, label: translate ? translate('Is for compensation') : 'Is for compensation', getValue, setValue });
}

export function CompleteAsyncEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:completeAsync') : (bo as any)['flowable:completeAsync']);
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:completeAsync': !!value });
  return CheckboxEntry({ id: 'flowable-completeAsync', element, label: translate ? translate('Complete asynchronously') : 'Complete asynchronously', getValue, setValue });
}
