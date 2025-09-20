import { isCheckboxEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isSendTask } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator } from '../group-utils';
import { EventTypeEntry, SendSynchronouslyEntry, createOutboundEventMappingGroup, GeneralSpacerEntry } from '../helpers/entries';

export const sendTaskOutboundEvent: Contributor = (element, groups) => {
  if (!isSendTask(element) || !Array.isArray(groups)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const hasEventType = general.entries.some((entry: any) => entry && entry.id === 'flowable-eventType');
  if (!hasEventType) {
    insertAfterIdOrName(general.entries, {
      id: 'flowable-eventType',
      component: EventTypeEntry,
      isEdited: isTextFieldEntryEdited
    });
  }

  const hasSendSynchronously = general.entries.some((entry: any) => entry && entry.id === 'flowable-sendSynchronously');
  if (!hasSendSynchronously) {
    const eventTypeIndex = general.entries.findIndex((entry: any) => entry && entry.id === 'flowable-eventType');
    const descriptor = {
      id: 'flowable-sendSynchronously',
      component: SendSynchronouslyEntry,
      isEdited: isCheckboxEntryEdited
    };
    if (eventTypeIndex >= 0) {
      general.entries.splice(eventTypeIndex + 1, 0, descriptor);
    } else {
      insertAfterIdOrName(general.entries, descriptor);
    }
  }

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });

  const hasGroup = groups.some((group: any) => group && group.id === 'flowable-outbound-event-mapping');
  if (!hasGroup) {
    const descriptor = createOutboundEventMappingGroup(element);
    const generalIndex = groups.findIndex((group: any) => group && group.id === 'general');
    if (generalIndex >= 0) {
      groups.splice(generalIndex + 1, 0, descriptor);
    } else {
      groups.push(descriptor);
    }
  }
};
