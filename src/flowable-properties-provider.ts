import { compose } from './properties/composer';
import {
  serviceTaskGeneral,
  sequenceFlowCondition,
  executionFlags,
  callActivityCore,
  inMappings,
  outMappings,
  outMappingOptions,
  sendTaskOutboundEvent,
  receiveTaskInboundEvent,
  intermediateMessageEvent,
  startMessageEvent,
  messageBoundaryEvent,
  errorStartEvent,
  errorBoundaryEvent,
  errorEndEvent,
  businessRuleTask,
  multiInstance,
  variableAggregations,
  generalIdFromName,
  generalNameWithInlineButton
} from './properties/contributors';

import type { BPMNElement } from './properties/types';

const contribute = compose(
  generalNameWithInlineButton,
  serviceTaskGeneral,
  sequenceFlowCondition,
  executionFlags,
  callActivityCore,
  inMappings,
  outMappings,
  outMappingOptions,
  sendTaskOutboundEvent,
  receiveTaskInboundEvent,
  intermediateMessageEvent,
  startMessageEvent,
  messageBoundaryEvent,
  errorStartEvent,
  errorBoundaryEvent,
  errorEndEvent,
  businessRuleTask,
  multiInstance,
  variableAggregations
);

function getType(element: BPMNElement): string {
  return (element && element.businessObject && element.businessObject.$type) || '';
}

function FlowablePropertiesProvider(this: any, propertiesPanel: any) {
  this.getGroups = (element: BPMNElement) => (groups: any[]) => {
    try {
      console.debug?.('[FlowableProvider] getGroups for', getType(element), 'groups in:', groups?.length);
    } catch {}

    contribute(element, groups);
    return groups;
  };

  if (propertiesPanel && typeof propertiesPanel.registerProvider === 'function') {
    propertiesPanel.registerProvider(500, this);
    try {
      console.debug?.('FlowablePropertiesProvider registered');
    } catch {}
  }
}

(FlowablePropertiesProvider as any).$inject = [ 'propertiesPanel' ];

export default {
  __init__: [ 'flowablePropertiesProvider' ],
  flowablePropertiesProvider: [ 'type', FlowablePropertiesProvider ]
};
