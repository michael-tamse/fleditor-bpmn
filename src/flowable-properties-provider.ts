import { CheckboxEntry, Group, isCheckboxEntryEdited, TextFieldEntry, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';

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

function isServiceTask(element: BPMNElement): boolean {
  return /ServiceTask$/.test(getType(element));
}

// Only show Execution for engine-executed task types
function isEngineExecutedTask(element: BPMNElement): boolean {
  const t = getType(element);
  // Include: ServiceTask, SendTask, ReceiveTask, BusinessRuleTask, ScriptTask, CallActivity
  // Exclude: generic Task, UserTask, ManualTask, and non-task elements
  return /^(bpmn:)?(ServiceTask|SendTask|ReceiveTask|BusinessRuleTask|ScriptTask|CallActivity)$/.test(t);
}

// Stable component for delegate expression to preserve focus across re-renders
function DelegateExpressionEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const el = props.element;
  const bo = el.businessObject;
  const getValue = () => (bo.get && bo.get('flowable:delegateExpression')) || '';
  const setValue = (value: string) => modeling.updateProperties(el, { 'flowable:delegateExpression': value || undefined });
  return TextFieldEntry({ id: 'flowable-delegateExpression', element: el, label: translate ? translate('Delegate expression') : 'Delegate expression', getValue, setValue, debounce });
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

// Standard BPMN: isForCompensation flag on activities
function IsForCompensationEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('isForCompensation') : bo.isForCompensation);
  const setValue = (value: boolean) => modeling.updateProperties(element, { isForCompensation: !!value });
  return CheckboxEntry({ id: 'bpmn-isForCompensation', element, label: translate ? translate('Is for compensation') : 'Is for compensation', getValue, setValue });
}

// Simple spacer entry to visually separate groups of entries within a group
function SpacerEntry() {
  return h('div', {
    className: 'bio-properties-panel-entry',
    style: {
      borderTop: '0.5px solid var(--color-grey-225-10-90)',
      margin: '8px 0 0 0',
      paddingTop: '8px'
    }
  } as any);
}

// Multi-Instance: Flowable collection
function FlowableCollectionEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const loop = element && element.businessObject && element.businessObject.loopCharacteristics;
  const getValue = () => (loop && loop.get && loop.get('flowable:collection')) || '';
  const setValue = (value: string) => {
    if (!loop) return;
    modeling.updateModdleProperties(element, loop, { 'flowable:collection': value || undefined });
  };
  return TextFieldEntry({ id: 'flowable-collection', element, label: translate ? translate('Collection') : 'Collection', getValue, setValue, debounce });
}

// Multi-Instance: Flowable element variable
function FlowableElementVariableEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const loop = element && element.businessObject && element.businessObject.loopCharacteristics;
  const getValue = () => (loop && loop.get && loop.get('flowable:elementVariable')) || '';
  const setValue = (value: string) => {
    if (!loop) return;
    modeling.updateModdleProperties(element, loop, { 'flowable:elementVariable': value || undefined });
  };
  return TextFieldEntry({ id: 'flowable-elementVariable', element, label: translate ? translate('Element variable') : 'Element variable', getValue, setValue, debounce });
}

// Multi-Instance: Flowable element index variable
function FlowableElementIndexVariableEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const loop = element && element.businessObject && element.businessObject.loopCharacteristics;
  const getValue = () => (loop && loop.get && loop.get('flowable:elementIndexVariable')) || '';
  const setValue = (value: string) => {
    if (!loop) return;
    modeling.updateModdleProperties(element, loop, { 'flowable:elementIndexVariable': value || undefined });
  };
  return TextFieldEntry({ id: 'flowable-elementIndexVariable', element, label: translate ? translate('Element index variable') : 'Element index variable', getValue, setValue, debounce });
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
  // Spacer between async/exclusive markers and generic flags
  entries.push({ id: 'execution-spacer-1', component: SpacerEntry });
  // New: Is for compensation
  entries.push({ id: 'bpmn-isForCompensation', component: IsForCompensationEntry, isEdited: isCheckboxEntryEdited });
  return {
      id: 'execution',
      label: 'Execution',
      entries,
      component: Group
    };
  }

