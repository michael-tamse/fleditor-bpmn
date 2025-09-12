import BpmnModeler from 'bpmn-js/lib/Modeler';
// CSS (bundled)
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';

import FlowablePropertiesProviderModule from './flowable-properties-provider';
import flowableModdle from './flowable-moddle';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const statusEl = $('#status');

let modeler: any;
let isImporting = false;

function setStatus(msg?: string) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

function initModeler() {
  if (modeler) return;

  modeler = new BpmnModeler({
    container: '#canvas',
    propertiesPanel: { parent: '#properties' },
    additionalModules: [
      BpmnPropertiesPanelModule,
      BpmnPropertiesProviderModule,
      FlowablePropertiesProviderModule
    ],
    moddleExtensions: { flowable: flowableModdle }
  });

  try {
    const panelSvc = modeler.get('propertiesPanel', false);
    if (panelSvc && typeof panelSvc.attachTo === 'function') {
      panelSvc.attachTo('#properties');
    }
  } catch (e) {}

  // Persist defaults for CallActivity on creation, avoid during import
  try {
    const eventBus = modeler.get('eventBus');
    const modeling = modeler.get('modeling');
    if (eventBus && modeling) {
      eventBus.on('import.render.start', () => { isImporting = true; });
      eventBus.on('import.done', () => { isImporting = false; });
      eventBus.on('shape.added', (e: any) => {
        if (isImporting) return;
        const el = e && e.element;
        const bo = el && el.businessObject;
        if (bo && bo.$type === 'bpmn:CallActivity') {
          const get = (k: string) => (bo.get ? bo.get(k) : (bo as any)[k]);
          const updates: any = {};
          if (typeof get('flowable:inheritBusinessKey') === 'undefined') updates['flowable:inheritBusinessKey'] = true;
          if (typeof get('flowable:inheritVariables') === 'undefined') updates['flowable:inheritVariables'] = true;
          if (Object.keys(updates).length) {
            try { modeling.updateProperties(el, updates); } catch {}
          }
        }
      });
    }
  } catch {}

  customizeProviders();
  createNew();

  modeler.on('import.done', () => {
    sanitizeModel();
    migrateAsyncFlags();
    ensureCallActivityDefaults();
  });
}

