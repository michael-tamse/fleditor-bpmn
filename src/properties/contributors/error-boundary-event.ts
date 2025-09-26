import { isCheckboxEntryEdited, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';

import { Contributor } from '../types';
import { isBoundaryEvent, isErrorBoundaryEvent } from '../guards';
import { findGroup, insertAfterIdOrName, ensureGeneralSeparator } from '../group-utils';
import {
  ErrorCodeEntry,
  ErrorDef_VariableNameEntry,
  ErrorDef_VariableTransientEntry,
  ErrorDef_VariableLocalScopeEntry,
  createErrorMappingGroup,
  GeneralSpacerEntry
} from '../helpers/entries';

export const errorBoundaryEvent: Contributor = (element, groups) => {
  if (!isBoundaryEvent(element) || !isErrorBoundaryEvent(element) || !Array.isArray(groups)) return;

  for (let idx = groups.length - 1; idx >= 0; idx -= 1) {
    const group = groups[idx];
    if (group && group.id === 'error') {
      groups.splice(idx, 1);
    }
  }

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  let insertAfter = general.entries.findIndex((entry: any) => entry && entry.id === 'id');
  if (insertAfter < 0) {
    insertAfter = general.entries.findIndex((entry: any) => entry && entry.id === 'name');
  }

  let offset = 1;

  const ensureEntry = (descriptor: any) => {
    const exists = general.entries.some((entry: any) => entry && entry.id === descriptor.id);
    if (exists) return;
    const index = insertAfter >= 0 ? insertAfter + offset : general.entries.length;
    general.entries.splice(index, 0, descriptor);
    offset += 1;
  };

  ensureEntry({ id: 'bpmn-error-code', component: ErrorCodeEntry, isEdited: isTextFieldEntryEdited });
  ensureEntry({ id: 'flowable-errorDef-errorVariableName', component: ErrorDef_VariableNameEntry, isEdited: isTextFieldEntryEdited });
  ensureEntry({ id: 'flowable-errorDef-errorVariableTransient', component: ErrorDef_VariableTransientEntry, isEdited: isCheckboxEntryEdited });
  ensureEntry({ id: 'flowable-errorDef-errorVariableLocalScope', component: ErrorDef_VariableLocalScopeEntry, isEdited: isCheckboxEntryEdited });

  ensureGeneralSeparator(general.entries, { id: 'general-spacer-1', component: GeneralSpacerEntry });

  const hasMapping = groups.some((group: any) => group && group.id === 'flowable-error-mapping');
  if (!hasMapping) {
    const descriptor = createErrorMappingGroup(element);
    const generalIndex = groups.findIndex((group: any) => group && group.id === 'general');
    const insertIndex = generalIndex >= 0 ? generalIndex + 1 : groups.length;
    groups.splice(insertIndex, 0, descriptor);
  }
};
