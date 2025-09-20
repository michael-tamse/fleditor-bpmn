import { Contributor } from '../types';
import { findGroup } from '../group-utils';
import { VariableAggregationsGroupComponent } from '../helpers/entries';

export const variableAggregations: Contributor = (element, groups) => {
  const bo = element?.businessObject;
  const loop = bo?.loopCharacteristics;
  if (!loop || !Array.isArray(groups)) return;

  const exists = groups.some((group: any) => group && group.id === 'flowable-variable-aggregations');
  if (exists) return;

  const descriptor = {
    id: 'flowable-variable-aggregations',
    component: VariableAggregationsGroupComponent
  };

  const miGroup = findGroup(groups, 'multiInstance')
    || findGroup(groups, 'multiInstanceGroup')
    || findGroup(groups, 'flowable-multiInstance');

  if (miGroup) {
    const index = groups.indexOf(miGroup);
    groups.splice(index + 1, 0, descriptor);
  } else {
    groups.push(descriptor);
  }
};
