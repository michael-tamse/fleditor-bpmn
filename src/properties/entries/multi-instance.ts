import { TextFieldEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

import type { BPMNElement } from '../types';

export function FlowableCollectionEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const loop = element?.businessObject?.loopCharacteristics;

  const getValue = () => (loop && loop.get && loop.get('flowable:collection')) || '';
  const setValue = (value: string) => {
    if (!loop) return;
    modeling.updateModdleProperties(element, loop, { 'flowable:collection': value || undefined });
  };

  return TextFieldEntry({
    id: 'flowable-collection',
    element,
    label: translate ? translate('Collection') : 'Collection',
    getValue,
    setValue,
    debounce
  });
}

export function FlowableElementVariableEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const loop = element?.businessObject?.loopCharacteristics;

  const getValue = () => (loop && loop.get && loop.get('flowable:elementVariable')) || '';
  const setValue = (value: string) => {
    if (!loop) return;
    modeling.updateModdleProperties(element, loop, { 'flowable:elementVariable': value || undefined });
  };

  return TextFieldEntry({
    id: 'flowable-elementVariable',
    element,
    label: translate ? translate('Element variable') : 'Element variable',
    getValue,
    setValue,
    debounce
  });
}

export function FlowableElementIndexVariableEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const loop = element?.businessObject?.loopCharacteristics;

  const getValue = () => (loop && loop.get && loop.get('flowable:elementIndexVariable')) || '';
  const setValue = (value: string) => {
    if (!loop) return;
    modeling.updateModdleProperties(element, loop, { 'flowable:elementIndexVariable': value || undefined });
  };

  return TextFieldEntry({
    id: 'flowable-elementIndexVariable',
    element,
    label: translate ? translate('Element index variable') : 'Element index variable',
    getValue,
    setValue,
    debounce
  });
}