function FlowablePropertiesProvider(this: any, propertiesPanel: any) {
  // define API first, then register
  this.getGroups = function(element: BPMNElement) {
    return function(groups: any[]) {
      try { console.debug && console.debug('[FlowableProvider] getGroups for', getType(element), 'groups in:', groups && groups.length); } catch (e) {}
      // Add Flowable Service Task "Delegate expression" field to General
      if (isServiceTask(element)) {
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (general && Array.isArray(general.entries)) {
          const exists = general.entries.some((e: any) => e && e.id === 'flowable-delegateExpression');
          if (!exists) {
            const idx = general.entries.findIndex((e: any) => e && e.id === 'id');
            const def = { id: 'flowable-delegateExpression', component: DelegateExpressionEntry, isEdited: isTextFieldEntryEdited };
            if (idx >= 0) general.entries.splice(idx + 1, 0, def); else general.entries.unshift(def);
          }
        }
      }
      // Add Flowable fields to Multi-Instance section
      const bo = element && element.businessObject;
      const loop = bo && bo.loopCharacteristics;
      const miGroup = groups && groups.find((g) => g && (g.id === 'multiInstance' || g.id === 'multiInstanceGroup'));
      if (loop && (miGroup && Array.isArray(miGroup.entries))) {
        const wantOrdered = [
          { id: 'flowable-collection', component: FlowableCollectionEntry },
          { id: 'flowable-elementVariable', component: FlowableElementVariableEntry },
          { id: 'flowable-elementIndexVariable', component: FlowableElementIndexVariableEntry }
        ];
        // ensure our Flowable fields exist
        wantOrdered.forEach((def) => {
          const exists = miGroup.entries.some((e: any) => e && e.id === def.id);
          if (!exists) miGroup.entries.push({ ...def, isEdited: isTextFieldEntryEdited });
        });
        // reorder: put our fields first, then Loop cardinality + Completion condition, then the rest
        const isOur = (id: string) => /^(flowable-(collection|elementVariable|elementIndexVariable))$/.test(id);
        const isLoopCard = (id: string) => /cardinality/i.test(id) || /loop.*cardinality/i.test(id) || /loop-cardinality/i.test(id);
        const isCompletion = (id: string) => /completion/i.test(id) && /condition/i.test(id);

        const orderMap: Record<string, number> = {
          'flowable-collection': 0,
          'flowable-elementVariable': 1,
          'flowable-elementIndexVariable': 2
        };
        const entries = miGroup.entries.slice();
        const ours: any[] = [];
        const loopAndCompletion: any[] = [];
        const others: any[] = [];
        entries.forEach((e: any) => {
          const id = String(e && e.id || '');
          if (!id) { others.push(e); return; }
          if (isOur(id)) { ours.push(e); return; }
          if (isLoopCard(id) || isCompletion(id)) { loopAndCompletion.push(e); return; }
          others.push(e);
        });
        // sort our three in desired order
        ours.sort((a, b) => (orderMap[String(a.id)] ?? 99) - (orderMap[String(b.id)] ?? 99));
        const newEntries = [ ...ours, ...loopAndCompletion, ...others ];
        miGroup.entries.splice(0, miGroup.entries.length, ...newEntries);
        try { console.debug && console.debug('[FlowableProvider] ordered MI entries (ours first, then loop/completion)'); } catch (e) {}
      } else if (loop) {
        // Fallback: if built-in group not found, add our own MI group with these entries
        const entries: any[] = [
          { id: 'flowable-collection', component: FlowableCollectionEntry, isEdited: isTextFieldEntryEdited },
          { id: 'flowable-elementVariable', component: FlowableElementVariableEntry, isEdited: isTextFieldEntryEdited },
          { id: 'flowable-elementIndexVariable', component: FlowableElementIndexVariableEntry, isEdited: isTextFieldEntryEdited }
        ];
        groups.push({ id: 'flowable-multiInstance', label: 'Multi-Instance', entries, component: Group });
        try { console.debug && console.debug('[FlowableProvider] added fallback MI group'); } catch (e) {}
      }
      if (isEngineExecutedTask(element)) {
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
