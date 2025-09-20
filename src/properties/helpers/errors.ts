export function getErrorEventDefinition(element: any): any | null {
  if (!element) return null;
  const bo = element.businessObject;
  const eventDefinitions = (bo && bo.eventDefinitions) || [];
  return eventDefinitions.find((definition: any) => definition && definition.$type === 'bpmn:ErrorEventDefinition') || null;
}
