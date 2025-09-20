import { Contributor, BPMNElement, Groups } from './types';

export function compose(...contributors: Contributor[]): Contributor {
  return (element: BPMNElement, groups: Groups) => {
    for (const contributor of contributors) {
      contributor(element, groups);
    }
  };
}
