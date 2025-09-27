import { Contributor } from '../types';
import { findGroup, insertAfterEntry } from '../group-utils';
import { CreateIdButton } from '../helpers/entries';

export const generalIdFromName: Contributor = (element, groups) => {
  if (!Array.isArray(groups)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const nameEntryIndex = general.entries.findIndex((entry: any) =>
    entry && (entry.id === 'name' || entry.id === 'element-name')
  );

  if (nameEntryIndex === -1) return;

  const hasCreateIdButton = general.entries.some((entry: any) =>
    entry && entry.id === 'create-id-button'
  );

  if (!hasCreateIdButton) {
    const buttonDescriptor = {
      id: 'create-id-button',
      component: CreateIdButton
    };

    general.entries.splice(nameEntryIndex + 1, 0, buttonDescriptor);
  }
};