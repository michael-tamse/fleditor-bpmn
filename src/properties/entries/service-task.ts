import { SelectEntry, TextFieldEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

import type { BPMNElement } from '../types';

type ServiceImplType = 'delegate' | 'external';

export function getServiceImplType(bo: any): ServiceImplType {
  const isExternal = (bo.get ? bo.get('flowable:type') : bo['flowable:type']) === 'external-worker'
    || !!(bo.get ? bo.get('flowable:topic') : bo['flowable:topic']);
  return isExternal ? 'external' : 'delegate';
}

export function ServiceImplementationTypeEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const bo = element.businessObject;

  const getValue = () => getServiceImplType(bo);
  const setValue = (val: ServiceImplType) => {
    if (val === 'external') {
      const updates: any = {
        'flowable:type': 'external-worker',
        'flowable:exclusive': false,
        'flowable:delegateExpression': undefined,
        'flowable:async': undefined,
        'flowable:asyncLeave': undefined,
        'flowable:asyncLeaveExclusive': undefined
      };
      modeling.updateProperties(element, updates);
    } else {
      const updates: any = {
        'flowable:type': undefined,
        'flowable:topic': undefined
      };
      modeling.updateProperties(element, updates);
    }
  };
  const getOptions = () => ([
    { label: translate ? translate('Delegate Expression') : 'Delegate Expression', value: 'delegate' },
    { label: translate ? translate('External') : 'External', value: 'external' }
  ]);

  return SelectEntry({
    id: 'flowable-service-impl',
    element,
    label: translate ? translate('Implementation') : 'Implementation',
    getValue,
    setValue,
    getOptions
  });
}

export function ServiceImplementationValueEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;

  const getValue = () => {
    const type = getServiceImplType(bo);
    if (type === 'external') {
      return (bo.get ? bo.get('flowable:topic') : bo['flowable:topic']) || '';
    }
    return (bo.get ? bo.get('flowable:delegateExpression') : bo['flowable:delegateExpression']) || '';
  };

  const setValue = (value: string) => {
    const v = (value || '').trim() || undefined;
    const type = getServiceImplType(bo);
    if (type === 'external') {
      modeling.updateProperties(element, { 'flowable:topic': v });
    } else {
      modeling.updateProperties(element, { 'flowable:delegateExpression': v });
    }
  };

  const label = getServiceImplType(bo) === 'external'
    ? (translate ? translate('Topic') : 'Topic')
    : (translate ? translate('Delegate expression') : 'Delegate expression');

  return TextFieldEntry({
    id: 'flowable-service-impl-value',
    element,
    label,
    getValue,
    setValue,
    debounce
  });
}
