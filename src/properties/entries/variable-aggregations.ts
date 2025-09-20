import { ListGroup, SelectEntry, TextFieldEntry, isSelectEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from 'bpmn-js-properties-panel';
import { h } from '@bpmn-io/properties-panel/preact';

import type { BPMNElement } from '../types';
import {
  addAggregationDefinition,
  addVariableAggregation,
  getAggregationDefinitions,
  getFlowableVariableAggregations,
  removeAggregationDefinition,
  removeVariableAggregation
} from '../helpers/variable-aggregations';

export function VariableAggregationTargetEntry(props: { element: BPMNElement; aggregation: any; id: string }) {
  const { element, aggregation, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const getValue = () => (aggregation.get ? aggregation.get('target') : aggregation.target) || '';
  const setValue = (value: string) => modeling.updateModdleProperties(element, aggregation, { target: (value || '').trim() || undefined });
  const label = translate ? translate('Target (Variable / Expression)') : 'Target (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

export function VariableAggregationCreationModeEntry(props: { element: BPMNElement; aggregation: any; id: string }) {
  const { element, aggregation, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');

  const getValue = () => {
    const overview = !!(aggregation.get ? aggregation.get('createOverviewVariable') : aggregation.createOverviewVariable);
    const transient = !!(aggregation.get ? aggregation.get('storeAsTransientVariable') : aggregation.storeAsTransientVariable);
    if (overview) return 'overview';
    if (transient) return 'transient';
    return 'default';
  };

  const setValue = (mode: 'default' | 'overview' | 'transient') => {
    const updates: any = {
      createOverviewVariable: undefined,
      storeAsTransientVariable: undefined
    };
    if (mode === 'overview') updates.createOverviewVariable = true;
    if (mode === 'transient') updates.storeAsTransientVariable = true;
    modeling.updateModdleProperties(element, aggregation, updates);
  };

  const getOptions = () => ([
    { label: translate ? translate('Default') : 'Default', value: 'default' },
    { label: translate ? translate('Create overview variable') : 'Create overview variable', value: 'overview' },
    { label: translate ? translate('Store as transient variable') : 'Store as transient variable', value: 'transient' }
  ]);

  const label = translate ? translate('Target variable creation') : 'Target variable creation';
  return SelectEntry({ id, element, label, getValue, setValue, getOptions });
}

function AggregationDefinitionSourceEntry(props: { element: BPMNElement; aggregation: any; definition: any; id: string }) {
  const { element, aggregation, definition, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    if (definition && typeof definition.get === 'function') {
      const value = definition.get('source') ?? definition.get('variableSource');
      return value || '';
    }
    const attrs = (definition && definition.$attrs) || {};
    return attrs.source ?? definition?.source ?? definition?.variableSource ?? '';
  };

  const setValue = (value: string) => {
    const next = (value || '').trim() || undefined;
    if (definition && typeof definition.get === 'function') {
      modeling.updateModdleProperties(element, definition, { source: next, variableSource: undefined });
    } else {
      const attrs = { ...(definition.$attrs || {}) };
      if (typeof next === 'undefined') {
        delete attrs.source;
      } else {
        attrs.source = next;
      }
      delete attrs.variableSource;
      modeling.updateModdleProperties(element, definition, { $attrs: attrs });
    }
  };

  const label = translate ? translate('Source (Variable / Expression)') : 'Source (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

function AggregationDefinitionTargetEntry(props: { element: BPMNElement; aggregation: any; definition: any; id: string }) {
  const { element, aggregation, definition, id } = props;
  const modeling = useService('modeling');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    if (definition && typeof definition.get === 'function') {
      const value = definition.get('target') ?? definition.get('variableTarget');
      return value || '';
    }
    const attrs = (definition && definition.$attrs) || {};
    return attrs.target ?? definition?.target ?? definition?.variableTarget ?? '';
  };

  const setValue = (value: string) => {
    const next = (value || '').trim() || undefined;
    if (definition && typeof definition.get === 'function') {
      modeling.updateModdleProperties(element, definition, { target: next, variableTarget: undefined });
    } else {
      const attrs = { ...(definition.$attrs || {}) };
      if (typeof next === 'undefined') {
        delete attrs.target;
      } else {
        attrs.target = next;
      }
      delete attrs.variableTarget;
      modeling.updateModdleProperties(element, definition, { $attrs: attrs });
    }
  };

  const label = translate ? translate('Target (Variable / Expression)') : 'Target (Variable / Expression)';
  return TextFieldEntry({ id, element, label, getValue, setValue, debounce });
}

export function VariableAggregationsGroupComponent(props: any) {
  const { element, id, label } = props;
  const translate = useService('translate');
  const bpmnFactory = useService('bpmnFactory');
  const modeling = useService('modeling');
  const bo = element.businessObject;
  const loop = bo?.loopCharacteristics;

  const primary = getFlowableVariableAggregations(loop);
  const legacy = getFlowableVariableAggregations(bo);
  const aggregations = (primary && primary.length ? primary : legacy) || [];

  const items = aggregations.map((aggregation: any, index: number) => {
    const labelText = (aggregation.get ? aggregation.get('target') : aggregation.target) || (translate ? translate('Variable aggregation') : 'Variable aggregation');
    const entries = [
      {
        id: `flowable-varAgg-${index}-target`,
        element,
        aggregation,
        component: VariableAggregationTargetEntry,
        isEdited: isTextFieldEntryEdited
      },
      {
        id: `flowable-varAgg-${index}-mode`,
        element,
        aggregation,
        component: VariableAggregationCreationModeEntry,
        isEdited: isSelectEntryEdited
      },
      {
        id: `flowable-varAgg-${index}-defs`,
        element,
        aggregation,
        component: (props: any) => {
          const { element: currentElement, aggregation: currentAggregation, id: defsId } = props;
          const definitions = getAggregationDefinitions(currentAggregation);
          const items = definitions.map((definition: any, defIndex: number) => {
            const entries = [
              {
                id: `${defsId}-${defIndex}-source`,
                element: currentElement,
                aggregation: currentAggregation,
                definition,
                component: AggregationDefinitionSourceEntry,
                isEdited: isTextFieldEntryEdited
              },
              {
                id: `${defsId}-${defIndex}-target`,
                element: currentElement,
                aggregation: currentAggregation,
                definition,
                component: AggregationDefinitionTargetEntry,
                isEdited: isTextFieldEntryEdited
              }
            ];
            const remove = () => removeAggregationDefinition(currentElement, currentAggregation, definition, modeling);
            const label = (() => {
              if (definition && typeof definition.get === 'function') {
                return definition.get('target') || definition.get('source') || definition.get('variableTarget') || definition.get('variableSource') || '';
              }
              const attrs = (definition && definition.$attrs) || {};
              return attrs.target || attrs.source || definition?.target || definition?.source || definition?.variableTarget || definition?.variableSource || '';
            })();
            return {
              id: `${defsId}-item-${defIndex}`,
              label,
              entries,
              remove,
              autoFocusEntry: `${defsId}-${defIndex}-source`
            };
          });

          const add = (event?: any) => {
            try { event?.stopPropagation?.(); } catch {}
            addAggregationDefinition(currentElement, currentAggregation, bpmnFactory, modeling);
          };

          return h(ListGroup as any, {
            id: defsId,
            label: translate ? translate('Definitions') : 'Definitions',
            element: currentElement,
            items,
            add,
            shouldSort: false
          });
        }
      }
    ];

    const remove = () => removeVariableAggregation(element, loop || bo, aggregation, modeling);
    return {
      id: `flowable-varAgg-item-${index}`,
      label: labelText,
      entries,
      remove,
      autoFocusEntry: `flowable-varAgg-${index}-target`
    };
  });

  const add = (event?: any) => {
    try { event?.stopPropagation?.(); } catch {}
    addVariableAggregation(element, loop || bo, bpmnFactory, modeling);
  };

  return h(ListGroup as any, {
    id,
    label: label || (translate ? translate('Variable aggregations') : 'Variable aggregations'),
    element,
    items,
    add,
    shouldSort: false
  });
}
