import { h } from '@bpmn-io/properties-panel/preact';

export function GeneralSpacerEntry() {
  return h('div', {
    className: 'bio-properties-panel-entry',
    style: {
      borderTop: '0.5px solid var(--color-grey-225-10-90)',
      margin: '8px 0 0 0',
      paddingTop: '8px'
    }
  } as any);
}