// UI customizations from existing app (palette/context pad/replacement)
function customizeProviders() {
  try {
    const injector = modeler.get('injector');

    // Palette filter
    const paletteProvider = injector.get('paletteProvider', false);
    const palette = modeler.get('palette', false);
    if (paletteProvider && typeof paletteProvider.getPaletteEntries === 'function') {
      const originalGet = paletteProvider.getPaletteEntries.bind(paletteProvider);
      paletteProvider.getPaletteEntries = function () {
        const entries = originalGet();
        const keys = Object.keys(entries);
        keys.forEach((k) => {
          if (/data-(object|store)/i.test(k)) delete entries[k];
        });
        // Explicit removes
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
        // Label/title based filtering for robustness across versions
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
        });
        // Sub-Process (collapsed) removal via label
        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if (/sub-?process/.test(title) && /collapsed/.test(title)) delete entries[k];
        });
        // Expanded/Empty Pool removal via label
        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || (v as any).alt || (v as any).label || '')) + '').toLowerCase();
          if ((/pool/.test(title) || /participant/.test(title)) && (/expanded/.test(title) || /empty/.test(title))) {
            delete entries[k];
          }
        });
        return entries;
      };
      try { console.debug && console.debug('[Palette] provider patched'); } catch {}
      // force rebuild so palette UI reflects our override
      try { palette && typeof palette._rebuild === 'function' && palette._rebuild(); } catch {}
    }

    const contextPadProvider = injector.get('contextPadProvider', false);
    if (contextPadProvider && typeof contextPadProvider.getContextPadEntries === 'function') {
      const originalGetCP = contextPadProvider.getContextPadEntries.bind(contextPadProvider);

      function isTask(element: any) {
        const t = (element && (element.type || (element.businessObject && element.businessObject.$type))) || '';
        return /Task$/.test(t);
      }

      contextPadProvider.getContextPadEntries = function (element: any) {
        const entries = originalGetCP(element) || {};

        Object.keys(entries).forEach((k) => { if (/data-(object|store)/i.test(k)) delete entries[k]; });
        delete entries['append.data-object-reference'];
        delete entries['append.data-store-reference'];
        delete entries['create.data-object'];
        delete entries['create.data-store'];

        // Remove collapsed subprocess append options globally
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

        Object.keys(entries).forEach((k) => {
          const v = entries[k];
          const title = ((v && (v.title || '')) + '').toLowerCase();
          if ((/complex/i.test(k) && /gateway/i.test(k)) || (/complex/.test(title) && /gateway/.test(title))) delete entries[k];
        });
        delete entries['append.complex-gateway'];

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

          // Remove Data Object/Store Reference
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
          // Remove Pools (Expanded/Empty/Participant)
          if (/pool|participant/i.test(id) || (/pool|participant/i.test(label)) || /bpmn:Participant$/.test(targetType)) {
            // keep generic collaboration transforms out
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
          // Remove standard Loop toggle from Change Element menu
          if (/toggle-loop/i.test(id) || (/\bloop\b/i.test(label) && !/multi/i.test(label))) {
            return false;
          }

          return true;
        });
      };

      // Also filter header toggles (icons row in the dialog)
      if (typeof (replaceMenuProvider as any).getHeaderEntries === 'function' && originalGetHeaderEntries) {
        (replaceMenuProvider as any).getHeaderEntries = function(element: any) {
          const entries = originalGetHeaderEntries(element) || [];
          // entries are array-like header items with id/className/title
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

    // Popup menu filter (Create/Append search menu)
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
                // label based fallbacks
                /data\s+object\s+reference/.test(label) ||
                /data\s+store\s+reference/.test(label) ||
                (/pool/.test(label) && (/(expanded|empty)/.test(label))) ||
                (/sub\s*-?process/.test(label) && /collapsed/.test(label)) ||
                (/script/.test(label) && /task/.test(label))
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
      // Register with very low priority so we run LAST and can prune entries
      try { popupMenu.registerProvider('bpmn-append', 1 as any, filterProvider); } catch (_) { popupMenu.registerProvider('bpmn-append', filterProvider); }
      try { popupMenu.registerProvider('bpmn-create', 1 as any, filterProvider); } catch (_) { popupMenu.registerProvider('bpmn-create', filterProvider); }
    }
  } catch (e) {
    console.warn('Palette/ContextPad customization failed:', e);
  }
}

const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
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

async function createNew() {
  try {
    await modeler.importXML(initialXml);
    const canvas = modeler.get('canvas');
    canvas.zoom('fit-viewport', 'auto');
    setStatus('Neues Diagramm geladen');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Erstellen eines neuen Diagramms');
    setStatus('Fehler beim Laden');
  }
}

async function openFile(file: File) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const raw = (e.target as FileReader).result as string;
      const pre = prefixVariableChildrenForImport(raw);
      await modeler.importXML(pre);
      sanitizeModel();
      modeler.get('canvas').zoom('fit-viewport', 'auto');
      setStatus(`Geladen: ${file.name}`);
    } catch (err) {
      console.error(err);
      alert('Fehler beim Import der Datei.');
      setStatus('Import fehlgeschlagen');
    }
  };
  reader.readAsText(file);
}

function triggerOpen() {
  const input = $('#file-input');
  if (!input) return;
  (input as HTMLInputElement).value = '';
  (input as HTMLInputElement).onchange = () => openFile((input as HTMLInputElement).files![0]);
  (input as HTMLInputElement).click();
}

async function saveXML() {
  try {
    // Persist defaults before export and prune incomplete mappings
    ensureCallActivityDefaults();
    pruneInvalidCallActivityMappings();
    const { xml } = await modeler.saveXML({ format: true });
    const withCdata = wrapConditionExpressionsInCDATA(xml);
    const withFlowableHeader = toFlowableDefinitionHeader(withCdata);
    download('diagram.bpmn', withFlowableHeader, 'application/xml');
    setStatus('XML exportiert');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Export als XML');
  }
}

async function saveSVG() {
  try {
    const { svg } = await modeler.saveSVG();
    download('diagram.svg', svg, 'image/svg+xml');
    setStatus('SVG exportiert');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Export als SVG');
  }
}

