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
        { name: 'delegateExpression', isAttr: true, type: 'String' }
      ]
    }
  ]
};

export default flowableModdle;
