import { isCheckboxEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isCallActivity } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator } from '../group-utils';
import { CalledElementEntry, BusinessKeyEntry, InheritBusinessKeyEntry, InheritVariablesEntry, GeneralSpacerEntry } from '../helpers/entries';

export const callActivityCore: Contributor = (element, groups) => {
  if (!isCallActivity(element)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const ids = general.entries.map((entry: any) => entry && entry.id);
  let offset = 1;

  const desired = [
    { id: 'bpmn-calledElement', component: CalledElementEntry, isEdited: isTextFieldEntryEdited },
    { id: 'flowable-businessKey', component: BusinessKeyEntry, isEdited: isTextFieldEntryEdited },
    { id: 'flowable-inheritBusinessKey', component: InheritBusinessKeyEntry, isEdited: isCheckboxEntryEdited },
    { id: 'flowable-inheritVariables', component: InheritVariablesEntry, isEdited: isCheckboxEntryEdited }
  ];

  desired.forEach((def) => {
    if (ids.includes(def.id)) return;
    insertAfterIdOrName(general.entries, def, offset++);
  });

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });
};
