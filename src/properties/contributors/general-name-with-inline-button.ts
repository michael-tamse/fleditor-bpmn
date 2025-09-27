import { Contributor } from '../types';
import { findGroup } from '../group-utils';
import { NameWithInlineButton } from '../helpers/entries';

export const generalNameWithInlineButton: Contributor = (element, groups) => {
  if (!Array.isArray(groups)) return;

  const general = findGroup(groups, 'general');
  if (!general || !Array.isArray(general.entries)) return;

  const nameEntryIndex = general.entries.findIndex((entry: any) =>
    entry && (entry.id === 'name' || entry.id === 'element-name')
  );

  if (nameEntryIndex === -1) return;

  // Replace the existing name entry with our custom component
  general.entries[nameEntryIndex] = {
    id: 'name-with-inline-button',
    component: NameWithInlineButton
  };
};