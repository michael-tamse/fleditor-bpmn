import { Contributor } from '../types';
import { isCallActivity } from '../guards';
import { InMappingsGroupComponent } from '../helpers/entries';

const IN_GROUP_ID = 'flowable-in-mappings';

export const inMappings: Contributor = (element, groups) => {
  if (!isCallActivity(element) || !Array.isArray(groups)) return;

  const exists = groups.some((group: any) => group && group.id === IN_GROUP_ID);
  if (exists) return;

  const group = {
    id: IN_GROUP_ID,
    label: 'In mappings',
    component: InMappingsGroupComponent
  };

  const generalIndex = groups.findIndex((group: any) => group && group.id === 'general');
  if (generalIndex >= 0) {
    groups.splice(generalIndex + 1, 0, group);
  } else {
    groups.unshift(group);
  }
};
