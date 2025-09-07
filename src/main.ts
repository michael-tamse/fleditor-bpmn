import BpmnModeler from 'bpmn-js/lib/Modeler';
import type { ModdleElement } from 'bpmn-moddle';
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

  customizeProviders();
  createNew();

  modeler.on('import.done', () => {
    sanitizeModel();
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

      contextPadProvider.getContextPadEntries = function (element) {
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
      replaceMenuProvider.getEntries = function(element: any) {
        const entries = originalReplaceEntries(element) || [];
        return entries.filter((entry) => {
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

          return true;
        });
      };
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
  <bpmn:process id="Process_1" isExecutable="false">
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
      await modeler.importXML((e.target as FileReader).result as string);
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
    const { xml } = await modeler.saveXML({ format: true });
    download('diagram.bpmn', xml, 'application/xml');
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
    const scriptTasks = elementRegistry.filter((el) => el?.businessObject?.$type === 'bpmn:ScriptTask');
    scriptTasks.forEach((el) => {
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

// Drag & Drop Import
function setupDragAndDrop() {
  const target = $('#canvas');
  if (!target) return;
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    target.addEventListener(evt, stop, false);
  });
  target.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
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
