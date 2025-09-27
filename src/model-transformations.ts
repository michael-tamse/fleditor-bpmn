import { applyImportModelTransformations } from './bpmn-xml-utils';
import { DiagramTabState } from './types';

let modeler: any = null;

export function setModeler(m: any) {
  modeler = m;
}

const importTransformationsHandlers = new WeakMap<any, () => void>();

export function installImportModelTransformations(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const eventBus = m.get && m.get('eventBus');
    if (!eventBus) return;

    if (importTransformationsHandlers.has(m)) return;

    const handler = () => {
      try {
        applyImportModelTransformations(m);
      } catch (err) {
        console.warn('applyImportModelTransformations failed:', err);
      }
    };

    importTransformationsHandlers.set(m, handler);
    eventBus.on('import.done', handler);

    if (typeof eventBus.on === 'function' && typeof eventBus.off === 'function') {
      const teardown = () => {
        try { eventBus.off('import.done', handler); } catch {}
        importTransformationsHandlers.delete(m);
      };
      eventBus.on('diagram.destroy', teardown);
    }

    handler();
  } catch (e) {
    console.warn('installImportModelTransformations failed:', e);
  }
}

export function ensureDefaultOutboundMappingForSendTasks(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const bpmnFactory = m.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    const isSendLike = (bo: any) => {
      const t = bo && bo.$type;
      return (t === 'bpmn:SendTask' || (t === 'bpmn:ServiceTask' && bo.get && bo.get('flowable:type') === 'send-event'));
    };

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || !isSendLike(bo)) return;

      try {
        let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        if (!ext) {
          ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
          modeling.updateModdleProperties(element, bo, { extensionElements: ext });
        }
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const hasMapping = values.some((v: any) => v && v.$type === 'flowable:EventOutMapping');
        if (!hasMapping) {
          const mapping = bpmnFactory.create('flowable:EventOutMapping', {
            source: 'correlationKey',
            target: 'businessKey'
          });
          modeling.updateModdleProperties(element, ext, { values: values.concat([mapping]) });
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureDefaultOutboundMappingForSendTasks failed:', e);
  }
}

export function ensureCorrelationParameterForReceiveTasks(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const bpmnFactory = m.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || bo.$type !== 'bpmn:ReceiveTask') return;

      try {
        let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        if (!ext) {
          ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
          modeling.updateModdleProperties(element, bo, { extensionElements: ext });
        }
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const hasCorr = values.some((v: any) => v && v.$type === 'flowable:EventCorrelationParameter');
        if (!hasCorr) {
          const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
            name: 'businessKey',
            value: '${execution.getProcessInstanceBusinessKey()}'
          });
          modeling.updateModdleProperties(element, ext, { values: values.concat([corr]) });
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForReceiveTasks failed:', e);
  }
}

export function ensureCorrelationParameterForIntermediateCatchEvents(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const bpmnFactory = m.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || bo.$type !== 'bpmn:IntermediateCatchEvent') return;

      try {
        let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
        const hasEventType = values.some((v: any) => v && v.$type === 'flowable:EventType');
        const hasCorr = values.some((v: any) => v && v.$type === 'flowable:EventCorrelationParameter');

        if (hasEventType && !hasCorr) {
          if (!ext) {
            ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
            modeling.updateModdleProperties(element, bo, { extensionElements: ext });
          }
          const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
            name: 'businessKey',
            value: '${execution.getProcessInstanceBusinessKey()}'
          });
          modeling.updateModdleProperties(element, ext, { values: values.concat([corr]) });
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForIntermediateCatchEvents failed:', e);
  }
}

export function stripMessageEventDefinitionsForFlowableEvents(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    if (!elementRegistry || !modeling) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo) return;

      const isEventElement = ['bpmn:StartEvent', 'bpmn:IntermediateCatchEvent', 'bpmn:BoundaryEvent'].includes(bo.$type);
      if (!isEventElement) return;

      try {
        const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
        const hasFlowableEvent = values.some((v: any) =>
          v && (v.$type === 'flowable:EventType' || v.$type === 'flowable:EventCorrelationParameter')
        );

        if (hasFlowableEvent) {
          const defs = Array.isArray((bo as any).eventDefinitions) ? (bo as any).eventDefinitions : [];
          const nonMessageDefs = defs.filter((d: any) => d && d.$type !== 'bpmn:MessageEventDefinition');
          const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');

          if (defs.length !== nonMessageDefs.length && !hasTimer) {
            modeling.updateModdleProperties(element, bo, { eventDefinitions: nonMessageDefs });
          }
        }
      } catch {}
    });
  } catch (e) {
    console.warn('stripMessageEventDefinitionsForFlowableEvents failed:', e);
  }
}

export function ensureCorrelationParameterForStartEvents(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const bpmnFactory = m.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || bo.$type !== 'bpmn:StartEvent') return;

      try {
        let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
        const hasEventType = values.some((v: any) => v && v.$type === 'flowable:EventType');
        const hasCorr = values.some((v: any) => v && v.$type === 'flowable:EventCorrelationParameter');

        if (hasEventType && !hasCorr) {
          if (!ext) {
            ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
            modeling.updateModdleProperties(element, bo, { extensionElements: ext });
          }
          const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
            name: 'businessKey',
            value: '${execution.getProcessInstanceBusinessKey()}'
          });
          modeling.updateModdleProperties(element, ext, { values: values.concat([corr]) });
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForStartEvents failed:', e);
  }
}

