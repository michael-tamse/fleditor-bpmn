import { bindModelerEvents, bindDmnTabEvents } from './change-tracker';
import { applyPropertyPanelVisibility } from './ui-controls';
import {
  deriveProcessId,
  deriveDmnId,
  applyImportTransformations
} from './bpmn-xml-utils';
import { installImportModelTransformations } from './model-transformations';
export { sanitizeModel } from './bpmn-xml-utils';

import { DiagramTabState, DiagramInit } from './types';

let modeler: any = null;

export function setModeler(m: any) {
  modeler = m;
}

export function bindDragAndDrop(state: DiagramTabState) {
  const target = state.canvasEl;
  if (!target) return;
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    target.addEventListener(evt, stop, false);
  });
  target.addEventListener('drop', (e: Event) => {
    const file = (e as DragEvent).dataTransfer?.files?.[0];
    if (file) {
      const openFileIntoState = (window as any).openFileIntoState;
      if (openFileIntoState) openFileIntoState(file, state);
    }
  });
}

export function handleShapeAdded(state: DiagramTabState, e: any) {
  const runWithState = (window as any).runWithState;
  if (!runWithState) return;

  runWithState(state, () => {
    const el = e && e.element;
    const bo = el && el.businessObject;
    if (!bo) return;
    try {
      if (bo.$type === 'bpmn:ReceiveTask') {
        const bpmnFactory = modeler.get('bpmnFactory');
        const modeling = modeler.get('modeling');
        const eventBus = modeler.get('eventBus');
        if (bpmnFactory && modeling) {
          let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
          if (!ext) {
            ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
            modeling.updateModdleProperties(el, bo, { extensionElements: ext });
          }
          const values = (ext.get ? ext.get('values') : ext.values) || [];
          const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
          if (!hasCorr) {
            const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
              name: 'businessKey',
              value: '${execution.getProcessInstanceBusinessKey()}'
            });
            modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) });
            try { eventBus && (eventBus as any).fire && (eventBus as any).fire('elements.changed', { elements: [ el ] }); } catch {}
          }
        }
      }
      if (bo.$type === 'bpmn:IntermediateCatchEvent') {
        const bpmnFactory = modeler.get('bpmnFactory');
        const modeling = modeler.get('modeling');
        const eventBus = modeler.get('eventBus');
        if (bpmnFactory && modeling) {
          let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
          if (!ext) {
            ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
            modeling.updateModdleProperties(el, bo, { extensionElements: ext });
          }
          const values = (ext.get ? ext.get('values') : ext.values) || [];
          const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
          if (!hasCorr) {
            const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
              name: 'businessKey',
              value: '${execution.getProcessInstanceBusinessKey()}'
            });
            modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) });
            try { eventBus && (eventBus as any).fire && (eventBus as any).fire('elements.changed', { elements: [ el ] }); } catch {}
          }
        }
      }
      if (bo.$type === 'bpmn:BoundaryEvent') {
        const bpmnFactory = modeler.get('bpmnFactory');
        const modeling = modeler.get('modeling');
        const eventBus = modeler.get('eventBus');
        if (bpmnFactory && modeling) {
          const defs = Array.isArray((bo as any).eventDefinitions) ? (bo as any).eventDefinitions : [];
          const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
          const hasError = defs.some((d: any) => d && d.$type === 'bpmn:ErrorEventDefinition');
          if (!hasTimer && !hasError) {
            let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
            if (!ext) {
              ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
              modeling.updateModdleProperties(el, bo, { extensionElements: ext });
            }
            const values = (ext.get ? ext.get('values') : ext.values) || [];
            const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
            if (!hasCorr) {
              const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
                name: 'businessKey',
                value: '${execution.getProcessInstanceBusinessKey()}'
              });
              modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) });
              try { eventBus && (eventBus as any).fire && (eventBus as any).fire('elements.changed', { elements: [ el ] }); } catch {}
            }
          }
        }
      }
      if (bo.$type === 'bpmn:StartEvent') {
        const bpmnFactory = modeler.get('bpmnFactory');
        const modeling = modeler.get('modeling');
        const eventBus = modeler.get('eventBus');
        if (bpmnFactory && modeling) {
          let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
          if (!ext) {
            ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
            modeling.updateModdleProperties(el, bo, { extensionElements: ext });
          }
          const values = (ext.get ? ext.get('values') : ext.values) || [];
          const hasEventType = values.some((v: any) => String(v && v.$type) === 'flowable:EventType');
          const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
          if (!hasCorr && hasEventType) {
            const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
              name: 'businessKey',
              value: '${execution.getProcessInstanceBusinessKey()}'
            });
            modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) });
            try { eventBus && (eventBus as any).fire && (eventBus as any).fire('elements.changed', { elements: [ el ] }); } catch {}
          }
        }
      }
      if (bo.$type === 'bpmn:EndEvent') {
        const bpmnFactory = modeler.get('bpmnFactory');
        const modeling = modeler.get('modeling');
        const eventBus = modeler.get('eventBus');
        if (bpmnFactory && modeling) {
          const rawDefs = bo.get ? bo.get('eventDefinitions') : (bo as any).eventDefinitions;
          const defs = Array.isArray(rawDefs) ? rawDefs : [];
          const hasError = defs.some((d: any) => d && d.$type === 'bpmn:ErrorEventDefinition');
          if (hasError) {
            let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
            if (!ext) {
              ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
              modeling.updateModdleProperties(el, bo, { extensionElements: ext });
            }
            const values = (ext.get ? ext.get('values') : ext.values) || [];
            const outMappings = values.filter((value: any) => {
              const type = String(((value && value.$type) || '')).toLowerCase();
              return type === 'flowable:out';
            });
            let didUpdate = false;
            if (!outMappings.length) {
              const mapping = bpmnFactory.create('flowable:Out', {
                source: 'errorMessage',
                target: 'errorMessage'
              });
              modeling.updateModdleProperties(el, ext, { values: values.concat([ mapping ]) });
              didUpdate = true;
            } else if (outMappings.length === 1) {
              const mapping = outMappings[0];
              const source = mapping.get ? mapping.get('source') : mapping.source;
              const sourceExpression = mapping.get ? mapping.get('sourceExpression') : mapping.sourceExpression;
              const target = mapping.get ? mapping.get('target') : mapping.target;
              if (!source && !sourceExpression && !target) {
                modeling.updateModdleProperties(el, mapping, {
                  source: 'errorMessage',
                  sourceExpression: undefined,
                  target: 'errorMessage'
                });
                didUpdate = true;
              }
            }
            if (didUpdate) {
              try { eventBus && (eventBus as any).fire && (eventBus as any).fire('elements.changed', { elements: [ el ] }); } catch {}
            }
          }
        }
      }
      if (bo.$type === 'bpmn:CallActivity') {
        const get = (k: string) => (bo.get ? bo.get(k) : (bo as any)[k]);
        const updates: any = {};
        if (typeof get('flowable:inheritBusinessKey') === 'undefined' && !get('flowable:businessKey')) updates['flowable:inheritBusinessKey'] = true;
        if (typeof get('flowable:inheritVariables') === 'undefined') updates['flowable:inheritVariables'] = true;
        if (Object.keys(updates).length) {
          const modeling = modeler.get('modeling');
          if (modeling) {
            try { modeling.updateProperties(el, updates); } catch {}
          }
        }
      }
    } catch {}
  });
}

