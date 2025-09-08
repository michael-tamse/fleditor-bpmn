import { CheckboxEntry, Group, isCheckboxEntryEdited } from '@bpmn-io/properties-panel';
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

function AsyncEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:async');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:async': !!value };
    // Rule: Asynchronous unchecked -> Exclusive unchecked
    if (!value && bo.get('flowable:exclusive')) {
      updates['flowable:exclusive'] = false;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-async', element, label: translate ? translate('Enter asynchronously') : 'Enter asynchronously', getValue, setValue });
}

function AsyncLeaveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:asyncLeave');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:asyncLeave': !!value };
    // Rule: Leave asynchronously unchecked -> Leave exclusive unchecked
    if (!value && bo.get('flowable:asyncLeaveExclusive')) {
      updates['flowable:asyncLeaveExclusive'] = false;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-asyncLeave', element, label: translate ? translate('Leave asynchronously') : 'Leave asynchronously', getValue, setValue });
}

function ExclusiveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:exclusive');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:exclusive': !!value };
    // Rule: Exclusive checked -> Asynchronous checked
    if (value && !bo.get('flowable:async')) {
      updates['flowable:async'] = true;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-exclusive', element, label: translate ? translate('Enter exclusive') : 'Enter exclusive', getValue, setValue });
}

function ExclusiveLeaveEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!bo.get('flowable:asyncLeaveExclusive');
  const setValue = (value: boolean) => {
    const updates: any = { 'flowable:asyncLeaveExclusive': !!value };
    // Rule: if Leave exclusive is selected, ensure Leave asynchronously is selected, too
    if (value && !bo.get('flowable:asyncLeave')) {
      updates['flowable:asyncLeave'] = true;
    }
    modeling.updateProperties(element, updates);
  };
  return CheckboxEntry({ id: 'flowable-asyncLeaveExclusive', element, label: translate ? translate('Leave exclusive') : 'Leave exclusive', getValue, setValue });
}

function createExecutionGroup(element: BPMNElement) {
  // Desired order:
  // Asynchronous, Exclusive, Leave asynchronously, Leave exclusive
  const entries: any[] = [ { id: 'flowable-async', component: AsyncEntry, isEdited: isCheckboxEntryEdited } ];
  if (!isStartOrEndEvent(element)) {
    entries.push({ id: 'flowable-exclusive', component: ExclusiveEntry, isEdited: isCheckboxEntryEdited });
  }
  entries.push({ id: 'flowable-asyncLeave', component: AsyncLeaveEntry, isEdited: isCheckboxEntryEdited });
  if (!isStartOrEndEvent(element)) {
    entries.push({ id: 'flowable-asyncLeaveExclusive', component: ExclusiveLeaveEntry, isEdited: isCheckboxEntryEdited });
  }
  return {
    id: 'execution',
    label: 'Execution',
    entries,
    component: Group
  };
}

function FlowablePropertiesProvider(propertiesPanel: any) {
  // define API first, then register
  this.getGroups = function(element: BPMNElement) {
    return function(groups: any[]) {
      try { console.debug && console.debug('[FlowableProvider] getGroups for', getType(element), 'groups in:', groups && groups.length); } catch (e) {}
      if (isActivityLike(element) || isStartOrEndEvent(element)) {
        groups.push(createExecutionGroup(element));
        try { console.debug && console.debug('[FlowableProvider] added Execution group'); } catch (e) {}
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