export function ensureCorrelationParameterForBoundaryEvents(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const bpmnFactory = m.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || bo.$type !== 'bpmn:BoundaryEvent') return;

      try {
        const defs = Array.isArray((bo as any).eventDefinitions) ? (bo as any).eventDefinitions : [];
        const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
        const hasError = defs.some((d: any) => d && d.$type === 'bpmn:ErrorEventDefinition');

        if (!hasTimer && !hasError) {
          let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
          const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
          const hasCorr = values.some((v: any) => v && v.$type === 'flowable:EventCorrelationParameter');

          if (!hasCorr) {
            if (!ext) {
              ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
              modeling.updateModdleProperties(element, bo, { extensionElements: ext });
            }
            const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
              name: 'businessKey',
              value: '${execution.getProcessInstanceBusinessKey()}'
            });
            modeling.updateModdleProperties(element, ext, { values: values.concat([corr]) });
          }
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForBoundaryEvents failed:', e);
  }
}

export function ensureSystemChannelForSendTasks(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const bpmnFactory = m.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    const isSendLike = (bo: any) => {
      const t = bo && bo.$type;
      return (t === 'bpmn:SendTask' || (t === 'bpmn:ServiceTask' && bo.get && bo.get('flowable:type') === 'send-event'));
    };

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || !isSendLike(bo)) return;

      try {
        let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        if (!ext) {
          ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
          modeling.updateModdleProperties(element, bo, { extensionElements: ext });
        }
        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const hasChannel = values.some((v: any) => v && v.$type === 'flowable:SystemChannel');
        if (!hasChannel) {
          const channel = bpmnFactory.create('flowable:SystemChannel');
          modeling.updateModdleProperties(element, ext, { values: values.concat([channel]) });
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureSystemChannelForSendTasks failed:', e);
  }
}

export function ensureDmnDefaultsForDecisionTasks(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    if (!elementRegistry || !modeling) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    const isDmnTask = (bo: any) => {
      const t = bo && bo.$type;
      return (t === 'bpmn:BusinessRuleTask' || (t === 'bpmn:ServiceTask' && bo.get && bo.get('flowable:type') === 'dmn'));
    };

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || !isDmnTask(bo)) return;

      try {
        const get = (k: string) => (bo.get ? bo.get(k) : (bo as any)[k]);
        const updates: any = {};

        if (!get('flowable:decisionTable')) {
          updates['flowable:decisionTable'] = 'decision-table-key';
        }
        if (!get('flowable:decisionTableResultVariable')) {
          updates['flowable:decisionTableResultVariable'] = 'decisionResult';
        }

        if (Object.keys(updates).length) {
          modeling.updateProperties(element, updates);
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureDmnDefaultsForDecisionTasks failed:', e);
  }
}

export function migrateAsyncFlags(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    if (!elementRegistry || !modeling) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo) return;

      try {
        const get = (k: string) => (bo.get ? bo.get(k) : (bo as any)[k]);
        const updates: any = {};

        if (get('flowable:asyncBefore') === true && !get('flowable:async')) {
          updates['flowable:async'] = true;
          updates['flowable:asyncBefore'] = undefined;
        }
        if (get('flowable:asyncAfter') === true && !get('flowable:asyncLeave')) {
          updates['flowable:asyncLeave'] = true;
          updates['flowable:asyncAfter'] = undefined;
        }

        if (Object.keys(updates).length) {
          modeling.updateProperties(element, updates);
        }
      } catch {}
    });
  } catch (e) {
    console.warn('migrateAsyncFlags failed:', e);
  }
}

export function ensureCallActivityDefaults(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    if (!elementRegistry || !modeling) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || bo.$type !== 'bpmn:CallActivity') return;

      try {
        const get = (k: string) => (bo.get ? bo.get(k) : (bo as any)[k]);
        const updates: any = {};

        if (typeof get('flowable:inheritBusinessKey') === 'undefined') {
          updates['flowable:inheritBusinessKey'] = true;
        }
        if (typeof get('flowable:inheritVariables') === 'undefined') {
          updates['flowable:inheritVariables'] = true;
        }

        if (Object.keys(updates).length) {
          modeling.updateProperties(element, updates);
        }
      } catch {}
    });
  } catch (e) {
    console.warn('ensureCallActivityDefaults failed:', e);
  }
}

export function pruneInvalidCallActivityMappings(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const elementRegistry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    if (!elementRegistry || !modeling) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    all.forEach((element: any) => {
      const bo = element && element.businessObject;
      if (!bo || bo.$type !== 'bpmn:CallActivity') return;

      try {
        const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
        if (!ext) return;

        const values = (ext.get ? ext.get('values') : ext.values) || [];
        const validValues = values.filter((v: any) => {
          if (!v) return false;
          if (v.$type === 'flowable:In') {
            return !!(v.target && (v.source || v.expression));
          }
          if (v.$type === 'flowable:Out') {
            return !!(v.source && v.target);
          }
          return true;
        });

        if (validValues.length !== values.length) {
          modeling.updateModdleProperties(element, ext, { values: validValues });
        }
      } catch {}
    });
  } catch (e) {
    console.warn('pruneInvalidCallActivityMappings failed:', e);
  }
}

export function applyPreExportConfigurations(currentModeler?: any) {
  const m = currentModeler || modeler;
  if (!m) return;

  ensureDefaultOutboundMappingForSendTasks(m);
  ensureCorrelationParameterForReceiveTasks(m);
  ensureCorrelationParameterForIntermediateCatchEvents(m);
  ensureCorrelationParameterForStartEvents(m);
  ensureCorrelationParameterForBoundaryEvents(m);
  ensureSystemChannelForSendTasks(m);
  ensureDmnDefaultsForDecisionTasks(m);
  migrateAsyncFlags(m);
  ensureCallActivityDefaults(m);
  pruneInvalidCallActivityMappings(m);
}