export async function bootstrapState(state: DiagramTabState, init: DiagramInit) {
  const updateStateTitle = (window as any).updateStateTitle;
  const persistActiveTab = (window as any).persistActiveTab;
  const tabsControl = (window as any).tabsControl;
  const runWithState = (window as any).runWithState;
  const updateBaseline = (window as any).updateBaseline;
  const maybeRestoreActiveTab = (window as any).maybeRestoreActiveTab;
  const updateDmnTabTitle = (window as any).updateDmnTabTitle;
  const setStatus = (window as any).setStatus;

  if (updateStateTitle) updateStateTitle(state, init.title);
  if (typeof init.fileName === 'string') state.fileName = init.fileName;
  if (tabsControl?.getActiveId() === state.id && persistActiveTab) persistActiveTab(state);

  let xml = init.xml;
  console.log('[Debug] bootstrapState - init.xml:', typeof init.xml, init.xml ? 'HAS_VALUE' : 'EMPTY/NULL');
  console.log('[Debug] bootstrapState - init.xml content:', init.xml);

  // Fix: if init.xml is an object, it might be a DiagramInit or similar, extract the actual XML
  if (typeof xml === 'object' && xml !== null) {
    console.log('[Debug] init.xml is object, trying to extract XML string');
    xml = state.kind === 'dmn' ? initialDmnXml : initialXml; // Use fallback immediately
  }

  if (!xml) {
    xml = state.kind === 'dmn' ? initialDmnXml : initialXml;
    console.log('[Debug] bootstrapState - using fallback XML for kind:', state.kind, typeof xml, xml ? xml.substring(0, 50) + '...' : 'EMPTY/NULL');
  }

  let prepared: string;
  let inferredTitle: string | null;

  if (state.kind === 'dmn') {
    prepared = xml;
    inferredTitle = deriveDmnId(prepared);
  } else {
    prepared = init.xml ? applyImportTransformations(xml) : xml;
    inferredTitle = deriveProcessId(prepared);
  }

  console.log('[Debug] bootstrapState - prepared XML:', typeof prepared, prepared && typeof prepared === 'string' ? prepared.substring(0, 100) + '...' : 'EMPTY/NULL/NOT_STRING');

  if (inferredTitle && updateStateTitle) updateStateTitle(state, inferredTitle);

  try {
    if (state.kind === 'dmn') {
      console.log('[Debug] DMN bootstrapState - setting isImporting=true for tab:', state.id);
      state.isImporting = true;
      try {
        if (runWithState) await runWithState(state, () => state.modeler.importXML(prepared));

        const views = state.modeler.getViews();
        if (views && views.length > 0) {
          const decisionTableView = views.find((v: any) => v.type === 'decisionTable');
          if (decisionTableView) {
            await state.modeler.open(decisionTableView);
          }
        }

        if (updateDmnTabTitle) setTimeout(() => updateDmnTabTitle(state), 200);
      } finally {
        // Ensure isImporting is always reset, even if something goes wrong
        console.log('[Debug] DMN bootstrapState - setting isImporting=false for tab:', state.id);
        state.isImporting = false;
        state.lastImportTime = Date.now();
      }

    } else {
      if (runWithState) {
        console.log('[Debug] About to call importXML with:', typeof prepared, prepared?.length || 0, 'chars');
        try {
          await runWithState(state, () => state.modeler.importXML(prepared));
        } catch (importError) {
          console.error('[Debug] importXML failed:', importError);
          console.error('[Debug] XML that failed:', prepared);
          throw importError;
        }
        runWithState(state, () => {
          try {
            const canvas = state.modeler.get('canvas');
            if (!canvas) return;
            if (typeof canvas.zoom === 'function') {
              canvas.zoom('fit-viewport', 'auto');
            }
            if (typeof canvas.resized === 'function') {
              canvas.resized();
              requestAnimationFrame(() => {
                try { canvas.resized(); } catch {}
              });
            }
          } catch {}
        });

        const scheduleFit = () => {
          if (!runWithState) return;
          runWithState(state, () => {
            try {
              const canvas = state.modeler.get('canvas');
              if (!canvas) return;
              if (typeof canvas.zoom === 'function') {
                canvas.zoom('fit-viewport', 'auto');
              }
              if (typeof canvas.resized === 'function') {
                canvas.resized();
              }
            } catch {}
          });
        };

        requestAnimationFrame(scheduleFit);
        setTimeout(scheduleFit, 100);
      }
    }
    if (updateBaseline) await updateBaseline(state);
    if (init.statusMessage && tabsControl?.getActiveId() === state.id && setStatus) setStatus(init.statusMessage);
  } catch (err) {
    console.error(err);
    alert('Fehler beim Import der Datei.');
    if (tabsControl?.getActiveId() === state.id && setStatus) setStatus('Import fehlgeschlagen');
  } finally {
    if (maybeRestoreActiveTab) maybeRestoreActiveTab(state);
  }
}

