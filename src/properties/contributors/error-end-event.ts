import { Contributor } from '../types';
import { isEndEvent, isErrorEndEvent } from '../guards';

export const errorEndEvent: Contributor = (element, groups) => {
  if (!isEndEvent(element) || !isErrorEndEvent(element) || !Array.isArray(groups)) return;

  for (let idx = groups.length - 1; idx >= 0; idx -= 1) {
    const group = groups[idx];
    if (group && group.id === 'error') {
      groups.splice(idx, 1);
    }
  }
};
