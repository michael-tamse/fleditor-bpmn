import { Groups } from './types';

export function findGroup(groups: Groups, id: string) {
  return Array.isArray(groups) ? groups.find((group) => group && group.id === id) : undefined;
}

export function removeGroup(groups: Groups, id: string) {
  if (!Array.isArray(groups)) return;

  for (let idx = groups.length - 1; idx >= 0; idx -= 1) {
    const group = groups[idx];
    if (group && group.id === id) {
      groups.splice(idx, 1);
    }
  }
}

export function insertAfterIdOrName(entries: any[], entry: any, offset = 1) {
  if (!Array.isArray(entries)) return;
  let index = entries.findIndex((item: any) => item && item.id === 'id');
  if (index < 0) {
    index = entries.findIndex((item: any) => item && item.id === 'name');
  }
  const insertPosition = index >= 0 ? index + offset : entries.length;
  entries.splice(insertPosition, 0, entry);
}

export function ensureGeneralSeparator(entries: any[], spacerEntry: any) {
  if (!Array.isArray(entries)) return;

  const hasSeparator = entries.some((item: any) => item && item.id === 'general-spacer-1');
  if (hasSeparator) return;

  const hasExtra = entries.some((item: any) => {
    const id = item && item.id;
    return id && id !== 'name' && id !== 'id';
  });
  if (!hasExtra) return;

  let insertAfter = entries.findIndex((item: any) => item && item.id === 'id');
  if (insertAfter < 0) {
    insertAfter = entries.findIndex((item: any) => item && item.id === 'name');
  }
  if (insertAfter < 0) return;

  entries.splice(insertAfter + 1, 0, spacerEntry);
}
