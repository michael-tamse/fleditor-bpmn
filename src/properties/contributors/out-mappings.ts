import { Contributor } from '../types';
import { isCallActivity } from '../guards';
import { OutMappingsGroupComponent } from '../helpers/entries';

const OUT_GROUP_ID = 'flowable-out-mappings';
const IN_GROUP_ID = 'flowable-in-mappings';

export const outMappings: Contributor = (element, groups) => {
  if (!isCallActivity(element) || !Array.isArray(groups)) return;

  const exists = groups.some((group: any) => group && group.id === OUT_GROUP_ID);
  if (exists) return;

  const group = {
    id: OUT_GROUP_ID,
    label: 'Out mappings',
    component: OutMappingsGroupComponent
  };

  const inIndex = groups.findIndex((group: any) => group && group.id === IN_GROUP_ID);
  if (inIndex >= 0) {
    groups.splice(inIndex + 1, 0, group);
    return;
  }

  const generalIndex = groups.findIndex((group: any) => group && group.id === 'general');
  if (generalIndex >= 0) {
    groups.splice(generalIndex + 1, 0, group);
  } else {
    groups.push(group);
  }
};