export function setupModelerForState(state: DiagramTabState) {
  if (state.kind === 'dmn') {
    bindDmnTabEvents(state);
    bindDragAndDrop(state);
    return;
  }

  if (state.kind === 'event') {
    // Event tabs don't need modeler setup - they use a custom editor
    return;
  }

  const runWithState = (window as any).runWithState;
  if (runWithState) {
    runWithState(state, () => {
      try {
        const panelSvc = state.modeler.get('propertiesPanel', false);
        if (panelSvc && typeof panelSvc.attachTo === 'function') {
          panelSvc.attachTo(state.propertiesEl);
        }
      } catch {}
      customizeProviders(state.modeler);
      installImportModelTransformations(state.modeler);
    });
  }

  const listenerKey = '__flowableShapeListener';
  const hasListener = Object.prototype.hasOwnProperty.call(state, listenerKey);
  if (!hasListener) {
    try {
      const eventBus = state.modeler.get && state.modeler.get('eventBus', false);
      if (eventBus && typeof eventBus.on === 'function') {
        const handler = (event: any) => {
          try { handleShapeAdded(state, event); } catch {}
        };
        ['commandStack.shape.create.postExecute', 'commandStack.shape.append.postExecute'].forEach((type) => {
          try { eventBus.on(type, handler); } catch {}
        });
        (state as any)[listenerKey] = handler;
      }
    } catch {}
  }

  bindModelerEvents(state);
  bindDragAndDrop(state);
  applyPropertyPanelVisibility(state);
}

