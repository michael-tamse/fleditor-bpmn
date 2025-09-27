import { BPMNElement } from './types';

export function getType(element: BPMNElement): string {
  return (element && element.businessObject && element.businessObject.$type) || '';
}

export function isActivityLike(element: BPMNElement): boolean {
  const t = getType(element);
  return /Task$/.test(t) || /SubProcess$/.test(t) || /CallActivity$/.test(t);
}

export function isStartOrEndEvent(element: BPMNElement): boolean {
  const t = getType(element);
  return /StartEvent$/.test(t) || /EndEvent$/.test(t);
}

export function isServiceTask(element: BPMNElement): boolean {
  return /ServiceTask$/.test(getType(element));
}

export function isSendTask(element: BPMNElement): boolean {
  return /SendTask$/.test(getType(element));
}

export function isReceiveTask(element: BPMNElement): boolean {
  return /ReceiveTask$/.test(getType(element));
}

export function isIntermediateCatchEvent(element: BPMNElement): boolean {
  return /IntermediateCatchEvent$/.test(getType(element));
}

export function isBoundaryEvent(element: BPMNElement): boolean {
  return /BoundaryEvent$/.test(getType(element));
}

export function isMessageBoundaryEvent(element: BPMNElement): boolean {
  if (!isBoundaryEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:MessageEventDefinition');
}

export function isCallActivity(element: BPMNElement): boolean {
  return /CallActivity$/.test(getType(element));
}

export function isStartEvent(element: BPMNElement): boolean {
  return /StartEvent$/.test(getType(element));
}

export function isEndEvent(element: BPMNElement): boolean {
  return /EndEvent$/.test(getType(element));
}

export function isBusinessRuleTask(element: BPMNElement): boolean {
  return /BusinessRuleTask$/.test(getType(element));
}

export function isTimerIntermediateCatchEvent(element: BPMNElement): boolean {
  if (!isIntermediateCatchEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
}

export function isTimerBoundaryEvent(element: BPMNElement): boolean {
  if (!isBoundaryEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
}

export function isErrorBoundaryEvent(element: BPMNElement): boolean {
  if (!isBoundaryEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:ErrorEventDefinition');
}

export function isErrorStartEvent(element: BPMNElement): boolean {
  if (!isStartEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:ErrorEventDefinition');
}

export function isErrorEndEvent(element: BPMNElement): boolean {
  if (!isEndEvent(element)) return false;
  const bo = element.businessObject;
  const eventDefinitions = bo && bo.eventDefinitions;
  if (!Array.isArray(eventDefinitions)) return false;
  return eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:ErrorEventDefinition');
}

export function isSequenceFlow(element: BPMNElement): boolean {
  return /SequenceFlow$/.test(getType(element));
}

export function isEngineExecutedTask(element: BPMNElement): boolean {
  const t = getType(element);
  return /^(bpmn:)?(ServiceTask|SendTask|ReceiveTask|BusinessRuleTask|ScriptTask|CallActivity)$/.test(t);
}
