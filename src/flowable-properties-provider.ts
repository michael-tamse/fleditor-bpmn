import { CheckboxEntry, Group, isCheckboxEntryEdited, TextFieldEntry, isTextFieldEntryEdited, TextAreaEntry, isTextAreaEntryEdited, ListGroup, ListEntry, SelectEntry, isSelectEntryEdited } from '@bpmn-io/properties-panel';
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

function isSendTask(element: BPMNElement): boolean {
  return /SendTask$/.test(getType(element));
}

function isReceiveTask(element: BPMNElement): boolean {
  return /ReceiveTask$/.test(getType(element));
}

function isIntermediateCatchEvent(element: BPMNElement): boolean {
  return /IntermediateCatchEvent$/.test(getType(element));
}

function isBoundaryEvent(element: BPMNElement): boolean {
  return /BoundaryEvent$/.test(getType(element));
}

function isMessageBoundaryEvent(element: BPMNElement): boolean {
  if (!isBoundaryEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:MessageEventDefinition');
}

function isCallActivity(element: BPMNElement): boolean {
  return /CallActivity$/.test(getType(element));
}

function isStartEvent(element: BPMNElement): boolean {
  return /StartEvent$/.test(getType(element));
}

// Hilfsfunktion: Prüft, ob ein IntermediateCatchEvent eine TimerEventDefinition besitzt
function isTimerIntermediateCatchEvent(element: BPMNElement): boolean {
  if (!isIntermediateCatchEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
}

function isTimerBoundaryEvent(element: BPMNElement): boolean {
  if (!isBoundaryEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
}

function isErrorBoundaryEvent(element: BPMNElement): boolean {
  if (!isBoundaryEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:ErrorEventDefinition');
}

function isErrorStartEvent(element: BPMNElement): boolean {
  if (!isStartEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:ErrorEventDefinition');
}

function getErrorEventDefinition(element: BPMNElement): any | null {
  if (!element) return null;
  const bo = element.businessObject;
  const eventDefinitions = (bo && bo.eventDefinitions) || [];
  return eventDefinitions.find((ed: any) => ed && ed.$type === 'bpmn:ErrorEventDefinition') || null;
}

function getDefinitions(bo: any): any | null {
  let cur = bo;
  while (cur && cur.$parent) {
    if (cur.$type === 'bpmn:Definitions') return cur;
    cur = cur.$parent;
  }
  return null;
}

function isSequenceFlow(element: BPMNElement): boolean {
  return /SequenceFlow$/.test(getType(element));
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

// Service Task: Implementation type selector and value entry (Delegate Expression vs External Topic)
type ServiceImplType = 'delegate' | 'external';

function getServiceImplType(bo: any): ServiceImplType {
  const isExternal = (bo.get ? bo.get('flowable:type') : bo['flowable:type']) === 'external-worker'
    || !!(bo.get ? bo.get('flowable:topic') : bo['flowable:topic']);
  return isExternal ? 'external' : 'delegate';
}

function ServiceImplementationTypeEntry(props: { element: BPMNElement }) {
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
        // switching to external: clear delegateExpression
        'flowable:delegateExpression': undefined,
        // also remove async flags from XML
        'flowable:async': undefined,
        'flowable:asyncLeave': undefined,
        'flowable:asyncLeaveExclusive': undefined
      };
      modeling.updateProperties(element, updates);
    } else {
      const updates: any = {
        'flowable:type': undefined,
        // switching to delegate: clear topic
        'flowable:topic': undefined
      };
      modeling.updateProperties(element, updates);
    }
  };
  const getOptions = () => ([
    { label: translate ? translate('Delegate Expression') : 'Delegate Expression', value: 'delegate' },
    { label: translate ? translate('External') : 'External', value: 'external' }
  ]);
  return SelectEntry({ id: 'flowable-service-impl', element, label: translate ? translate('Implementation') : 'Implementation', getValue, setValue, getOptions });
}

function ServiceImplementationValueEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;

  const getValue = () => {
    const type = getServiceImplType(bo);
    if (type === 'external') return (bo.get ? bo.get('flowable:topic') : bo['flowable:topic']) || '';
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

  return TextFieldEntry({ id: 'flowable-service-impl-value', element, label, getValue, setValue, debounce });
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

// CallActivity: Complete asynchronously
function CompleteAsyncEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:completeAsync') : (bo as any)['flowable:completeAsync']);
  const setValue = (value: boolean) => modeling.updateProperties(element, { 'flowable:completeAsync': !!value });
  return CheckboxEntry({ id: 'flowable-completeAsync', element, label: translate ? translate('Complete asynchronously') : 'Complete asynchronously', getValue, setValue });
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

// ------------- Call Activity In/Out mappings helpers -------------

function getExtensionElements(bo: any) {
  return (bo && (bo.get ? bo.get('extensionElements') : bo.extensionElements)) || null;
}

function getFlowableMappings(bo: any, which: 'In' | 'Out') {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  const type = `flowable:${which}`;
  const typeLower = `flowable:${String(which).toLowerCase()}`;
  return values.filter((v: any) => {
    const t = v && v.$type;
    return t === type || t === typeLower;
  });
}

// ------------- SendTask: Event Type + Outbound Event Mappings -------------

function getEventTypeElement(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((v: any) => v && /flowable:(eventType)$/i.test(String(v.$type || '')));
}

function EventTypeEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => {
    const et = getEventTypeElement(bo);
    if (!et) return '';
    const v = (et.get ? (et.get('value') ?? et.get('text')) : (et.value ?? et.text));
    return v || '';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim();
    let et = getEventTypeElement(bo);
    if (!v) {
      if (et) {
        // remove element from extensionElements
        const ext = getExtensionElements(bo);
        if (!ext) return;
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const newValues = values.filter((x: any) => x !== et);
        modeling.updateModdleProperties(element, ext, { values: newValues });
      }
      return;
    }
    if (!et) {
      const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      et = bpmnFactory.create('flowable:EventType', { value: v });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ et ]) });
    } else {
      modeling.updateModdleProperties(element, et, { value: v });
    }
    // If this is a StartEvent, ensure a default correlation parameter exists when setting event type
    try {
      if (isStartEvent(element)) {
        const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const hasCorr = values.some((x: any) => String(x && x.$type) === 'flowable:EventCorrelationParameter');
        if (!hasCorr) {
          const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
            name: 'businessKey',
            value: '${execution.getProcessInstanceBusinessKey()}'
          });
          modeling.updateModdleProperties(element, ext, { values: values.concat([ corr ]) });
        }
      }
    } catch {}
  };
  return TextFieldEntry({ id: 'flowable-eventType', element, label: translate ? translate('Event key (type)') : 'Event key (type)', getValue, setValue, debounce });
}

function getSendSynchronouslyElement(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((v: any) => v && /flowable:(sendSynchronously)$/i.test(String(v.$type || '')));
}

function SendSynchronouslyEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => {
    const node = getSendSynchronouslyElement(bo);
    if (!node) return false;
    const v = (node.get ? (node.get('value') ?? node.get('text')) : (node.value ?? node.text));
    return String(v || '').trim().toLowerCase() === 'true';
  };
  const setValue = (checked: boolean) => {
    let node = getSendSynchronouslyElement(bo);
    if (!checked) {
      if (node) {
        const ext = getExtensionElements(bo);
        if (!ext) return;
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const newValues = values.filter((x: any) => x !== node);
        modeling.updateModdleProperties(element, ext, { values: newValues });
      }
      return;
    }
    // checked: ensure element exists with value true
    const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
    const values = (ext.get ? ext.get('values') : ext.values) || [];
    if (!node) {
      node = bpmnFactory.create('flowable:SendSynchronously', { value: 'true' });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ node ]) });
    } else {
      modeling.updateModdleProperties(element, node, { value: 'true' });
    }
  };
  return CheckboxEntry({ id: 'flowable-sendSynchronously', element, label: translate ? translate('Send synchronously') : 'Send synchronously', getValue, setValue });
}

