import { isTextAreaEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isSequenceFlow } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator } from '../group-utils';
import { ConditionExpressionEntry, GeneralSpacerEntry } from '../helpers/entries';

export const sequenceFlowCondition: Contributor = (element, groups) => {
  if (!isSequenceFlow(element)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const hasCondition = general.entries.some((entry: any) => entry && entry.id === 'bpmn-conditionExpression');
  if (hasCondition) return;

  insertAfterIdOrName(general.entries, {
    id: 'bpmn-conditionExpression',
    component: ConditionExpressionEntry,
    isEdited: isTextAreaEntryEdited
  });

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });
};
