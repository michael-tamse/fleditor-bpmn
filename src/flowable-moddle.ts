// ESM export of the Flowable moddle descriptor used for async flags
const flowableModdle: Record<string, any> = {
  name: 'Flowable',
  uri: 'http://flowable.org/bpmn',
  prefix: 'flowable',
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'AsyncCapable',
      isAbstract: true,
      // allow flags on Activities as well as Start/End events
      extends: [ 'bpmn:Activity', 'bpmn:StartEvent', 'bpmn:EndEvent' ],
      properties: [
        // Flowable engine execution flags
        { name: 'async', isAttr: true, type: 'Boolean' },
        { name: 'exclusive', isAttr: true, type: 'Boolean' },
        { name: 'asyncLeave', isAttr: true, type: 'Boolean' },
        { name: 'asyncLeaveExclusive', isAttr: true, type: 'Boolean' },
        // keep legacy aliases for compatibility (no UI)
        { name: 'asyncBefore', isAttr: true, type: 'Boolean' },
        { name: 'asyncAfter', isAttr: true, type: 'Boolean' }
      ]
    },
    {
      name: 'EventCorrelationParameter',
      // flowable:eventCorrelationParameter inside extensionElements
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'name', isAttr: true, type: 'String' },
        { name: 'value', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'SendSynchronously',
      // flowable:sendSynchronously inside extensionElements (text body, prefer CDATA on export)
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'value', isBody: true, type: 'String' }
      ]
    },
    {
      name: 'SystemChannel',
      // flowable:systemChannel inside extensionElements (no attributes/body required)
      isAbstract: false,
      superClass: [ 'Element' ]
    },
    {
      name: 'EventType',
      // flowable:eventType inside extensionElements (text body, prefer CDATA on export)
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'value', isBody: true, type: 'String' }
      ]
    },
    {
      name: 'EventInParameter',
      // flowable:eventInParameter inside extensionElements
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'source', isAttr: true, type: 'String' },
        { name: 'target', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'EventOutParameter',
      // flowable:eventOutParameter inside extensionElements
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'source', isAttr: true, type: 'String' },
        { name: 'target', isAttr: true, type: 'String' },
        { name: 'transient', isAttr: true, type: 'Boolean' }
      ]
    },
    {
      name: 'MultiInstanceLoopCharacteristicsProps',
      isAbstract: true,
      // extend BPMN multi-instance loop characteristics with Flowable attributes
      extends: [ 'bpmn:MultiInstanceLoopCharacteristics' ],
      properties: [
        { name: 'collection', isAttr: true, type: 'String' },
        { name: 'elementVariable', isAttr: true, type: 'String' },
        { name: 'elementIndexVariable', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'CallActivityProps',
      isAbstract: true,
      // extend BPMN CallActivity with Flowable attributes
      extends: [ 'bpmn:CallActivity' ],
      properties: [
        // Business key expression/string
        { name: 'businessKey', isAttr: true, type: 'String' },
        // Inherit business key (UI binds here)
        { name: 'inheritBusinessKey', isAttr: true, type: 'Boolean' },
        // Future use
        { name: 'inheritVariables', isAttr: true, type: 'Boolean' },
        // Execution option
        { name: 'completeAsync', isAttr: true, type: 'Boolean' },
        // Out mapping global option
        { name: 'useLocalScopeForOutParameters', isAttr: true, type: 'Boolean' },
        // Persisted defaults (no UI)
        { name: 'sameDeployment', isAttr: true, type: 'Boolean' },
        { name: 'fallbackToDefaultTenant', isAttr: true, type: 'Boolean' }
      ]
    },
    {
      name: 'In',
      // flowable:in used in extensionElements
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'source', isAttr: true, type: 'String' },
        { name: 'sourceExpression', isAttr: true, type: 'String' },
        { name: 'target', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'Out',
      // flowable:out used in extensionElements
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'source', isAttr: true, type: 'String' },
        { name: 'sourceExpression', isAttr: true, type: 'String' },
        { name: 'target', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'ServiceTaskProps',
      isAbstract: true,
      extends: [ 'bpmn:ServiceTask' ],
      properties: [
        { name: 'delegateExpression', isAttr: true, type: 'String' },
        // External worker topic + implementation type hint
        { name: 'topic', isAttr: true, type: 'String' },
        { name: 'type', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'VariableAggregation',
      // flowable:variableAggregation inside extensionElements
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'target', isAttr: true, type: 'String' },
        { name: 'createOverviewVariable', isAttr: true, type: 'Boolean' },
        { name: 'storeAsTransientVariable', isAttr: true, type: 'Boolean' },
        // Typed children for definitions; unprefixed <variable> are prefixed on import
        { name: 'definitions', isMany: true, type: 'flowable:Variable' }
      ]
    },
    {
      name: 'Variable',
      // flowable:variable as nested child (preferred)
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        // Source/Target variable or expression (no prefix)
        { name: 'source', isAttr: true, type: 'String' },
        { name: 'target', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'VariableAggregationDefinition',
      // legacy: flowable:variableAggregationDefinition (read support)
      isAbstract: false,
      superClass: [ 'Element' ],
      properties: [
        { name: 'source', isAttr: true, type: 'String' },
        { name: 'target', isAttr: true, type: 'String' }
      ]
    }
  ]
};

export default flowableModdle;
