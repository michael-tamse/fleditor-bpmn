import { isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isIntermediateCatchEvent, isTimerIntermediateCatchEvent } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator, removeGroup } from '../group-utils';
import { createCorrelationParametersGroup, createInboundEventMappingGroup, GeneralSpacerEntry } from '../helpers/entries';
import EventKeyWithPicker from '../entries/EventKeyWithPicker';

export const intermediateMessageEvent: Contributor = (element, groups) => {
  if (!isIntermediateCatchEvent(element) || isTimerIntermediateCatchEvent(element) || !Array.isArray(groups)) return;

  removeGroup(groups, 'message');

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const hasEventType = general.entries.some((entry: any) => entry && entry.id === 'flowable-eventType');
  if (!hasEventType) {
    insertAfterIdOrName(general.entries, {
      id: 'flowable-eventType',
      component: EventKeyWithPicker,
      isEdited: isTextFieldEntryEdited
    });
  }

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });

  const hasCorrelation = groups.some((group: any) => group && group.id === 'flowable-correlation-parameters');
  if (!hasCorrelation) {
    const descriptor = createCorrelationParametersGroup(element);
    const generalIndex = groups.findIndex((group: any) => group && group.id === 'general');
    if (generalIndex >= 0) {
      groups.splice(generalIndex + 1, 0, descriptor);
    } else {
      groups.push(descriptor);
    }
  }

  const hasInbound = groups.some((group: any) => group && group.id === 'flowable-inbound-event-mapping');
  if (!hasInbound) {
    const descriptor = createInboundEventMappingGroup(element);
    const correlationIndex = groups.findIndex((group: any) => group && group.id === 'flowable-correlation-parameters');
    if (correlationIndex >= 0) {
      groups.splice(correlationIndex + 1, 0, descriptor);
    } else {
      const generalIndex = groups.findIndex((group: any) => group && group.id === 'general');
      if (generalIndex >= 0) {
        groups.splice(generalIndex + 1, 0, descriptor);
      } else {
        groups.push(descriptor);
      }
    }
  }
};
