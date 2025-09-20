import { TextAreaEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

import type { BPMNElement } from '../types';

export function ConditionExpressionEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;

  const getValue = () => {
    const expr = bo && (bo.get ? bo.get('conditionExpression') : bo.conditionExpression);
    if (!expr) return '';
    const body = expr.get ? expr.get('body') : expr.body;
    const text = expr.get ? expr.get('text') : expr.text;
    return body || text || '';
  };

  const setValue = (value: string) => {
    const v = (value || '').trim();
    const current = bo && (bo.get ? bo.get('conditionExpression') : bo.conditionExpression);

    if (!v) {
      if (current) modeling.updateModdleProperties(element, bo, { conditionExpression: undefined });
      return;
    }

    if (current && (/FormalExpression$/.test(current.$type || ''))) {
      modeling.updateModdleProperties(element, current, { body: v });
    } else {
      const formal = bpmnFactory.create('bpmn:FormalExpression', { body: v });
      modeling.updateModdleProperties(element, bo, { conditionExpression: formal });
    }
  };

  return TextAreaEntry({
    id: 'bpmn-conditionExpression',
    element,
    label: translate ? translate('Condition Expression') : 'Condition Expression',
    getValue,
    setValue,
    debounce,
    rows: 3,
    monospace: true,
    autoResize: true
  });
}
