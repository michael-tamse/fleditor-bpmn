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

function isCallActivity(element: BPMNElement): boolean {
  return /CallActivity$/.test(getType(element));
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

// ------------- Variable Aggregations helpers -------------

function getFlowableVariableAggregations(bo: any) {
  const ext = getExtensionElements(bo);
  const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
  return values.filter((v: any) => {
    const t = v && v.$type;
    return t === 'flowable:VariableAggregation' || t === 'flowable:variableAggregation';
  });
}

function addVariableAggregation(element: any, bpmnFactory: any, modeling: any) {
  const bo = element.businessObject;
  const ext = ensureExtensionElements(element, bo, bpmnFactory, modeling);
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const agg = bpmnFactory.create('flowable:VariableAggregation', {});
  const newValues = values.concat([ agg ]);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function removeVariableAggregation(element: any, agg: any, modeling: any) {
  const bo = element.businessObject;
  const ext = getExtensionElements(bo);
  if (!ext) return;
  const values = (ext.get ? ext.get('values') : ext.values) || [];
  const newValues = values.filter((v: any) => v !== agg);
  modeling.updateModdleProperties(element, ext, { values: newValues });
}

function getAggregationDefinitions(agg: any) {
  return (agg && (agg.get ? agg.get('definitions') : agg.definitions)) || [];
}

function addAggregationDefinition(element: any, agg: any, bpmnFactory: any, modeling: any, moddle?: any) {
  const defs = getAggregationDefinitions(agg);
  // Create unqualified <variable /> element (no namespace prefix)
  const def: any = (moddle && (moddle as any).createAny)
    ? (moddle as any).createAny('variable', null, {})
    : bpmnFactory.create('flowable:Variable', {});
  const newDefs = defs.concat([ def ]);
  modeling.updateModdleProperties(element, agg, { definitions: newDefs });
}

function removeAggregationDefinition(element: any, agg: any, def: any, modeling: any) {
  const defs = getAggregationDefinitions(agg);
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
  const moddle = useService('moddle');
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
    addAggregationDefinition(element, aggregation, bpmnFactory, modeling, moddle);
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
  const aggs = getFlowableVariableAggregations(bo);
  const items = aggs.map((a: any, idx: number) => {
    const lbl = (a.get ? a.get('target') : a.target) || (translate ? translate('Variable aggregation') : 'Variable aggregation');
    const entries = [
      { id: `flowable-varAgg-${idx}-target`, element, aggregation: a, component: VariableAggregationTargetEntry, isEdited: isTextFieldEntryEdited },
      { id: `flowable-varAgg-${idx}-mode`, element, aggregation: a, component: VariableAggregationCreationModeEntry, isEdited: isSelectEntryEdited },
      { id: `flowable-varAgg-${idx}-defs`, element, aggregation: a, component: AggregationDefinitionsListEntry }
    ];
    const remove = () => removeVariableAggregation(element, a, modeling);
    return { id: `flowable-varAgg-item-${idx}`, label: lbl, entries, remove, autoFocusEntry: `flowable-varAgg-${idx}-target` };
  });
  const add = (e?: any) => {
    try { e && e.stopPropagation && e.stopPropagation(); } catch {}
    addVariableAggregation(element, bpmnFactory, modeling);
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
    return typeof v === 'boolean' ? v : true;
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
