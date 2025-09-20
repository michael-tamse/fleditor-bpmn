import { Contributor } from '../types';
import { isCallActivity } from '../guards';
import { OutMappingsOptionsComponent } from '../helpers/entries';
import { getFlowableMappings } from '../helpers/flowable-mappings';

const OUT_GROUP_ID = 'flowable-out-mappings';
const OPTIONS_GROUP_ID = 'flowable-out-mapping-options';

export const outMappingOptions: Contributor = (element, groups) => {
  if (!isCallActivity(element) || !Array.isArray(groups)) return;

  const outsCount = getFlowableMappings(element.businessObject, 'Out').length;
  const optionsIndex = groups.findIndex((group: any) => group && group.id === OPTIONS_GROUP_ID);

  if (outsCount <= 0) {
    if (optionsIndex >= 0) {
      groups.splice(optionsIndex, 1);
    }
    return;
  }

  if (optionsIndex >= 0) return;

  const outIndex = groups.findIndex((group: any) => group && group.id === OUT_GROUP_ID);
  const group = {
    id: OPTIONS_GROUP_ID,
    component: OutMappingsOptionsComponent
  };

  if (outIndex >= 0) {
    groups.splice(outIndex + 1, 0, group);
  } else {
    groups.push(group);
  }
};
