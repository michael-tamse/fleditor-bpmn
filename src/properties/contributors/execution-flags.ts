import { Group, isCheckboxEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isCallActivity, isEngineExecutedTask, isServiceTask, isStartOrEndEvent } from '../guards';
import { AsyncEntry, AsyncLeaveEntry, ExclusiveEntry, ExclusiveLeaveEntry, IsForCompensationEntry, CompleteAsyncEntry, GeneralSpacerEntry, getServiceImplType } from '../helpers/entries';

export const executionFlags: Contributor = (element, groups) => {
  if (!isEngineExecutedTask(element)) return;
  if (!Array.isArray(groups)) return;

  const bo = element && element.businessObject;
  const isExternalService = isServiceTask(element) && bo && getServiceImplType(bo) === 'external';

  let executionGroup = groups.find((group: any) => group && group.id === 'execution');
  if (!executionGroup) {
    executionGroup = { id: 'execution', label: 'Execution', entries: [], component: Group };
    groups.push(executionGroup);
  }

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
    entries.push({ id: 'execution-spacer-1', component: GeneralSpacerEntry });
  }

  entries.push({ id: 'bpmn-isForCompensation', component: IsForCompensationEntry, isEdited: isCheckboxEntryEdited });

  if (isCallActivity(element)) {
    entries.push({ id: 'flowable-completeAsync', component: CompleteAsyncEntry, isEdited: isCheckboxEntryEdited });
  }

  executionGroup.entries = entries;
};