function download(filename: string, data: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Ensure all conditionExpression bodies are wrapped in CDATA
function wrapConditionExpressionsInCDATA(xml: string): string {
  try {
    const re = /(<(?:[\w-]+:)?conditionExpression\b[^>]*>)([\s\S]*?)(<\/(?:[\w-]+:)?conditionExpression>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      const unescaped = trimmed
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      return `${open}<![CDATA[${unescaped}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Prefix unqualified <variable> children inside <flowable:variableAggregation> for import,
// so the moddle maps them to flowable:Variable. We remove the prefix again on export.
function prefixVariableChildrenForImport(xml: string): string {
  try {
    const re = /(\<flowable:variableAggregation\b[\s\S]*?\>)([\s\S]*?)(\<\/flowable:variableAggregation\>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const transformed = inner
        .replace(/<\s*variable\b/g, '<flowable:variable')
        .replace(/<\/(\s*)variable\s*>/g, '</flowable:variable>');
      return `${open}${transformed}${close}`;
    });
  } catch {
    return xml;
  }
}

// Convert the root <definitions> to Flowable Cloud-style header and normalize DI prefixes
function toFlowableDefinitionHeader(xml: string): string {
  try {
    let out = xml;
    // Extract existing definitions id if present
    const idMatch = out.match(/<((?:[a-zA-Z_][\w-]*:)?)definitions\b[^>]*\bid="([^"]+)"/);
    const defId = idMatch ? idMatch[2] : 'Definitions_1';

    // Build Flowable-style opening tag. Keep xmlns:bpmn to satisfy xsi:type="bpmn:*" usages inside.
    const openTag = [
      '<definitions',
      'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"',
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
      'xmlns:flowable="http://flowable.org/bpmn"',
      'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"',
      'xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"',
      'xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"',
      'xmlns:design="http://flowable.org/design"',
      // keep bpmn prefix mapping for xsi:type references
      'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
      'typeLanguage="http://www.w3.org/2001/XMLSchema"',
      'expressionLanguage="http://www.w3.org/1999/XPath"',
      'targetNamespace="http://flowable.org/test"',
      'exporter="Flowable Design"',
      'exporterVersion="2025.1.02"',
      'design:palette="flowable-work-process-palette"',
      `id="${defId}">`
    ].join(' ');

    // Replace opening <definitions ...>
    out = out.replace(/<((?:[a-zA-Z_][\w-]*:)?)definitions\b[^>]*>/, openTag);

    // Replace closing tag
    out = out.replace(/<\/((?:[a-zA-Z_][\w-]*:)?)definitions>/, '</definitions>');

    // Normalize DC/DI prefixes to omgdc/omgdi to match Flowable header
    out = out.replace(/<\/?dc:/g, (m) => m.replace('dc:', 'omgdc:'))
             .replace(/<\/?di:/g, (m) => m.replace('di:', 'omgdi:'));

    // Strip bpmn: prefix from all BPMN element tags (keep attributes like xsi:type="bpmn:*")
    out = out.replace(/<\/?bpmn:([A-Za-z_][\w.-]*)/g, (m, name) => `${m.startsWith('</') ? '</' : '<'}${name}`);

    // Also strip flowable: prefix from <flowable:variable> to be <variable>
    out = out.replace(/<\/?flowable:variable\b/g, (m) => m.replace('flowable:variable', 'variable'));

    return out;
  } catch {
    return xml;
  }
}

function zoom(delta: number) {
  const canvas = modeler.get('canvas');
  const current = canvas.zoom();
  canvas.zoom(Math.max(0.2, Math.min(4, current + delta)));
}

function zoomReset() {
  modeler.get('canvas').zoom(1);
}

function fitViewport() {
  modeler.get('canvas').zoom('fit-viewport', 'auto');
}

// Sanitize ScriptTask -> Task
function sanitizeModel() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const bpmnReplace = modeler.get('bpmnReplace');
    if (!elementRegistry || !bpmnReplace) return;
    const scriptTasks = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ScriptTask');
    scriptTasks.forEach((el: any) => {
      try {
        bpmnReplace.replaceElement(el, { type: 'bpmn:Task' });
      } catch (e) {
        console.warn('Konnte ScriptTask nicht ersetzen:', e);
      }
    });
  } catch (e) {
    console.warn('Sanitize fehlgeschlagen:', e);
  }
}

// Migrate legacy asyncBefore/asyncAfter to Flowable async/asyncLeave
function migrateAsyncFlags() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    if (!elementRegistry || !modeling) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || !bo.get) return;
      const hasBefore = typeof bo.get('flowable:asyncBefore') !== 'undefined';
      const hasAfter = typeof bo.get('flowable:asyncAfter') !== 'undefined';
      const vBefore = !!bo.get('flowable:asyncBefore');
      const vAfter = !!bo.get('flowable:asyncAfter');
      const updates: any = {};
      let dirty = false;
      if (hasBefore) {
        if (vBefore && !bo.get('flowable:async')) { updates['flowable:async'] = true; dirty = true; }
        updates['flowable:asyncBefore'] = undefined; dirty = true;
      }
      if (hasAfter) {
        if (vAfter && !bo.get('flowable:asyncLeave')) { updates['flowable:asyncLeave'] = true; dirty = true; }
        updates['flowable:asyncAfter'] = undefined; dirty = true;
      }
      if (dirty) {
        try { modeling.updateProperties(el, updates); } catch (e) { /* ignore */ }
      }
    });
  } catch (e) {
    console.warn('Migration async flags failed:', e);
  }
}

// Persist default flowable:inheritBusinessKey="true" on CallActivity if missing
function ensureCallActivityDefaults() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    if (!elementRegistry || !modeling) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:CallActivity' || !bo.get) return;
      const updates: any = {};
      if (typeof bo.get('flowable:inheritBusinessKey') === 'undefined') updates['flowable:inheritBusinessKey'] = true;
      if (typeof bo.get('flowable:inheritVariables') === 'undefined') updates['flowable:inheritVariables'] = true;
      if (Object.keys(updates).length) {
        try { modeling.updateProperties(el, updates); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCallActivityDefaults failed:', e);
  }
}

// Remove incomplete Flowable In/Out mappings (no target or no source & no expression)
function pruneInvalidCallActivityMappings() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    const isFlowableMapping = (v: any) => {
      const t = String(v && v.$type || '');
      return /^flowable:(in|out)$/i.test(t);
    };
    const get = (o: any, key: string) => (o && (o.get ? o.get(key) : o[key]));
    const hasText = (val: any) => !!String(val || '').trim();

    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:CallActivity') return;
      const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) return;
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      if (!Array.isArray(values) || !values.length) return;

      const newValues = values.filter((v: any) => {
        if (!isFlowableMapping(v)) return true;
        const target = get(v, 'target');
        const source = get(v, 'source');
        const expr = get(v, 'sourceExpression');
        // keep only complete mappings: target AND (source XOR expression OR at least one present)
        return hasText(target) && (hasText(source) || hasText(expr));
      });

      if (newValues.length !== values.length) {
        try { modeling.updateModdleProperties(el, ext, { values: newValues }); } catch {}
      }
    });
  } catch (e) {
    console.warn('pruneInvalidCallActivityMappings failed:', e);
  }
}

// Drag & Drop Import
function setupDragAndDrop() {
  const target = $<HTMLElement>('#canvas');
  if (!target) return;
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  const dragEvents: Array<keyof HTMLElementEventMap> = ['dragenter', 'dragover', 'dragleave', 'drop'];
  dragEvents.forEach((evt) => {
    target.addEventListener(evt, stop as EventListener, false);
  });
  target.addEventListener('drop', (e: Event) => {
    const file = (e as DragEvent).dataTransfer?.files?.[0] as File | undefined;
    if (file) openFile(file);
  });
}

// Toolbar Events
$('#btn-new')?.addEventListener('click', createNew);
$('#btn-open')?.addEventListener('click', triggerOpen);
$('#btn-save-xml')?.addEventListener('click', saveXML);
$('#btn-save-svg')?.addEventListener('click', saveSVG);
$('#btn-zoom-in')?.addEventListener('click', () => zoom(+0.2));
$('#btn-zoom-out')?.addEventListener('click', () => zoom(-0.2));
$('#btn-zoom-reset')?.addEventListener('click', zoomReset);
$('#btn-fit')?.addEventListener('click', fitViewport);

setupDragAndDrop();
initModeler();
