(function(){
  // Resolve namespaces captured right after script loads in index.html
  const Core = window.__bjsCoreNS || window.BpmnPropertiesPanel || window.PropertiesPanel || {};
  const ProviderNS = window.__bjsProviderNS || window.BpmnPropertiesPanel || {};
  const CheckboxEntry = Core.CheckboxEntry;
  const useService = ProviderNS.useService || Core.useService;

  if (!CheckboxEntry || !useService) {
    console.warn('FlowablePropertiesProvider: required APIs not found (CheckboxEntry/useService)');
    return;
  }

  function isActivityLike(element) {
    const t = element && element.businessObject && element.businessObject.$type || '';
    return /Task$/.test(t) || /SubProcess$/.test(t) || /CallActivity$/.test(t);
  }

  function AsyncBeforeEntry(props) {
    const modeling = useService('modeling');
    const translate = useService('translate');
    const element = props.element;
    const bo = element.businessObject;
    const getValue = () => !!bo.get('flowable:asyncBefore');
    const setValue = (value) => modeling.updateProperties(element, { 'flowable:asyncBefore': !!value });
    return CheckboxEntry({ id: 'flowable-asyncBefore', element, label: translate ? translate('Async before') : 'Async before', getValue, setValue });
  }

  function AsyncAfterEntry(props) {
    const modeling = useService('modeling');
    const translate = useService('translate');
    const element = props.element;
    const bo = element.businessObject;
    const getValue = () => !!bo.get('flowable:asyncAfter');
    const setValue = (value) => modeling.updateProperties(element, { 'flowable:asyncAfter': !!value });
    return CheckboxEntry({ id: 'flowable-asyncAfter', element, label: translate ? translate('Async after') : 'Async after', getValue, setValue });
  }

  function ExclusiveEntry(props) {
    const modeling = useService('modeling');
    const translate = useService('translate');
    const element = props.element;
    const bo = element.businessObject;
    const getValue = () => !!bo.get('flowable:exclusive');
    const setValue = (value) => modeling.updateProperties(element, { 'flowable:exclusive': !!value });
    return CheckboxEntry({ id: 'flowable-exclusive', element, label: translate ? translate('Exclusive') : 'Exclusive', getValue, setValue });
  }

  function createFlowableGroup(element) {
    return {
      id: 'flowable',
      label: 'Flowable',
      entries: [
        { id: 'flowable-asyncBefore', component: AsyncBeforeEntry },
        { id: 'flowable-asyncAfter', component: AsyncAfterEntry },
        { id: 'flowable-exclusive', component: ExclusiveEntry }
      ]
    };
  }

  function FlowablePropertiesProvider(propertiesPanel) {
    this.getGroups = function(element) {
      return function(groups) {
        if (!isActivityLike(element)) return groups;
        groups.push(createFlowableGroup(element));
        return groups;
      };
    };
  }

  FlowablePropertiesProvider.$inject = [ 'propertiesPanel' ];

  window.FlowablePropertiesProviderModule = {
    __init__: [ 'flowablePropertiesProvider' ],
    flowablePropertiesProvider: [ 'type', FlowablePropertiesProvider ]
  };
})();
