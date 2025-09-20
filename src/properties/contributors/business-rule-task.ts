import { isCheckboxEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isBusinessRuleTask } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator } from '../group-utils';
import { DecisionTableReferenceEntry, DecisionThrowOnNoHitsEntry, GeneralSpacerEntry } from '../helpers/entries';

export const businessRuleTask: Contributor = (element, groups) => {
  if (!isBusinessRuleTask(element) || !Array.isArray(groups)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  let offset = 1;
  const ids = general.entries.map((entry: any) => entry && entry.id);

  if (!ids.includes('flowable-decisionTableReferenceKey')) {
    insertAfterIdOrName(general.entries, {
      id: 'flowable-decisionTableReferenceKey',
      component: DecisionTableReferenceEntry,
      isEdited: isTextFieldEntryEdited
    }, offset++);
  }

  if (!ids.includes('flowable-decisionTaskThrowErrorOnNoHits')) {
    insertAfterIdOrName(general.entries, {
      id: 'flowable-decisionTaskThrowErrorOnNoHits',
      component: DecisionThrowOnNoHitsEntry,
      isEdited: isCheckboxEntryEdited
    }, offset++);
  }

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });
};
