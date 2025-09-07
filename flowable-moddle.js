(function(){
  // Minimal Flowable moddle descriptor for async flags
  window.FlowableModdleDescriptor = {
    name: 'Flowable',
    uri: 'http://flowable.org/bpmn',
    prefix: 'flowable',
    xml: { tagAlias: 'lowerCase' },
    types: [
      {
        name: 'AsyncCapable',
        isAbstract: true,
        extends: [ 'bpmn:Activity' ],
        properties: [
          { name: 'asyncBefore', isAttr: true, type: 'Boolean' },
          { name: 'asyncAfter', isAttr: true, type: 'Boolean' },
          { name: 'exclusive', isAttr: true, type: 'Boolean' }
        ]
      }
    ]
  };
})();

