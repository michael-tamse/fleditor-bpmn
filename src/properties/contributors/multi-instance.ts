import { Group, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { findGroup } from '../group-utils';
import { FlowableCollectionEntry, FlowableElementVariableEntry, FlowableElementIndexVariableEntry } from '../helpers/entries';

const MI_GROUP_IDS = [ 'multiInstance', 'multiInstanceGroup' ];

export const multiInstance: Contributor = (element, groups) => {
  const bo = element?.businessObject;
  const loop = bo?.loopCharacteristics;
  if (!loop || !Array.isArray(groups)) return;

  let miGroup = groups.find((group: any) => group && MI_GROUP_IDS.includes(group.id));

  if (!miGroup) {
    const fallbackEntries = [
      { id: 'flowable-collection', component: FlowableCollectionEntry, isEdited: isTextFieldEntryEdited },
      { id: 'flowable-elementVariable', component: FlowableElementVariableEntry, isEdited: isTextFieldEntryEdited },
      { id: 'flowable-elementIndexVariable', component: FlowableElementIndexVariableEntry, isEdited: isTextFieldEntryEdited }
    ];
    miGroup = { id: 'flowable-multiInstance', label: 'Multi-Instance', entries: fallbackEntries, component: Group };
    groups.push(miGroup);
    return;
  }

  const entries = miGroup.entries;
  if (!Array.isArray(entries)) return;

  const ensureEntry = (descriptor: any) => {
    const exists = entries.some((entry: any) => entry && entry.id === descriptor.id);
    if (!exists) {
      entries.push({ ...descriptor, isEdited: isTextFieldEntryEdited });
    }
  };

  ensureEntry({ id: 'flowable-collection', component: FlowableCollectionEntry });
  ensureEntry({ id: 'flowable-elementVariable', component: FlowableElementVariableEntry });
  ensureEntry({ id: 'flowable-elementIndexVariable', component: FlowableElementIndexVariableEntry });

  const orderMap: Record<string, number> = {
    'flowable-collection': 0,
    'flowable-elementVariable': 1,
    'flowable-elementIndexVariable': 2
  };

  const isOurs = (id: string) => Object.prototype.hasOwnProperty.call(orderMap, id);
  const isLoopCardinality = (id: string) => /cardinality/i.test(id) || /loop.*cardinality/i.test(id) || /loop-cardinality/i.test(id);
  const isCompletionCondition = (id: string) => /completion/i.test(id) && /condition/i.test(id);

  const ours: any[] = [];
  const loopAndCompletion: any[] = [];
  const others: any[] = [];

  entries.forEach((entry: any) => {
    const id = String(entry?.id || '');
    if (!id) {
      others.push(entry);
    } else if (isOurs(id)) {
      ours.push(entry);
    } else if (isLoopCardinality(id) || isCompletionCondition(id)) {
      loopAndCompletion.push(entry);
    } else {
      others.push(entry);
    }
  });

  ours.sort((a, b) => (orderMap[String(a.id)] ?? 99) - (orderMap[String(b.id)] ?? 99));

  miGroup.entries = [ ...ours, ...loopAndCompletion, ...others ];
};
