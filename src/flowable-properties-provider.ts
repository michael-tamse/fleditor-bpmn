import { CheckboxEntry } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';

type BPMNElement = any;

function getType(element: BPMNElement): string {
  return (element && element.businessObject && element.businessObject.$type) || '';
}

function isActivityLike(element: BPMNElement): boolean {
  const t = getType(element);
  return /Task$/.test(t) || /SubProcess$/.test(t) || /CallActivity$/.test(t);
}

function isStartOrEndEvent(element: BPMNElement): boolean {
  const t = getType(element);
  return /StartEvent$/.test(t) || /EndEvent$/.test(t);
}

function AsyncBeforeEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:asyncBefore');
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:asyncBefore': !!value });
  return CheckboxEntry({ id: 'flowable-asyncBefore', element, label: translate ? translate('Async before') : 'Async before', getValue, setValue });
}

function AsyncAfterEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:asyncAfter');
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:asyncAfter': !!value });
  return CheckboxEntry({ id: 'flowable-asyncAfter', element, label: translate ? translate('Async after') : 'Async after', getValue, setValue });
}

function ExclusiveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:exclusive');
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:exclusive': !!value });
  return CheckboxEntry({ id: 'flowable-exclusive', element, label: translate ? translate('Exclusive') : 'Exclusive', getValue, setValue });
}

function createFlowableGroup(element: BPMNElement) {
  const entries = [
    { id: 'flowable-asyncBefore', component: AsyncBeforeEntry },
    { id: 'flowable-asyncAfter', component: AsyncAfterEntry }
  ];
  // Hide Exclusive on events
  if (!isStartOrEndEvent(element)) {
    entries.push({ id: 'flowable-exclusive', component: ExclusiveEntry });
  }
  return {
    id: 'flowable',
    label: 'Flowable',
    entries
  };
}

function FlowablePropertiesProvider(propertiesPanel: any) {
  // define API first, then register
  this.getGroups = function(element: BPMNElement) {
    return function(groups: any[]) {
      try { console.debug && console.debug('[FlowableProvider] getGroups for', getType(element), 'groups in:', groups && groups.length); } catch (e) {}
      if (isActivityLike(element) || isStartOrEndEvent(element)) {
        groups.push(createFlowableGroup(element));
        try { console.debug && console.debug('[FlowableProvider] added Flowable group'); } catch (e) {}
      }
      return groups;
    };
  };
  if (propertiesPanel && typeof propertiesPanel.registerProvider === 'function') {
    // priority: 500 (after default groups, before custom low-prio)
    propertiesPanel.registerProvider(500, this);
    try { console.debug && console.debug('FlowablePropertiesProvider registered'); } catch (e) {}
  }
}

// Injection declaration for bpmn-js DI
(FlowablePropertiesProvider as any).$inject = [ 'propertiesPanel' ];

export default {
  __init__: [ 'flowablePropertiesProvider' ],
  flowablePropertiesProvider: [ 'type', FlowablePropertiesProvider ]
};

