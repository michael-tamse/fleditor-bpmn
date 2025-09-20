import { isSelectEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isServiceTask } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator } from '../group-utils';
import { ServiceImplementationTypeEntry, ServiceImplementationValueEntry, GeneralSpacerEntry } from '../helpers/entries';

export const serviceTaskGeneral: Contributor = (element, groups) => {
  if (!isServiceTask(element)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const ids = general.entries.map((entry: any) => entry && entry.id);
  let offset = 1;

  if (!ids.includes('flowable-service-impl')) {
    insertAfterIdOrName(
      general.entries,
      {
        id: 'flowable-service-impl',
        component: ServiceImplementationTypeEntry,
        isEdited: isSelectEntryEdited
      },
      offset++
    );
  }

  if (!ids.includes('flowable-service-impl-value')) {
    insertAfterIdOrName(
      general.entries,
      {
        id: 'flowable-service-impl-value',
        component: ServiceImplementationValueEntry,
        isEdited: isTextFieldEntryEdited
      },
      offset++
    );
  }

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });
};