export function customizeProviders(currentModeler?: any) {
  try {
    const m = currentModeler || modeler;
    if (!m) return;

    const injector = m.get('injector');
    const disallowedEventKeywords = ['conditional', 'signal', 'escalation', 'cancel'];
    const matchesDisallowedEventKeyword = (value: string) => {
      const lowered = (value || '').toLowerCase();
      return disallowedEventKeywords.some((keyword) => lowered.includes(keyword));
    };
    const isDisallowedEventEntry = (key: string, entry: any) => {
      const loweredKey = (key || '').toLowerCase();
      const label = ((entry && (entry.title || (entry as any).alt || (entry as any).label || '')) + '').toLowerCase();
      const target = entry && (entry.target || {});
      const eventDefinitionType = String((target && target.eventDefinitionType) || '');
      if (eventDefinitionType && /bpmn:(Conditional|Signal|Escalation|Cancel)EventDefinition$/.test(eventDefinitionType)) {
        return true;
      }
      const targetType = String((target && target.type) || '');
      const hasEventContext = /event/.test(loweredKey) || /event/.test(label) || /Event$/.test(targetType);
      if (!hasEventContext) {
        return false;
      }
      return matchesDisallowedEventKeyword(loweredKey) || matchesDisallowedEventKeyword(label);
    };
    const isTransactionEntry = (key: string, entry: any) => {
      const loweredKey = (key || '').toLowerCase();
      const label = ((entry && (entry.title || (entry as any).alt || (entry as any).label || '')) + '').toLowerCase();
      const target = entry && (entry.target || {});
      const targetType = String((target && target.type) || '');
      if (/bpmn:Transaction$/i.test(targetType)) {
        return true;
      }
      const type = String((entry && entry.type) || '');
      if (/bpmn:Transaction$/i.test(type)) {
        return true;
      }
      return /transaction/.test(loweredKey) || /transaction/.test(label);
    };
    const isCompensationEndEntry = (key: string, entry: any) => {
      const loweredKey = (key || '').toLowerCase();
      const label = ((entry && (entry.title || (entry as any).alt || (entry as any).label || '')) + '').toLowerCase();
      const target = entry && (entry.target || {});
      const targetType = String((target && target.type) || '');
      const eventDefinitionType = String((target && target.eventDefinitionType) || '');
      if (targetType === 'bpmn:EndEvent' && /bpmn:CompensateEventDefinition$/i.test(eventDefinitionType)) {
        return true;
      }
      if (/compensation/.test(loweredKey) && /end/.test(loweredKey)) {
        return true;
      }
      if (/compensation/.test(label) && /end/.test(label)) {
        return true;
      }
      const action = entry && (entry.action || {});
      const actionOptions = (action as any).options || {};
      const actionEventDefinitionType = String(actionOptions.eventDefinitionType || '');
      const actionType = String(action.type || '');
      if (actionType === 'bpmn:EndEvent' && /bpmn:CompensateEventDefinition$/i.test(actionEventDefinitionType)) {
        return true;
      }
      return false;
    };

    const paletteProvider = injector.get('paletteProvider', false);
    const palette = m.get('palette', false);
    if (paletteProvider && typeof paletteProvider.getPaletteEntries === 'function') {
      const originalGet = paletteProvider.getPaletteEntries.bind(paletteProvider);
      paletteProvider.getPaletteEntries = function () {
        const entries = originalGet();
        const keys = Object.keys(entries);
        keys.forEach((k) => {
          if (/data-(object|store)/i.test(k)) delete entries[k];
        });
        [
          'create.data-object',
          'create.data-object-reference',
          'create.data-store',
          'create.data-store-reference',
          'create.subprocess-collapsed',
          'create.participant-expanded',
          'create.empty-pool',
          'create.expanded-pool'
        ].forEach((id) => delete (entries as any)[id]);

        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if (/script[- ]?task/i.test(k) || /\bscript\b/.test(title)) {
            delete entries[k];
          }
        });
        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if (/ad[- ]?hoc/i.test(k) || /ad[- ]?hoc/i.test(title)) {
            delete entries[k];
          }
        });
        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if ((/link/i.test(k) && /event/i.test(k)) || (/\blink\b/.test(title) && /event/.test(title))) {
            delete entries[k];
          }
          if ((/message/.test(k) && /intermediate/.test(k) && /throw/.test(k)) || (/message/.test(title) && /throw/.test(title) && /event/.test(title))) {
            delete entries[k];
          }
          if ((/message/.test(k) && /end/.test(k)) || (/message/.test(title) && /end/.test(title) && /event/.test(title))) {
            delete entries[k];
          }
        });
        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if (/sub-?process/.test(title) && /collapsed/.test(title)) delete entries[k];
        });
        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if ((/pool/.test(title) || /participant/.test(title)) && (/expanded/.test(title) || /empty/.test(title))) {
            delete entries[k];
          }
        });
        Object.keys(entries).forEach((k) => {
          if (
            isDisallowedEventEntry(k, entries[k]) ||
            isTransactionEntry(k, entries[k]) ||
            isCompensationEndEntry(k, entries[k])
          ) {
            delete entries[k];
          }
        });
        return entries;
      };
      try { console.debug && console.debug('[Palette] provider patched'); } catch {}
      try { palette && typeof palette._rebuild === 'function' && palette._rebuild(); } catch {}
    }

    const contextPadProvider = injector.get('contextPadProvider', false);
    if (contextPadProvider && typeof contextPadProvider.getContextPadEntries === 'function') {
      const originalGetCP = contextPadProvider.getContextPadEntries.bind(contextPadProvider);

      contextPadProvider.getContextPadEntries = function (element: any) {
        const entries = originalGetCP(element) || {};

        Object.keys(entries).forEach((k) => { if (/data-(object|store)/i.test(k)) delete entries[k]; });
        delete entries['append.data-object-reference'];
        delete entries['append.data-store-reference'];
        delete entries['create.data-object'];
        delete entries['create.data-store'];

        Object.keys(entries).forEach((k) => { if (/sub[- ]?process.*collapsed/i.test(k)) delete entries[k]; });
        delete entries['append.subprocess-collapsed'];

        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || '')) + '').toLowerCase();
          if (/script[- ]?task/i.test(k) || /\bscript\b/.test(title)) {
            delete entries[k];
          }
        });
        delete entries['append.script-task'];
        delete entries['create.script-task'];

        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || '')) + '').toLowerCase();
          if ((/link/i.test(k) && /event/i.test(k)) || (/\blink\b/.test(title) && /event/.test(title))) delete entries[k];
        });
        delete entries['append.intermediate-link-catch-event'];
        delete entries['append.intermediate-link-throw-event'];
        delete entries['append.message-intermediate-event'];
        delete entries['append.message-end-event'];

        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || '')) + '').toLowerCase();
          if ((/complex/i.test(k) && /gateway/i.test(k)) || (/complex/.test(title) && /gateway/.test(title))) delete entries[k];
        });
        delete entries['append.complex-gateway'];

        Object.keys(entries).forEach((k) => {
          if (
            isDisallowedEventEntry(k, entries[k]) ||
            isTransactionEntry(k, entries[k]) ||
            isCompensationEndEntry(k, entries[k])
          ) {
            delete entries[k];
          }
        });

        return entries;
      };
    }

    const replaceMenuProvider = injector.get('replaceMenuProvider', false);
    if (replaceMenuProvider && typeof replaceMenuProvider.getEntries === 'function') {
      const originalReplaceEntries = replaceMenuProvider.getEntries.bind(replaceMenuProvider);
      const originalGetHeaderEntries = (replaceMenuProvider as any).getHeaderEntries && (replaceMenuProvider as any).getHeaderEntries.bind(replaceMenuProvider);
      replaceMenuProvider.getEntries = function(element: any) {
        const entries = originalReplaceEntries(element) || [];
        return entries.filter((entry: any) => {
          const id = String(entry.id || '');
          const label = String(entry.label || '');
          const targetType = entry && entry.target && entry.target.type ? String(entry.target.type) : '';
          const isExpanded = entry && entry.target && Object.prototype.hasOwnProperty.call(entry.target, 'isExpanded')
            ? !!entry.target.isExpanded
            : undefined;
          const tgt = entry && entry.target || {};
          const isEventSub = !!tgt.isTriggeredByEvent;

          if (/data[- ]?(object|store)/i.test(id) || /data[- ]?(object|store)/i.test(label) || /Data(Object|Store)Reference$/.test(targetType)) {
            return false;
          }
          if ((targetType === 'bpmn:SubProcess' && isExpanded === false)
            || /sub[- ]?process.*collapsed/i.test(id)
            || (/sub[- ]?process/i.test(label) && /collapsed/i.test(label))) {
            return false;
          }
          if ((targetType === 'bpmn:SubProcess' && isExpanded === true && !isEventSub)
            || /replace-with-subprocess-expanded/i.test(id)
            || (/sub[- ]?process/i.test(label) && /expanded/i.test(label) && !/event/i.test(label))) {
            return false;
          }
          if (/replace-with-script-task/i.test(id) || (/script/i.test(label) && /task/i.test(label)) || /bpmn:ScriptTask$/.test(targetType)) {
            return false;
          }
          if (/pool|participant/i.test(id) || (/pool|participant/i.test(label)) || /bpmn:Participant$/.test(targetType)) {
            return false;
          }
          if (/replace-with-adhoc-subprocess|replace-with-ad-hoc-subprocess/i.test(id) || /ad[- ]?hoc/i.test(label)) {
            return false;
          }
          if ((/link/i.test(id) && /event/i.test(id)) || (/\blink\b/i.test(label) && /event/i.test(label))) {
            return false;
          }
          if (/complex[- ]?gateway/i.test(id) || (/complex/i.test(label) && /gateway/i.test(label)) || /bpmn:ComplexGateway$/.test(targetType)) {
            return false;
          }
          if ((/message/.test(id) && /intermediate/.test(id) && /throw/.test(id)) || (/message/.test(label) && /throw/.test(label) && /event/.test(label))) {
            return false;
          }
          if (targetType === 'bpmn:IntermediateThrowEvent' && entry && entry.target && entry.target.eventDefinitionType === 'bpmn:MessageEventDefinition') {
            return false;
          }
          if ((/message/.test(id) && /end/.test(id)) || (/message/.test(label) && /end/.test(label) && /event/.test(label))) {
            return false;
          }
          if (targetType === 'bpmn:EndEvent' && entry && entry.target && entry.target.eventDefinitionType === 'bpmn:MessageEventDefinition') {
            return false;
          }
          if (
            isDisallowedEventEntry(id, entry) ||
            isDisallowedEventEntry(targetType, entry) ||
            matchesDisallowedEventKeyword(label) ||
            isTransactionEntry(id, entry) ||
            isTransactionEntry(targetType, entry) ||
            isCompensationEndEntry(id, entry) ||
            isCompensationEndEntry(targetType, entry)
          ) {
            return false;
          }
          if (/toggle-loop/i.test(id) || (/\bloop\b/i.test(label) && !/multi/i.test(label))) {
            return false;
          }

          return true;
        });
      };

      if (typeof (replaceMenuProvider as any).getHeaderEntries === 'function' && originalGetHeaderEntries) {
        (replaceMenuProvider as any).getHeaderEntries = function(element: any) {
          const entries = originalGetHeaderEntries(element) || [];
          return entries.filter((e: any) => {
            const id = String((e && e.id) || '');
            const title = String((e && (e.title || e.label)) || '');
            const cls = String((e && e.className) || '');
            if (/toggle-loop/i.test(id)) return false;
            if (/\bloop\b/i.test(title) && !/multi/i.test(title)) return false;
            if (/loop/i.test(cls) && !/multi/i.test(cls)) return false;
            return true;
          });
        };
      }
    }

    const appendMenuProvider = injector.get('appendMenuProvider', false);
    if (appendMenuProvider && typeof appendMenuProvider.getPopupMenuEntries === 'function') {
      const originalAppend = appendMenuProvider.getPopupMenuEntries.bind(appendMenuProvider);
      appendMenuProvider.getPopupMenuEntries = function(element: any) {
        const entries = originalAppend(element) || {};
        Object.keys(entries).forEach((id) => {
          if (/message-(intermediate-throw|end)/.test(id)) delete entries[id];
        });
        Object.keys(entries).forEach((id) => {
          if (
            isDisallowedEventEntry(id, entries[id]) ||
            isTransactionEntry(id, entries[id]) ||
            isCompensationEndEntry(id, entries[id])
          ) {
            delete entries[id];
          }
        });
        return entries;
      };
    }

    const createMenuProvider = injector.get('createMenuProvider', false);
    if (createMenuProvider && typeof createMenuProvider.getPopupMenuEntries === 'function') {
      const originalCreate = createMenuProvider.getPopupMenuEntries.bind(createMenuProvider);
      createMenuProvider.getPopupMenuEntries = function(element?: any) {
        const entries = originalCreate(element) || {};
        Object.keys(entries).forEach((id) => {
          if (/create-message-(intermediate-throw|end)/.test(id)) delete entries[id];
        });
        Object.keys(entries).forEach((id) => {
          if (
            isDisallowedEventEntry(id, entries[id]) ||
            isTransactionEntry(id, entries[id]) ||
            isCompensationEndEntry(id, entries[id])
          ) {
            delete entries[id];
          }
        });
        return entries;
      };
    }

    const popupMenu = injector.get('popupMenu', false);
    if (popupMenu && typeof popupMenu.registerProvider === 'function') {
      const filterProvider = {
        getPopupMenuEntries(target: any) {
          return function(entries: Record<string, any>) {
            const out: Record<string, any> = {};
            const shouldRemove = (id: string, e: any) => {
              const label = ((e && e.label) ? String(e.label) : '').toLowerCase();
              return (
                /data-(object|store)-reference/.test(id) ||
                /script-task/.test(id) ||
                /(collapsed|subprocess)-subprocess/.test(id) ||
                /(expanded|collapsed)-pool/.test(id) ||
                /data\s+object\s+reference/.test(label) ||
                /data\s+store\s+reference/.test(label) ||
                (/pool/.test(label) && (/(expanded|empty)/.test(label))) ||
                (/sub\s*-?process/.test(label) && /collapsed/.test(label)) ||
                (/script/.test(label) && /task/.test(label)) ||
                isDisallowedEventEntry(id, e) ||
                isTransactionEntry(id, e) ||
                isCompensationEndEntry(id, e)
              );
            };
            Object.keys(entries).forEach((id) => {
              const e = (entries as any)[id];
              if (!shouldRemove(id, e)) out[id] = e;
            });
            return out;
          };
        }
      };
      try { console.debug && console.debug('[PopupMenu] filter provider registered'); } catch {}
      try { popupMenu.registerProvider('bpmn-append', 1 as any, filterProvider); } catch (_) { popupMenu.registerProvider('bpmn-append', filterProvider); }
      try { popupMenu.registerProvider('bpmn-create', 1 as any, filterProvider); } catch (_) { popupMenu.registerProvider('bpmn-create', filterProvider); }
    }
  } catch (e) {
    console.warn('Palette/ContextPad customization failed:', e);
  }
}

export const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const initialDmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:modeler="http://camunda.org/schema/modeler/1.0" id="Definitions_1" name="DRD" namespace="http://camunda.org/schema/1.0/dmn" exporter="Camunda Modeler" exporterVersion="5.25.0" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.5.0">
  <decision id="Decision_1" name="Decision 1">
    <decisionTable id="DecisionTable_1">
      <input id="Input_1" label="Input">
        <inputExpression id="InputExpression_1" typeRef="string">
          <text></text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Output" typeRef="string" />
    </decisionTable>
  </decision>
</definitions>`;