function getEventInParameters(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.filter((v: any) => v && /flowable:(eventInParameter)$/i.test(String(v.$type || '')));
}

function addEventInParameter(element: any, bo: any, bpmnFactory: any, modeling: any) {
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const existing = getEventInParameters(bo);
  const isFirst = !existing || existing.length === 0;
  const defaults = isFirst
    ? { source: '${execution.getProcessInstanceBusinessKey()}', target: 'businessKey' }
    : {};
  const param = bpmnFactory.create('flowable:EventInParameter', defaults);
  modeling.updateModdleProperties(element, ext, { values: values.concat([ param ]) });
}

function removeEventInParameter(element: any, param: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((v: any) => v !== param);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function EventInParamSourceEntry(props: { element: BPMNElement, param: any, id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('source') : param.source) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { source: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Map from') : 'Map from', getValue, setValue, debounce });
}

function EventInParamTargetEntry(props: { element: BPMNElement, param: any, id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('target') : param.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { target: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('To event payload') : 'To event payload', getValue, setValue, debounce });
}

function OutboundEventMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const params = getEventInParameters(bo);
  const items = params.map((p: any, idx: number) => {
    const lbl = (p.get ? (p.get('target') || p.get('source')) : (p.target || p.source)) || '';
    const entries = [
      { id: `flowable-eventIn-${idx}-source`, element, param: p, component: EventInParamSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-eventIn-${idx}-target`, element, param: p, component: EventInParamTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeEventInParameter(element, p, modeling);
    return { id: `flowable-eventIn-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-eventIn-${idx}-source` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addEventInParameter(element, bo, bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Outbound event mapping') : 'Outbound event mapping'),
    element,
    items,
    add,
    shouldSort: false
  });
}

function createOutboundEventMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-outbound-event-mapping',
    component: OutboundEventMappingGroupComponent
  } as any;
}

// ReceiveTask: Correlation parameter (single instance)
function getEventCorrelationParameter(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.find((v: any) => v && /flowable:(eventCorrelationParameter)$/i.test(String(v.$type || '')));
}

function EventCorrelationParamNameEntry(props: { element: BPMNElement, id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;
  const getValue = () => {
    const p = getEventCorrelationParameter(bo);
    return (p && (p.get ? p.get('name') : p.name)) || 'businessKey';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim();
    let p = getEventCorrelationParameter(bo);
    if (!v) {
      if (!p) return;
      const other = (p.get ? p.get('value') : p.value) || '';
      if (!other) {
        // remove whole parameter
        const ext = getExtensionElements(bo);
        if (!ext) return;
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const newValues = values.filter((x: any) => x !== p);
        modeling.updateModdleProperties(element, ext, { values: newValues });
      } else {
        modeling.updateModdleProperties(element, p, { name: undefined });
      }
      return;
    }
    // ensure parameter exists
    const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
    const values = (ext.get ? ext.get('values') : ext.values) || [];
    if (!p) {
      p = bpmnFactory.create('flowable:EventCorrelationParameter', { name: v });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ p ]) });
    } else {
      modeling.updateModdleProperties(element, p, { name: v });
    }
  };
  return TextFieldEntry({ id, element, label: translate ? translate('Value') : 'Value', getValue, setValue, debounce });
}

function EventCorrelationParamValueEntry(props: { element: BPMNElement, id: string }) {
  const { element, id } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;
  const getValue = () => {
    const p = getEventCorrelationParameter(bo);
    return (p && (p.get ? p.get('value') : p.value)) || '${execution.getProcessInstanceBusinessKey()}';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim();
    let p = getEventCorrelationParameter(bo);
    if (!v) {
      if (!p) return;
      const other = (p.get ? p.get('name') : p.name) || '';
      if (!other) {
        const ext = getExtensionElements(bo);
        if (!ext) return;
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const newValues = values.filter((x: any) => x !== p);
        modeling.updateModdleProperties(element, ext, { values: newValues });
      } else {
        modeling.updateModdleProperties(element, p, { value: undefined });
      }
      return;
    }
    const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
    const values = (ext.get ? ext.get('values') : ext.values) || [];
    if (!p) {
      p = bpmnFactory.create('flowable:EventCorrelationParameter', { value: v });
      modeling.updateModdleProperties(element, ext, { values: values.concat([ p ]) });
    } else {
      modeling.updateModdleProperties(element, p, { value: v });
    }
  };
  return TextFieldEntry({ id, element, label: translate ? translate('Parameter') : 'Parameter', getValue, setValue, debounce });
}
function createCorrelationParametersGroup(_element: BPMNElement) {
  return {
    id: 'flowable-correlation-parameters',
    label: 'Correlation parameter',
    entries: [
      { id: 'flowable-eventCorr-name', component: EventCorrelationParamNameEntry, isEdited: isTextFieldEntryEdited },
      { id: 'flowable-eventCorr-value', component: EventCorrelationParamValueEntry, isEdited: isTextFieldEntryEdited }
    ],
    component: Group
  } as any;
}
// ReceiveTask: Inbound mapping (flowable:eventOutParameter)
function getEventOutParameters(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.filter((v: any) => v && /flowable:(eventOutParameter)$/i.test(String(v.$type || '')));
}

function addEventOutParameter(element: any, bo: any, bpmnFactory: any, modeling: any) {
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const param = bpmnFactory.create('flowable:EventOutParameter', {});
  modeling.updateModdleProperties(element, ext, { values: values.concat([ param ]) });
}

function removeEventOutParameter(element: any, param: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((v: any) => v !== param);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function EventOutParamSourceEntry(props: { element: BPMNElement, param: any, id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('source') : param.source) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { source: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Payload from event') : 'Payload from event', getValue, setValue, debounce });
}

function EventOutParamTargetEntry(props: { element: BPMNElement, param: any, id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (param.get ? param.get('target') : param.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, param, { target: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Map to') : 'Map to', getValue, setValue, debounce });
}

function EventOutParamTransientEntry(props: { element: BPMNElement, param: any, id: string }) {
  const { element, param, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => !!(param.get ? param.get('transient') : param.transient);
  const setValue = (checked: boolean) => modeling.updateModdleProperties(element, param, { transient: !!checked });
  return CheckboxEntry({ id, element, label: translate ? translate('Transient') : 'Transient', getValue, setValue });
}

function InboundEventMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const params = getEventOutParameters(bo);
  const items = params.map((p: any, idx: number) => {
    const lbl = (p.get ? (p.get('target') || p.get('source')) : (p.target || p.source)) || '';
    const entries = [
      { id: `flowable-eventOut-${idx}-source`, element, param: p, component: EventOutParamSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-eventOut-${idx}-target`, element, param: p, component: EventOutParamTargetEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-eventOut-${idx}-transient`, element, param: p, component: EventOutParamTransientEntry, isEdited: isCheckboxEntryEdited }
    ];
    const remove = () => removeEventOutParameter(element, p, modeling);
    return { id: `flowable-eventOut-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-eventOut-${idx}-source` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addEventOutParameter(element, bo, bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Inbound event mapping') : 'Inbound event mapping'),
    element,
    items,
    add,
    shouldSort: false
  });
}

function createInboundEventMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-inbound-event-mapping',
    component: InboundEventMappingGroupComponent
  } as any;
}

// Error Boundary: Flowable error variable fields
function ErrorVariableNameEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => (bo.get ? bo.get('flowable:errorVariableName') : (bo as any)['flowable:errorVariableName']) || '';
  const setValue = (value: string) => modeling.updateProperties(element, { 'flowable:errorVariableName': (value || '').trim() || undefined });
  return TextFieldEntry({ id: 'flowable-errorVariableName', element, label: translate ? translate('Error variable name') : 'Error variable name', getValue, setValue, debounce });
}

function ErrorVariableTransientEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:errorVariableTransient') : (bo as any)['flowable:errorVariableTransient']);
  const setValue = (val: boolean) => modeling.updateProperties(element, { 'flowable:errorVariableTransient': !!val });
  return CheckboxEntry({ id: 'flowable-errorVariableTransient', element, label: translate ? translate('Error variable transient') : 'Error variable transient', getValue, setValue });
}

function ErrorVariableLocalScopeEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:errorVariableLocalScope') : (bo as any)['flowable:errorVariableLocalScope']);
  const setValue = (val: boolean) => modeling.updateProperties(element, { 'flowable:errorVariableLocalScope': !!val });
  return CheckboxEntry({ id: 'flowable-errorVariableLocalScope', element, label: translate ? translate('Error variable local scope') : 'Error variable local scope', getValue, setValue });
}

function createErrorVariablesGroup(_element: BPMNElement) {
  return {
    id: 'flowable-error-variables',
    label: 'Error variables',
    entries: [
      { id: 'flowable-errorVariableName', component: ErrorVariableNameEntry, isEdited: isTextFieldEntryEdited },
      { id: 'flowable-errorVariableTransient', component: ErrorVariableTransientEntry, isEdited: isCheckboxEntryEdited },
      { id: 'flowable-errorVariableLocalScope', component: ErrorVariableLocalScopeEntry, isEdited: isCheckboxEntryEdited }
    ],
    component: Group
  } as any;
}

// --- Error Boundary: entries bound to ErrorEventDefinition ---
function ErrorDef_VariableNameEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const ed = getErrorEventDefinition(element);
  const getValue = () => (ed && (ed.get ? ed.get('flowable:errorVariableName') : (ed as any)['flowable:errorVariableName'])) || '';
  const setValue = (value: string) => { if (ed) modeling.updateModdleProperties(element, ed, { 'flowable:errorVariableName': (value || '').trim() || undefined }); };
  return TextFieldEntry({ id: 'flowable-errorDef-errorVariableName', element, label: translate ? translate('Error variable name') : 'Error variable name', getValue, setValue, debounce });
}

function ErrorDef_VariableTransientEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const ed = getErrorEventDefinition(element);
  const getValue = () => !!(ed && (ed.get ? ed.get('flowable:errorVariableTransient') : (ed as any)['flowable:errorVariableTransient']));
  const setValue = (val: boolean) => { if (ed) modeling.updateModdleProperties(element, ed, { 'flowable:errorVariableTransient': !!val }); };
  return CheckboxEntry({ id: 'flowable-errorDef-errorVariableTransient', element, label: translate ? translate('Error variable transient') : 'Error variable transient', getValue, setValue });
}

function ErrorDef_VariableLocalScopeEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const ed = getErrorEventDefinition(element);
  const getValue = () => !!(ed && (ed.get ? ed.get('flowable:errorVariableLocalScope') : (ed as any)['flowable:errorVariableLocalScope']));
  const setValue = (val: boolean) => { if (ed) modeling.updateModdleProperties(element, ed, { 'flowable:errorVariableLocalScope': !!val }); };
  return CheckboxEntry({ id: 'flowable-errorDef-errorVariableLocalScope', element, label: translate ? translate('Error variable local scope') : 'Error variable local scope', getValue, setValue });
}

// Fallback Error code editor if default entry not available; binds to ErrorEventDefinition.errorRef
function ErrorCodeEntry(props: { element: BPMNElement }) {
  const { element } = props;
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const ed = getErrorEventDefinition(element);
  const bo = element.businessObject;
  const getValue = () => {
    const ref = ed && (ed.get ? ed.get('errorRef') : (ed as any).errorRef);
    const code = ref && (ref.get ? ref.get('errorCode') : (ref as any).errorCode);
    return code || '';
  };
  const setValue = (value: string) => {
    if (!ed) return;
    const v = (value || '').trim();
    const ref = ed.get ? ed.get('errorRef') : (ed as any).errorRef;
    if (!v) {
      // Clear reference but do not create/delete errors here
      modeling.updateModdleProperties(element, ed, { errorRef: undefined });
      return;
    }
    if (ref) {
      // Update existing referenced Error's code and name; avoid creating new <error> per keystroke
      const currentCode = ref.get ? ref.get('errorCode') : (ref as any).errorCode;
      if (currentCode !== v) {
        modeling.updateModdleProperties(element, ref, { errorCode: v, name: v });
      }
      return;
    }
    // No current reference: try to reuse existing Error by code, else create once
    const defs = getDefinitions(bo);
    const rootEls = (defs && (defs.get ? defs.get('rootElements') : defs.rootElements)) || [];
    let target = rootEls.find((re: any) => re && re.$type === 'bpmn:Error' && ((re.get ? re.get('errorCode') : re.errorCode) === v));
    if (!target) {
      target = bpmnFactory.create('bpmn:Error', { id: 'Error_' + Math.random().toString(36).slice(2, 10), name: v, errorCode: v });
      if (defs) {
        modeling.updateModdleProperties(element, defs, { rootElements: rootEls.concat([ target ]) });
      }
    }
    modeling.updateModdleProperties(element, ed, { errorRef: target });
  };
  return TextFieldEntry({ id: 'bpmn-error-code', element, label: translate ? translate('Error code') : 'Error code', getValue, setValue, debounce });
}

// --- Error mapping group (flowable:in list on BoundaryEvent) ---
function getFlowableIns(bo: any) {
  return getFlowableMappings(bo, 'In');
}

function addFlowableIn(element: any, bpmnFactory: any, modeling: any) {
  const bo = element.businessObject;
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const mapping = bpmnFactory.create('flowable:In', { source: 'errorCode' });
  const newValues = values.concat([ mapping ]);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function removeFlowableIn(element: any, mapping: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((v: any) => v !== mapping);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function ErrorInSourceEntry(props: { element: BPMNElement, mapping: any, id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => (mapping.get ? mapping.get('source') : mapping.source) || '';
  const setValue = (val: 'errorCode' | 'errorMessage' | 'error') => modeling.updateModdleProperties(element, mapping, { source: val });
  const getOptions = () => ([
    { label: translate ? translate('Error code') : 'Error code', value: 'errorCode' },
    { label: translate ? translate('Error message') : 'Error message', value: 'errorMessage' },
    { label: translate ? translate('BPMN Error') : 'BPMN Error', value: 'error' }
  ]);
  return SelectEntry({ element, id, label: translate ? translate('Source') : 'Source', getValue, setValue, getOptions });
}

function ErrorInTargetEntry(props: { element: BPMNElement, mapping: any, id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (mapping.get ? mapping.get('target') : mapping.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, mapping, { target: (value || '').trim() || undefined });
  return TextFieldEntry({ id, element, label: translate ? translate('Target variable') : 'Target variable', getValue, setValue, debounce });
}

function ErrorInTransientEntry(props: { element: BPMNElement, mapping: any, id: string }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => !!(mapping.get ? mapping.get('transient') : (mapping as any).transient);
  const setValue = (val: boolean) => modeling.updateModdleProperties(element, mapping, { transient: !!val });
  return CheckboxEntry({ id, element, label: translate ? translate('Transient') : 'Transient', getValue, setValue });
}

function ErrorMappingGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const items = getFlowableIns(bo).map((m: any, idx: number) => {
    const lbl = (m.get ? (m.get('target') || m.get('source')) : (m.target || m.source)) || '';
    const entries = [
      { id: `flowable-error-in-${idx}-source`, mapping: m, component: ErrorInSourceEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-error-in-${idx}-target`, mapping: m, component: ErrorInTargetEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-error-in-${idx}-transient`, mapping: m, component: ErrorInTransientEntry, isEdited: isCheckboxEntryEdited }
    ];
    const remove = () => removeFlowableIn(element, m, modeling);
    return { id: `flowable-error-in-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-error-in-${idx}-source` };
  });
  const add = (e?: any) => { try { e && e.stopPropagation && e.stopPropagation(); } catch {} addFlowableIn(element, bpmnFactory, modeling); };
  return h(ListGroup as any, { id, label: label || (translate ? translate('Error mapping') : 'Error mapping'), element, items, add, shouldSort: false });
}

function createErrorMappingGroup(_element: BPMNElement) {
  return {
    id: 'flowable-error-mapping',
    label: 'Error mapping',
    component: ErrorMappingGroupComponent
  } as any;
}
// ------------- Variable Aggregations helpers -------------

function getFlowableVariableAggregations(bo: any) {
  if (!bo) return [];
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.filter((v: any) => {
    const t = v && v.$type;
    return t === 'flowable:VariableAggregation' || t === 'flowable:variableAggregation';
  });
}

function addVariableAggregation(element: any, loopBo: any, bpmnFactory: any, modeling: any) {
  if (!loopBo) return;
  const ext = ensureExtensionElements(element, loopBo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const agg = bpmnFactory.create('flowable:VariableAggregation', {});
  const newValues = values.concat([ agg ]);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function removeVariableAggregation(element: any, loopBo: any, agg: any, modeling: any) {
  if (!loopBo) return;
  const ext = getExtensionElements(loopBo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((v: any) => v !== agg);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function getAggregationDefinitions(agg: any) {
  if (!agg) return [];
  return (agg.get ? agg.get('definitions') : agg.definitions) || [];
}

function addAggregationDefinition(element: any, agg: any, bpmnFactory: any, modeling: any) {
  const defs = getAggregationDefinitions(agg);
  // Create typed flowable:Variable for robust moddle updates; we convert to <variable> on export
  const def: any = bpmnFactory.create('flowable:Variable', {});
  const newDefs = defs.concat([ def ]);
  modeling.updateModdleProperties(element, agg, { definitions: newDefs });
}

function removeAggregationDefinition(element: any, agg: any, def: any, modeling: any) {
  if (!agg) return;
  const defs = (agg.get ? agg.get('definitions') : agg.definitions) || [];
  const newDefs = defs.filter((d: any) => d !== def);
  modeling.updateModdleProperties(element, agg, { definitions: newDefs });
}

function ensureExtensionElements(element: any, bo: any, bpmnFactory: any, modeling: any) {
  let ext = getExtensionElements(bo);
  if (!ext) {
    ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
    modeling.updateModdleProperties(element, bo, { extensionElements: ext });
  }
  return ext;
}

function addFlowableMapping(element: any, which: 'In' | 'Out', bpmnFactory: any, modeling: any) {
  const bo = element.businessObject;
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const mapping = bpmnFactory.create(`flowable:${which}`, {});
  const newValues = values.concat([ mapping ]);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function removeFlowableMapping(element: any, mapping: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((v: any) => v !== mapping);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function getMappingType(mapping: any): 'source' | 'sourceExpression' {
  // Prefer explicit UI hint if present (not serialized)
  const uiType = (mapping as any).__flowableType;
  if (uiType === 'source' || uiType === 'sourceExpression') return uiType;
  // Detect by attribute presence (not truthiness)
  const has = (name: string) => {
    const get = (mapping.get ? mapping.get(name) : (mapping as any)[name]);
    return typeof get !== 'undefined';
  };
  if (has('sourceExpression') && !has('source')) return 'sourceExpression';
  return 'source';
}

function InOutMappingTypeEntry(props: { element: BPMNElement, id: string, mapping: any }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = () => getMappingType(mapping);
  const setValue = (val: 'source' | 'sourceExpression') => {
    // remember selection locally to keep the dropdown stable even if field empty
    (mapping as any).__flowableType = val;
    if (val === 'source') {
      modeling.updateModdleProperties(element, mapping, { sourceExpression: undefined });
    } else {
      modeling.updateModdleProperties(element, mapping, { source: undefined });
    }
  };
  const getOptions = () => ([
    { label: translate ? translate('Source') : 'Source', value: 'source' },
    { label: translate ? translate('Source expression') : 'Source expression', value: 'sourceExpression' }
  ]);
  return SelectEntry({ element, id, label: translate ? translate('Type') : 'Type', getValue, setValue, getOptions });
}

function InOutMappingSourceEntry(props: { element: BPMNElement, id: string, mapping: any }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => {
    const type = getMappingType(mapping);
    if (type === 'source') return (mapping.get ? mapping.get('source') : mapping.source) || '';
    return (mapping.get ? mapping.get('sourceExpression') : mapping.sourceExpression) || '';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim() || undefined;
    const type = getMappingType(mapping);
    if (type === 'source') modeling.updateModdleProperties(element, mapping, { source: v });
    else modeling.updateModdleProperties(element, mapping, { sourceExpression: v });
  };
  const label = getMappingType(mapping) === 'source'
    ? (translate ? translate('Source') : 'Source')
    : (translate ? translate('Source expression') : 'Source expression');
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

function InOutMappingTargetEntry(props: { element: BPMNElement, id: string, mapping: any }) {
  const { element, mapping, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (mapping.get ? mapping.get('target') : mapping.target) || '';
  const setValue = (value: string) => {
    modeling.updateModdleProperties(element, mapping, { target: (value || '').trim() || undefined });
  };
  return TextFieldEntry({ id, element, label: translate ? translate('Target') : 'Target', getValue, setValue, debounce });
}

// Variable Aggregations UI
function VariableAggregationTargetEntry(props: { element: BPMNElement, aggregation: any, id: string }) {
  const { element, aggregation, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (aggregation.get ? aggregation.get('target') : aggregation.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, aggregation, { target: (value || '').trim() || undefined });
  const label = translate ? translate('Target (Variable / Expression)') : 'Target (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

type VarAggCreationMode = 'default' | 'overview' | 'transient';

function VariableAggregationCreationModeEntry(props: { element: BPMNElement, aggregation: any, id: string }) {
  const { element, aggregation, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const getValue = (): VarAggCreationMode => {
    const overview = !!(aggregation.get ? aggregation.get('createOverviewVariable') : aggregation.createOverviewVariable);
    const transient = !!(aggregation.get ? aggregation.get('storeAsTransientVariable') : aggregation.storeAsTransientVariable);
    if (overview) return 'overview';
    if (transient) return 'transient';
    return 'default';
  };
  const setValue = (val: VarAggCreationMode) => {
    const updates: any = {
      createOverviewVariable: undefined,
      storeAsTransientVariable: undefined
    };
    if (val === 'overview') updates.createOverviewVariable = true;
    if (val === 'transient') updates.storeAsTransientVariable = true;
    modeling.updateModdleProperties(element, aggregation, updates);
  };
  const getOptions = () => ([
    { label: translate ? translate('Default') : 'Default', value: 'default' },
    { label: translate ? translate('Create overview variable') : 'Create overview variable', value: 'overview' },
    { label: translate ? translate('Store as transient variable') : 'Store as transient variable', value: 'transient' }
  ]);
  const label = translate ? translate('Target variable creation') : 'Target variable creation';
  return SelectEntry({ element, id, label, getValue, setValue, getOptions });
}

function AggregationDefinitionSourceEntry(props: { element: BPMNElement, aggregation: any, def: any, id: string }) {
  const { element, aggregation, def, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => {
    if (def && typeof def.get === 'function') {
      const v = def.get('source') ?? def.get('variableSource');
      return v || '';
    }
    const a = (def && def.$attrs) || {};
    return a.source ?? def?.source ?? def?.variableSource ?? '';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim() || undefined;
    if (def && typeof def.get === 'function') {
      modeling.updateModdleProperties(element, def, { source: v, variableSource: undefined });
    } else {
      const attrs = { ...(def.$attrs || {}) };
      if (typeof v === 'undefined') delete attrs.source; else attrs.source = v;
      if ('variableSource' in attrs) delete (attrs as any).variableSource;
      modeling.updateModdleProperties(element, def, { $attrs: attrs });
    }
  };
  const label = translate ? translate('Source (Variable / Expression)') : 'Source (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

function AggregationDefinitionTargetEntry(props: { element: BPMNElement, aggregation: any, def: any, id: string }) {
  const { element, aggregation, def, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => {
    if (def && typeof def.get === 'function') {
      const v = def.get('target') ?? def.get('variableTarget');
      return v || '';
    }
    const a = (def && def.$attrs) || {};
    return a.target ?? def?.target ?? def?.variableTarget ?? '';
  };
  const setValue = (value: string) => {
    const v = (value || '').trim() || undefined;
    if (def && typeof def.get === 'function') {
      modeling.updateModdleProperties(element, def, { target: v, variableTarget: undefined });
    } else {
      const attrs = { ...(def.$attrs || {}) };
      if (typeof v === 'undefined') delete attrs.target; else attrs.target = v;
      if ('variableTarget' in attrs) delete (attrs as any).variableTarget;
      modeling.updateModdleProperties(element, def, { $attrs: attrs });
    }
  };
  const label = translate ? translate('Target (Variable / Expression)') : 'Target (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

function AggregationDefinitionsListEntry(props: { element: BPMNElement, aggregation: any, id: string, label?: string }) {
  const { element, aggregation, id } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const defs = getAggregationDefinitions(aggregation);
  const items = defs.map((d: any, idx: number) => {
    const entries = [
      { id: `${id}-${idx}-source`, element, aggregation, def: d, component: AggregationDefinitionSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `${id}-${idx}-target`, element, aggregation, def: d, component: AggregationDefinitionTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    let label = '';
    if (d && typeof d.get === 'function') {
      label = d.get('target') || d.get('source') || d.get('variableTarget') || d.get('variableSource') || '';
    } else {
      const a = (d && d.$attrs) || {};
      label = a.target || a.source || d?.target || d?.source || d?.variableTarget || d?.variableSource || '';
    }
    const remove = () => removeAggregationDefinition(element, aggregation, d, modeling);
    return { id: `${id}-item-${idx}`, label, entries, remove, autoFocusEntry: `${id}-${idx}-source` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addAggregationDefinition(element, aggregation, bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id,
    label: translate ? translate('Definitions') : 'Definitions',
    element,
    items,
    add,
    shouldSort: false
  });
}

function VariableAggregationsGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const loop = bo && bo.loopCharacteristics;
  // Prefer variableAggregations on the loopCharacteristics; fallback to element-level (legacy)
  const primaryAggs = getFlowableVariableAggregations(loop);
  const legacyAggs = getFlowableVariableAggregations(bo);
  const aggs = (primaryAggs && primaryAggs.length ? primaryAggs : legacyAggs) || [];
  const items = aggs.map((a: any, idx: number) => {
    const lbl = (a.get ? a.get('target') : a.target) || (translate ? translate('Variable aggregation') : 'Variable aggregation');
    const entries = [
      { id: `flowable-varAgg-${idx}-target`, element, aggregation: a, component: VariableAggregationTargetEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-varAgg-${idx}-mode`, element, aggregation: a, component: VariableAggregationCreationModeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-varAgg-${idx}-defs`, element, aggregation: a, component: AggregationDefinitionsListEntry }
    ];
    const remove = () => removeVariableAggregation(element, loop || bo, a, modeling);
    return { id: `flowable-varAgg-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-varAgg-${idx}-target` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addVariableAggregation(element, loop || bo, bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id: id,
    label: label || (translate ? translate('Variable aggregations') : 'Variable aggregations'),
    element,
    items,
    add,
    shouldSort: false
  });
}

function createVariableAggregationsGroup(_element: BPMNElement) {
  return {
    id: 'flowable-variable-aggregations',
    component: VariableAggregationsGroupComponent
  } as any;
}

function InMappingsGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const ins = getFlowableMappings(bo, 'In');
  const items = ins.map((m: any, idx: number) => {
    const lbl = (m.get ? m.get('target') : m.target) || '';
    const entries = [
      { id: `flowable-in-${idx}-type`, mapping: m, component: InOutMappingTypeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-in-${idx}-source`, mapping: m, component: InOutMappingSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-in-${idx}-target`, mapping: m, component: InOutMappingTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeFlowableMapping(element, m, modeling);
    return { id: `flowable-in-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-in-${idx}-source` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addFlowableMapping(element, 'In', bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id: id,
    label: label || (translate ? translate('In mappings') : 'In mappings'),
    element,
    items,
    add,
    shouldSort: false
  });
}

// Out mappings as a ListGroup (only the list of mappings)
function OutMappingsGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const outs = getFlowableMappings(bo, 'Out');
  const items = outs.map((m: any, idx: number) => {
    const lbl = (m.get ? m.get('target') : m.target) || '';
    const entries = [
      { id: `flowable-out-${idx}-type`, mapping: m, component: InOutMappingTypeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-out-${idx}-source`, mapping: m, component: InOutMappingSourceEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-out-${idx}-target`, mapping: m, component: InOutMappingTargetEntry, isEdited: isTextFieldEntryEdited }
    ];
    const remove = () => removeFlowableMapping(element, m, modeling);
    return { id: `flowable-out-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-out-${idx}-source` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addFlowableMapping(element, 'Out', bpmnFactory, modeling);
  };
  return h(ListGroup as any, {
    id: id,
    label: label || (translate ? translate('Out mappings') : 'Out mappings'),
    element,
    items,
    add,
    shouldSort: false
  });
}

function createInMappingsGroup(_element: BPMNElement) {
  return {
    id: 'flowable-in-mappings',
    label: 'In mappings',
    component: InMappingsGroupComponent
  };
}

function createOutMappingsGroup(_element: BPMNElement) {
  return {
    id: 'flowable-out-mappings',
    label: 'Out mappings',
    component: OutMappingsGroupComponent
  };
}

// Out mappings: global option checkbox
function UseLocalScopeForOutParametersEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => !!(bo.get ? bo.get('flowable:useLocalScopeForOutParameters') : (bo as any)['flowable:useLocalScopeForOutParameters']);
  const setValue = (value: boolean) => {
    modeling.updateProperties(element, { 'flowable:useLocalScopeForOutParameters': !!value });
  };
  return CheckboxEntry({ id: 'flowable-useLocalScopeForOutParameters', element, label: translate ? translate('Use local scope for out mapping') : 'Use local scope for out mapping', getValue, setValue });
}

// Non-collapsible, headerless group below Out mappings
function OutMappingsOptionsComponent(props: any) {
  const { element, id } = props;
  return h('div', {
    className: 'bio-properties-panel-group',
    'data-group-id': 'group-' + id
  } as any, [
    h('div', { className: 'bio-properties-panel-group-entries open' } as any, [
      h(UseLocalScopeForOutParametersEntry as any, { element })
    ])
  ]);
}

function createOutMappingsOptionsGroup(_element: BPMNElement) {
  return {
    id: 'flowable-out-mapping-options',
    component: OutMappingsOptionsComponent
  } as any;
}

// CallActivity: Process reference (calledElement)
function CalledElementEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => (bo && (bo.get ? bo.get('calledElement') : bo.calledElement)) || '';
  const setValue = (value: string) => {
    const updates: any = {
      calledElement: (value || '').trim() || undefined,
      'flowable:sameDeployment': true,
      'flowable:fallbackToDefaultTenant': true
    };
    modeling.updateProperties(element, updates);
  };
  return TextFieldEntry({ id: 'bpmn-calledElement', element, label: translate ? translate('Process reference') : 'Process reference', getValue, setValue, debounce });
}

// CallActivity: Flowable business key
function BusinessKeyEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => (bo.get && bo.get('flowable:businessKey')) || '';
  const setValue = (value: string) => {
    const updates: any = {
      'flowable:businessKey': (value || '').trim() || undefined,
      'flowable:sameDeployment': true,
      'flowable:fallbackToDefaultTenant': true
    };
    // If an explicit businessKey is provided, do not inherit the business key
    if ((value || '').trim()) {
      updates['flowable:inheritBusinessKey'] = false;
    }
    modeling.updateProperties(element, updates);
  };
  return TextFieldEntry({ id: 'flowable-businessKey', element, label: translate ? translate('Business key') : 'Business key', getValue, setValue, debounce });
}

// CallActivity: Inherit business key (maps to flowable:inheritBusinessKey)
function InheritBusinessKeyEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const translate = useService('translate');
  const element = props.element;
  const bo = element.businessObject;
  const getValue = () => {
    const v = bo && (bo.get ? bo.get('flowable:inheritBusinessKey') : (bo as any)['flowable:inheritBusinessKey']);
    if (typeof v === 'boolean') return v;
    // Default: if explicit businessKey is set, do NOT inherit; otherwise default to true
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

// CallActivity: Inherit variables (maps to flowable:inheritVariables)
function InheritVariablesEntry(props: { element: BPMNElement }) {
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

// Sequence Flow: Condition Expression (stores bpmn:FormalExpression on sequenceFlow.conditionExpression)
function ConditionExpressionEntry(props: { element: BPMNElement }) {
  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const element = props.element;
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
    const bo = element && element.businessObject;
    const isExternalService = isServiceTask(element) && getServiceImplType(bo) === 'external';
    // Desired order when not external:
    // Asynchronous, Exclusive, Leave asynchronously, Leave exclusive
    const entries: any[] = [];
    if (!isExternalService) {
      entries.push({ id: 'flowable-async', component: AsyncEntry, isEdited: isCheckboxEntryEdited });
      if (!isStartOrEndEvent(element)) {
        entries.push({ id: 'flowable-exclusive', component: ExclusiveEntry, isEdited: isCheckboxEntryEdited });
      }
      entries.push({ id: 'flowable-asyncLeave', component: AsyncLeaveEntry, isEdited: isCheckboxEntryEdited });
      if (!isStartOrEndEvent(element)) {
        entries.push({ id: 'flowable-asyncLeaveExclusive', component: ExclusiveLeaveEntry, isEdited: isCheckboxEntryEdited });
      }
      // Spacer between async/exclusive markers and generic flags
      entries.push({ id: 'execution-spacer-1', component: SpacerEntry });
    }
    // Always show Is for compensation
    entries.push({ id: 'bpmn-isForCompensation', component: IsForCompensationEntry, isEdited: isCheckboxEntryEdited });
    // CallActivity-specific: Complete asynchronously (completion on called instance)
    if (isCallActivity(element)) {
      entries.push({ id: 'flowable-completeAsync', component: CompleteAsyncEntry, isEdited: isCheckboxEntryEdited });
    }
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
      // Helper: ensure a visual separator in General after ID if extra fields exist
      const ensureGeneralSeparator = () => {
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (!(general && Array.isArray(general.entries))) return;
        const hasSeparator = general.entries.some((e: any) => e && e.id === 'general-spacer-1');
        if (hasSeparator) return;
        // Detect if there are entries besides name and id
        const hasExtra = general.entries.some((e: any) => {
          const id = e && e.id;
          return id && id !== 'name' && id !== 'id';
        });
        if (!hasExtra) return;
        // Insert separator just after the ID field if present, else after Name
        let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
        if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
        if (insertAfterIdx < 0) return;
        general.entries.splice(insertAfterIdx + 1, 0, { id: 'general-spacer-1', component: SpacerEntry });
      };
      // Add Flowable Service Task implementation selector + value field to General
      if (isServiceTask(element)) {
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (general && Array.isArray(general.entries)) {
          const hasType = general.entries.some((e: any) => e && e.id === 'flowable-service-impl');
          const hasValue = general.entries.some((e: any) => e && e.id === 'flowable-service-impl-value');
          let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
          if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
          let offset = 1;
          if (!hasType) {
            const defType = { id: 'flowable-service-impl', component: ServiceImplementationTypeEntry, isEdited: isSelectEntryEdited };
            const idx = insertAfterIdx >= 0 ? (insertAfterIdx + offset) : 0;
            general.entries.splice(idx, 0, defType);
            offset += 1;
          }
          if (!hasValue) {
            const defVal = { id: 'flowable-service-impl-value', component: ServiceImplementationValueEntry, isEdited: isTextFieldEntryEdited };
            const idx = insertAfterIdx >= 0 ? (insertAfterIdx + offset) : 0;
            general.entries.splice(idx, 0, defVal);
          }
        }
      }
      // Add Sequence Flow Condition Expression to General
      if (isSequenceFlow(element)) {
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (general && Array.isArray(general.entries)) {
          const exists = general.entries.some((e: any) => e && e.id === 'bpmn-conditionExpression');
          if (!exists) {
            // Place directly under ID
            let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
            const def = { id: 'bpmn-conditionExpression', component: ConditionExpressionEntry, isEdited: isTextAreaEntryEdited };
            if (insertAfterIdx >= 0) general.entries.splice(insertAfterIdx + 1, 0, def); else general.entries.unshift(def);
          }
        }
      }
      // SendTask customizations
      if (isSendTask(element)) {
        // General: add Event Type under ID (separator handled by ensureGeneralSeparator)
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (general && Array.isArray(general.entries)) {
          const exists = general.entries.some((e: any) => e && e.id === 'flowable-eventType');
          if (!exists) {
            let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
            if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
            const def = { id: 'flowable-eventType', component: EventTypeEntry, isEdited: isTextFieldEntryEdited };
            if (insertAfterIdx >= 0) general.entries.splice(insertAfterIdx + 1, 0, def); else general.entries.unshift(def);
          }
          // Then add Send synchronously checkbox directly after Event Type
          const hasSync = general.entries.some((e: any) => e && e.id === 'flowable-sendSynchronously');
          if (!hasSync) {
            let idxET = general.entries.findIndex((e: any) => e && e.id === 'flowable-eventType');
            if (idxET < 0) idxET = general.entries.findIndex((e: any) => e && e.id === 'id');
            const defSync = { id: 'flowable-sendSynchronously', component: SendSynchronouslyEntry, isEdited: isCheckboxEntryEdited };
            general.entries.splice((idxET >= 0 ? idxET + 1 : general.entries.length), 0, defSync);
          }
        }
        // Group: Outbound event mapping after General
        const existsGroup = groups && groups.some((g) => g && g.id === 'flowable-outbound-event-mapping');
        if (!existsGroup) {
          const group = createOutboundEventMappingGroup(element);
          const idxGen = groups.findIndex((g) => g && g.id === 'general');
          if (idxGen >= 0) groups.splice(idxGen + 1, 0, group); else groups.push(group);
        }
      }
      // ReceiveTask customizations
      if (isReceiveTask(element)) {
        // General: add Event Type under ID
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (general && Array.isArray(general.entries)) {
          const exists = general.entries.some((e: any) => e && e.id === 'flowable-eventType');
          if (!exists) {
            let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
            if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
            const def = { id: 'flowable-eventType', component: EventTypeEntry, isEdited: isTextFieldEntryEdited };
            if (insertAfterIdx >= 0) general.entries.splice(insertAfterIdx + 1, 0, def); else general.entries.unshift(def);
          }
        }
        // Group: Correlation parameter (before Inbound mapping)
        const existsCorr = groups && groups.some((g) => g && g.id === 'flowable-correlation-parameters');
        if (!existsCorr) {
          const corr = createCorrelationParametersGroup(element);
          const idxGen = groups.findIndex((g) => g && g.id === 'general');
          if (idxGen >= 0) groups.splice(idxGen + 1, 0, corr); else groups.push(corr);
        }
        // Group: Inbound event mapping after Correlation parameter (or General if no corr)
        const existsIn = groups && groups.some((g) => g && g.id === 'flowable-inbound-event-mapping');
        if (!existsIn) {
          const inGroup = createInboundEventMappingGroup(element);
          const idxCorr = groups.findIndex((g) => g && g.id === 'flowable-correlation-parameters');
          if (idxCorr >= 0) groups.splice(idxCorr + 1, 0, inGroup);
          else {
            const idxGen = groups.findIndex((g) => g && g.id === 'general');
            if (idxGen >= 0) groups.splice(idxGen + 1, 0, inGroup); else groups.push(inGroup);
          }
        }
      }
      // IntermediateCatchEvent customizations
      if (isIntermediateCatchEvent(element)) {
        if (!isTimerIntermediateCatchEvent(element)) {
          // General: add Event Type under ID
          const general = groups && groups.find((g) => g && g.id === 'general');
          if (general && Array.isArray(general.entries)) {
            const exists = general.entries.some((e: any) => e && e.id === 'flowable-eventType');
            if (!exists) {
              let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
              if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
              const def = { id: 'flowable-eventType', component: EventTypeEntry, isEdited: isTextFieldEntryEdited };
              if (insertAfterIdx >= 0) general.entries.splice(insertAfterIdx + 1, 0, def); else general.entries.unshift(def);
            }
          }
          // Group: Correlation parameter (before Inbound mapping)
          const existsCorr = groups && groups.some((g) => g && g.id === 'flowable-correlation-parameters');
          if (!existsCorr) {
            const corr = createCorrelationParametersGroup(element);
            const idxGen = groups.findIndex((g) => g && g.id === 'general');
            if (idxGen >= 0) groups.splice(idxGen + 1, 0, corr); else groups.push(corr);
          }
          // Group: Inbound event mapping after Correlation parameter (or General if no corr)
          const existsIn = groups && groups.some((g) => g && g.id === 'flowable-inbound-event-mapping');
          if (!existsIn) {
            const inGroup = createInboundEventMappingGroup(element);
            const idxCorr = groups.findIndex((g) => g && g.id === 'flowable-correlation-parameters');
            if (idxCorr >= 0) groups.splice(idxCorr + 1, 0, inGroup);
            else {
              const idxGen = groups.findIndex((g) => g && g.id === 'general');
              if (idxGen >= 0) groups.splice(idxGen + 1, 0, inGroup); else groups.push(inGroup);
            }
          }
        }
      }
      // StartEvent customizations (Message-like; show when Message definition or Flowable event meta present; skip for timers)
      if (isStartEvent(element)) {
        const bo = element.businessObject as any;
        const hasTimer = Array.isArray(bo.eventDefinitions)
          && bo.eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
        // detect Flowable message-style metadata
        const ext = bo && (bo.get ? bo.get('extensionElements') : bo.extensionElements);
        const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
        const hasFlowableMeta = values && values.some((v: any) => {
          const t = String(v && v.$type);
          return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter';
        });
        const hasMessageDef = Array.isArray(bo.eventDefinitions)
          && bo.eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:MessageEventDefinition');
        if (!hasTimer && (hasFlowableMeta || hasMessageDef)) {
          // General: add Event Type under ID
          const general = groups && groups.find((g) => g && g.id === 'general');
          if (general && Array.isArray(general.entries)) {
            const exists = general.entries.some((e: any) => e && e.id === 'flowable-eventType');
            if (!exists) {
              let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
              if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
              const def = { id: 'flowable-eventType', component: EventTypeEntry, isEdited: isTextFieldEntryEdited };
              if (insertAfterIdx >= 0) general.entries.splice(insertAfterIdx + 1, 0, def); else general.entries.unshift(def);
            }
          }
          // Group: Correlation parameter (before Inbound mapping)
          const existsCorr = groups && groups.some((g) => g && g.id === 'flowable-correlation-parameters');
          if (!existsCorr) {
            const corr = createCorrelationParametersGroup(element);
            const idxGen = groups.findIndex((g) => g && g.id === 'general');
            if (idxGen >= 0) groups.splice(idxGen + 1, 0, corr); else groups.push(corr);
          }
          // Group: Inbound event mapping after Correlation parameter (or General if no corr)
          const existsInSE = groups && groups.some((g) => g && g.id === 'flowable-inbound-event-mapping');
          if (!existsInSE) {
            const inGroup = createInboundEventMappingGroup(element);
            const idxCorr = groups.findIndex((g) => g && g.id === 'flowable-correlation-parameters');
            if (idxCorr >= 0) groups.splice(idxCorr + 1, 0, inGroup);
            else {
              const idxGen = groups.findIndex((g) => g && g.id === 'general');
              if (idxGen >= 0) groups.splice(idxGen + 1, 0, inGroup); else groups.push(inGroup);
            }
          }
        }
      }
      // Error StartEvent customizations: treat like Error Boundary (add Error code + error variable fields, and Error mapping)
      if (isStartEvent(element) && isErrorStartEvent(element)) {
        const idxGen = groups.findIndex((g: any) => g && g.id === 'general');
        const general = idxGen >= 0 ? groups[idxGen] : null;
        if (general && Array.isArray(general.entries)) {
          let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
          if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
          let offset = 1;
          // Error code (our stable entry)
          const hasErrCode = general.entries.some((e: any) => e && e.id === 'bpmn-error-code');
          if (!hasErrCode) {
            const def = { id: 'bpmn-error-code', component: ErrorCodeEntry, isEdited: isTextFieldEntryEdited };
            general.entries.splice(Math.max(insertAfterIdx + offset, 0), 0, def);
            offset += 1;
          }
          // Error variables
          const want = [
            { id: 'flowable-errorDef-errorVariableName', component: ErrorDef_VariableNameEntry, isEdited: isTextFieldEntryEdited },
            { id: 'flowable-errorDef-errorVariableTransient', component: ErrorDef_VariableTransientEntry, isEdited: isCheckboxEntryEdited },
            { id: 'flowable-errorDef-errorVariableLocalScope', component: ErrorDef_VariableLocalScopeEntry, isEdited: isCheckboxEntryEdited }
          ];
          want.forEach((w) => {
            const exists = general.entries.some((e: any) => e && e.id === w.id);
            if (!exists) {
              general.entries.splice(Math.max(insertAfterIdx + offset, 0), 0, w);
              offset += 1;
            }
          });
        }
        // Add Error mapping section after General
        const existsMap = groups.some((g: any) => g && g.id === 'flowable-error-mapping');
        if (!existsMap) {
          const mapGroup = createErrorMappingGroup(element);
          const afterGen = (general ? groups.indexOf(general) : groups.findIndex((g: any) => g && g.id === 'general'));
          const insertAt = afterGen >= 0 ? afterGen + 1 : groups.length;
          groups.splice(insertAt, 0, mapGroup);
        }
      }
      // BoundaryEvent customizations: Message vs Error
      if (isBoundaryEvent(element)) {
        // Message Boundary: show EventType, Correlation and Inbound mapping
        if (isMessageBoundaryEvent(element)) {
          const general = groups && groups.find((g) => g && g.id === 'general');
          if (general && Array.isArray(general.entries)) {
            const exists = general.entries.some((e: any) => e && e.id === 'flowable-eventType');
            if (!exists) {
              let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
              if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
              const def = { id: 'flowable-eventType', component: EventTypeEntry, isEdited: isTextFieldEntryEdited };
              if (insertAfterIdx >= 0) general.entries.splice(insertAfterIdx + 1, 0, def); else general.entries.unshift(def);
            }
          }
          // Correlation parameter group
          if (!groups.some((g) => g && g.id === 'flowable-correlation-parameters')) {
            const corr = createCorrelationParametersGroup(element);
            const idxGen = groups.findIndex((g) => g && g.id === 'general');
            if (idxGen >= 0) groups.splice(idxGen + 1, 0, corr); else groups.push(corr);
          }
          // Inbound event mapping group
          if (!groups.some((g) => g && g.id === 'flowable-inbound-event-mapping')) {
            const inGroup = createInboundEventMappingGroup(element);
            const idxCorr = groups.findIndex((g) => g && g.id === 'flowable-correlation-parameters');
            if (idxCorr >= 0) groups.splice(idxCorr + 1, 0, inGroup);
            else {
              const idxGen = groups.findIndex((g) => g && g.id === 'general');
              if (idxGen >= 0) groups.splice(idxGen + 1, 0, inGroup); else groups.push(inGroup);
            }
          }
        }
        // Error Boundary: add our own Error code entry to General, add error variable fields and Error mapping
        if (isErrorBoundaryEvent(element)) {
          const idxGen = groups.findIndex((g: any) => g && g.id === 'general');
          const general = idxGen >= 0 ? groups[idxGen] : null;
          const findErrIdx = () => groups.findIndex((g: any) => {
            const id = String(g && g.id || '').toLowerCase();
            const label = String(g && g.label || '').toLowerCase();
            if (id === 'error' || id === 'errorgroup' || /\berror\b/.test(label)) return true;
            const entries = Array.isArray(g && g.entries) ? g.entries : [];
            return entries.some((e: any) => {
              const lid = String(e && e.id || '').toLowerCase();
              const llb = String(e && e.label || '').toLowerCase();
              return /error/.test(lid) || /\berror\b/.test(llb);
            });
          });
          const idxErr = findErrIdx();
          if (idxErr >= 0) {
            // remove default Error group entirely (we provide our own entries)
            groups.splice(idxErr, 1);
          }
          if (general && Array.isArray(general.entries)) {
            let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
            if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
            let offset = 1;
            // insert our stable Error code entry (avoid reusing default "Code" entry to keep label stable)
            const alreadyHasErrorCode = general.entries.some((e: any) => e && e.id === 'bpmn-error-code');
            if (!alreadyHasErrorCode) {
              const def = { id: 'bpmn-error-code', component: ErrorCodeEntry, isEdited: isTextFieldEntryEdited };
              general.entries.splice(Math.max(insertAfterIdx + offset, 0), 0, def);
              offset += 1;
            }
            // add variable entries
            const want = [
              { id: 'flowable-errorDef-errorVariableName', component: ErrorDef_VariableNameEntry, isEdited: isTextFieldEntryEdited },
              { id: 'flowable-errorDef-errorVariableTransient', component: ErrorDef_VariableTransientEntry, isEdited: isCheckboxEntryEdited },
              { id: 'flowable-errorDef-errorVariableLocalScope', component: ErrorDef_VariableLocalScopeEntry, isEdited: isCheckboxEntryEdited }
            ];
            want.forEach((w) => {
              const exists = general.entries.some((e: any) => e && e.id === w.id);
              if (!exists) {
                general.entries.splice(Math.max(insertAfterIdx + offset, 0), 0, w);
                offset += 1;
              }
            });
          }
          // ensure separator after adding
          try { ensureGeneralSeparator(); } catch {}
          // add Error mapping section right after General
          const existsMap = groups.some((g: any) => g && g.id === 'flowable-error-mapping');
          if (!existsMap) {
            const mapGroup = createErrorMappingGroup(element);
            const afterGen = (general ? groups.indexOf(general) : groups.findIndex((g: any) => g && g.id === 'general'));
            const insertAt = afterGen >= 0 ? afterGen + 1 : groups.length;
            groups.splice(insertAt, 0, mapGroup);
          }
        }
      }
      // Add CallActivity fields to General
      if (isCallActivity(element)) {
        const general = groups && groups.find((g) => g && g.id === 'general');
        if (general && Array.isArray(general.entries)) {
          // Inject in order directly after ID: Process reference, Business key, Inherit business key
          const want: any[] = [
            { id: 'bpmn-calledElement', component: CalledElementEntry, isEdited: isTextFieldEntryEdited },
            { id: 'flowable-businessKey', component: BusinessKeyEntry, isEdited: isTextFieldEntryEdited },
            { id: 'flowable-inheritBusinessKey', component: InheritBusinessKeyEntry, isEdited: isCheckboxEntryEdited },
            { id: 'flowable-inheritVariables', component: InheritVariablesEntry, isEdited: isCheckboxEntryEdited }
          ];
          // ensure not duplicated and insert in correct order
          let insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'id');
          if (insertAfterIdx < 0) insertAfterIdx = general.entries.findIndex((e: any) => e && e.id === 'name');
          let offset = 1;
          want.forEach((def) => {
            const exists = general.entries.some((e: any) => e && e.id === def.id);
            if (!exists) {
              const idx = insertAfterIdx >= 0 ? (insertAfterIdx + offset) : 0;
              general.entries.splice(idx, 0, def);
              offset += 1;
            }
          });
        }
        // Insert In/Out mappings groups after General
        const existingIn = groups.some((g: any) => g && g.id === 'flowable-in-mappings');
        const existingOut = groups.some((g: any) => g && g.id === 'flowable-out-mappings');
        const existingOutOpts = groups.some((g: any) => g && g.id === 'flowable-out-mapping-options');
        const insertAt = groups.findIndex((g: any) => g && g.id === 'general');
        const inGroup = createInMappingsGroup(element);
        const outGroup = createOutMappingsGroup(element);
        const outOptsGroup = createOutMappingsOptionsGroup(element);
        const toInsert: any[] = [];
        if (!existingIn) toInsert.push(inGroup);
        if (!existingOut) toInsert.push(outGroup);
        if (toInsert.length) {
          if (insertAt >= 0) groups.splice(insertAt + 1, 0, ...toInsert); else groups.unshift(...toInsert);
        }
        // Now ensure options group visibility matches outs count
        const outsCount = getFlowableMappings(element.businessObject, 'Out').length;
        const idxOut = groups.findIndex((g: any) => g && g.id === 'flowable-out-mappings');
        const idxOpts = groups.findIndex((g: any) => g && g.id === 'flowable-out-mapping-options');
        if (outsCount > 0) {
          if (idxOpts < 0 && idxOut >= 0) {
            groups.splice(idxOut + 1, 0, outOptsGroup);
          }
        } else {
          if (idxOpts >= 0) groups.splice(idxOpts, 1);
        }
      }
      // Ensure General separator presence if extra fields exist beyond Name and ID
      ensureGeneralSeparator();
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
      // Variable aggregations group: show only if MI present, insert after MI group
      if (loop) {
        const vaGroupExists = groups && groups.some((g) => g && g.id === 'flowable-variable-aggregations');
        if (!vaGroupExists) {
          const vaGroup = createVariableAggregationsGroup(element);
          const idxMi = groups.findIndex((g) => g && (g.id === 'multiInstance' || g.id === 'multiInstanceGroup' || g.id === 'flowable-multiInstance'));
          if (idxMi >= 0) groups.splice(idxMi + 1, 0, vaGroup); else groups.push(vaGroup);
        }
      }
      if (isEngineExecutedTask(element)) {
        groups.push(createExecutionGroup(element));
        try { console.debug && console.debug('[FlowableProvider] added Execution group'); } catch (e) {}
      }
      // Remove default Message group for StartEvent / IntermediateCatchEvent / Message BoundaryEvent (we manage event via Flowable sections)
      if (isStartEvent(element) || isIntermediateCatchEvent(element) || (isBoundaryEvent(element) && isMessageBoundaryEvent(element))) {
        const idx = groups.findIndex((g: any) => {
          const id = String(g && g.id || '').toLowerCase();
          const label = String(g && g.label || '').toLowerCase();
          return id === 'message' || id === 'messagegroup' || /\bmessage\b/.test(label);
        });
        if (idx >= 0) groups.splice(idx, 1);
      }
      // Remove default Error group for Error Boundary and Error Start Events (we provide our own UI)
      if ((isBoundaryEvent(element) && isErrorBoundaryEvent(element)) || (isStartEvent(element) && isErrorStartEvent(element))) {
        const idxErr = groups.findIndex((g: any) => {
          const id = String(g && g.id || '').toLowerCase();
          const label = String(g && g.label || '').toLowerCase();
          // match the built-in Error group only (not our flowable-error-variables)
          return (id === 'error' || id === 'errorgroup' || label === 'error');
        });
        if (idxErr >= 0) groups.splice(idxErr, 1);
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
