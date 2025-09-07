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
        { name: 'asyncBefore', isAttr: true, type: 'Boolean' },
        { name: 'asyncAfter', isAttr: true, type: 'Boolean' },
        { name: 'exclusive', isAttr: true, type: 'Boolean' }
      ]
    }
  ]
};

export default flowableModdle;

