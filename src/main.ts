import BpmnModeler from 'bpmn-js/lib/Modeler';
// CSS (bundled) - BPMN und DMN global verfügbar
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css';
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';

import FlowablePropertiesProviderModule from './flowable-properties-provider';
import flowableModdle from './flowable-moddle';
import { SidecarBridge } from './sidecar/bridge';
import { createDomTransport } from './sidecar/transports/dom';
import DmnJS from 'dmn-js/lib/Modeler';
import { createPostMessageTransport } from './sidecar/transports/postMessage';
import { Tabs } from './bpmn-tabs/tabs';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const statusEl = $('#status');

interface DiagramTabState {
  id: string;
  modeler: any;
  panelEl: HTMLElement;
  layoutEl: HTMLElement;
  canvasEl: HTMLElement;
  propertiesEl: HTMLElement;
  title: string;
  fileName?: string;
  dirty: boolean;
  baselineHash?: number;
  dirtyTimer?: any;
  isImporting: boolean;
  diagramType: 'bpmn' | 'dmn';
}

interface DiagramInit {
  title: string;
  xml?: string;
  fileName?: string;
  statusMessage?: string;
  activate?: boolean;
  diagramType?: 'bpmn' | 'dmn';
}

const tabStates = new Map<string, DiagramTabState>();
const pendingTabInits = new Map<string, DiagramInit>();
let tabsControl: Tabs | null = null;
let activeTabState: DiagramTabState | null = null;
let tabSequence = 1;
let untitledCounter = 1;

type StoredActiveMeta = { title?: string | null; fileName?: string | null };
const STORAGE_LAST_ACTIVE = 'fleditor:lastActiveTab';
let storedActiveMeta: StoredActiveMeta | null = readStoredActiveMeta();
let suspendActivePersist = !!storedActiveMeta;

let modeler: any;
let sidecar: SidecarBridge | null = null;
let sidecarConnected = false;

function hostAvailable() {
  try { return !!(sidecar && (sidecar as any).capabilities); } catch { return false; }
}
let menubarVisible = true;
let propertyPanelVisible = true;

// Debug logging (enable with ?debug=1 or localStorage.setItem('fleditor:debug','1'))
const DEBUG_ENABLED = (() => {
  try {
    const p = new URL(window.location.href).searchParams.get('debug');
    if (p === '1') return true;
    return localStorage.getItem('fleditor:debug') === '1';
  } catch {
    return false;
  }
})();
function debug(...args: any[]) {
  if (!DEBUG_ENABLED) return;
  try { console.debug('[fleditor]', ...args); } catch {}
}

function setStatus(msg?: string) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

function updateEmptyStateVisibility() {
  const el = document.querySelector<HTMLElement>('#emptyState');
  if (!el) return;
  const hasTabs = tabStates.size > 0;
  el.classList.toggle('visible', !hasTabs);
}

// Lightweight in-app confirm dialog (avoids Tauri allowlist issues)
function showConfirmDialog(
  message: string,
  title?: string,
  options?: { okLabel?: string; cancelLabel?: string; okVariant?: 'danger' | 'primary' }
): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.querySelector<HTMLElement>('#diagramTabs') || document.body;

    const overlay = document.createElement('div');
    overlay.className = 'tab-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'tab-confirm';

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent = title || 'Tab schließen?';

    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = message || '';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = options?.cancelLabel || 'Abbrechen';

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = options?.okVariant === 'primary' ? '' : 'danger';
    btnOk.textContent = options?.okLabel || 'Schließen';

    actions.append(btnCancel, btnOk);
    modal.append(titleEl, textEl, actions);
    overlay.append(modal);
    host.append(overlay);

    const cleanup = (val: boolean) => {
      try { document.removeEventListener('keydown', onKey); } catch {}
      try { overlay.remove(); } catch {}
      resolve(val);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    };
    document.addEventListener('keydown', onKey, { capture: true });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    btnCancel.addEventListener('click', () => cleanup(false));
    btnOk.addEventListener('click', () => cleanup(true));

    // Focus OK for quick keyboard confirm
    setTimeout(() => btnOk.focus(), 0);
  });
}

function getActiveState(): DiagramTabState | null {
  return activeTabState;
}

function setActiveTab(id: string | null) {
  if (!id) {
    activeTabState = null;
    modeler = null;
    persistActiveTab(null);
    return;
  }
  const state = tabStates.get(id);
  if (!state) return;
  activeTabState = state;
  modeler = state.modeler;
  applyPropertyPanelVisibility(state);
  try {
    state.modeler.get('canvas').resized();
  } catch {}
  persistActiveTab(state);
}

function readStoredActiveMeta(): StoredActiveMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_LAST_ACTIVE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredActiveMeta;
    }
  } catch {}
  return null;
}

function persistActiveTab(state: DiagramTabState | null) {
  if (suspendActivePersist) return;
  try {
    if (!state) {
      localStorage.removeItem(STORAGE_LAST_ACTIVE);
    } else {
      const payload: StoredActiveMeta = {
        title: state.title || null,
        fileName: state.fileName || null
      };
      localStorage.setItem(STORAGE_LAST_ACTIVE, JSON.stringify(payload));
    }
  } catch {}
}

function maybeRestoreActiveTab(state: DiagramTabState) {
  if (!storedActiveMeta) {
    if (suspendActivePersist) suspendActivePersist = false;
    if (tabsControl?.getActiveId() === state.id) persistActiveTab(state);
    return;
  }
  const matchesFile = storedActiveMeta.fileName && state.fileName && storedActiveMeta.fileName === state.fileName;
  const matchesTitle = storedActiveMeta.title && state.title && storedActiveMeta.title === state.title;
  suspendActivePersist = false;
  if (matchesFile || (!storedActiveMeta.fileName && matchesTitle)) {
    const targetId = state.id;
    storedActiveMeta = null;
    setTimeout(() => { tabsControl?.activate(targetId); }, 0);
  } else {
    storedActiveMeta = null;
  }
  if (tabsControl?.getActiveId() === state.id) persistActiveTab(state);
}

function updateStateTitle(state: DiagramTabState, title?: string | null) {
  const trimmed = (title || '').trim();
  if (!trimmed || state.title === trimmed) return;
  state.title = trimmed;
  tabsControl?.setTitle(state.id, trimmed);
  if (tabsControl?.getActiveId() === state.id) {
    persistActiveTab(state);
  }
}

function applyPropertyPanelVisibility(state: DiagramTabState) {
  const layout = state.layoutEl;
  if (!layout) return;
  if (propertyPanelVisible) {
    layout.classList.remove('hide-properties');
    state.propertiesEl.style.display = '';
  } else {
    layout.classList.add('hide-properties');
    state.propertiesEl.style.display = 'none';
  }
  if (tabsControl?.getActiveId() === state.id) {
    try { state.modeler.get('canvas').resized(); } catch {}
  }
}

function runWithState<T>(state: DiagramTabState, fn: () => Promise<T>): Promise<T>;
function runWithState<T>(state: DiagramTabState, fn: () => T): T;
function runWithState<T>(state: DiagramTabState, fn: () => T | Promise<T>): T | Promise<T> {
  const prev = modeler;
  modeler = state.modeler;
  let sync = true;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      sync = false;
      return (result as Promise<T>).finally(() => {
        // Only restore if this state is not the currently active tab.
        // This avoids clobbering the global modeler when activation happened meanwhile.
        const active = getActiveState();
        if (!active || active.id !== state.id) {
          modeler = prev;
        }
      });
    }
    return result;
  } finally {
    if (sync) {
      // Synchronous path: restore immediately
      modeler = prev;
    }
  }
}

function setDirtyState(state: DiagramTabState, dirty: boolean) {
  if (state.dirty === dirty) return;
  state.dirty = dirty;
  tabsControl?.markDirty(state.id, dirty);
  if (tabsControl?.getActiveId() === state.id && hostAvailable()) {
    try { sidecar?.emitEvent('doc.changed', { dirty }); debug('event: doc.changed -> host'); } catch {}
  }
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h;
}

async function updateBaseline(state: DiagramTabState) {
  try {
    const { xml } = await runWithState(state, () => state.modeler.saveXML({ format: true }));
    state.baselineHash = hashString(xml);

    let derivedTitle: string | null;
    if (state.diagramType === 'dmn') {
      derivedTitle = deriveDecisionId(xml);
    } else {
      derivedTitle = deriveProcessId(xml);
    }

    if (derivedTitle) updateStateTitle(state, derivedTitle);
    setDirtyState(state, false);
  } catch {}
}

function scheduleDirtyCheck(state: DiagramTabState) {
  if (state.dirtyTimer) clearTimeout(state.dirtyTimer);
  state.dirtyTimer = setTimeout(async () => {
    try {
      const { xml } = await runWithState(state, () => state.modeler.saveXML({ format: true }));
      if (typeof state.baselineHash === 'number') {
        setDirtyState(state, hashString(xml) !== state.baselineHash);
      } else {
        setDirtyState(state, true);
      }
    } catch {
      setDirtyState(state, true);
    }
  }, 300);
}

function scheduleDirtyCheckDmn(state: DiagramTabState) {
  if (state.dirtyTimer) clearTimeout(state.dirtyTimer);
  state.dirtyTimer = setTimeout(async () => {
    try {
      const { xml } = await runWithState(state, () => state.modeler.saveXML({ format: true }));
      if (typeof state.baselineHash === 'number') {
        setDirtyState(state, hashString(xml) !== state.baselineHash);
      } else {
        setDirtyState(state, true);
      }
    } catch {
      setDirtyState(state, true);
    }
  }, 300);
}

function bindModelerEvents(state: DiagramTabState) {
  const eventBus = state.modeler.get('eventBus');
  if (eventBus) {
    eventBus.on('commandStack.changed', () => {
      scheduleDirtyCheck(state);
      // Update tab title live when the process id changes
      try {
        const pid = runWithState(state, () => deriveProcessIdFromModel());
        if (pid) updateStateTitle(state, pid);
      } catch {}
    });
    eventBus.on('import.render.start', () => { state.isImporting = true; });
    eventBus.on('import.done', () => { state.isImporting = false; });
    eventBus.on('shape.added', (e: any) => {
      if (state.isImporting) return;
      handleShapeAdded(state, e);
    });
  }

  state.modeler.on('import.done', () => {
    runWithState(state, () => {
      sanitizeModel();
      migrateAsyncFlags();
      ensureCallActivityDefaults();
    });
  });
}

function bindDmnTabEvents(state: DiagramTabState) {
  // DMN-js Standard-Events wie im Original
  try {
    state.modeler.on('views.changed', () => {
      scheduleDirtyCheckDmn(state);
    });

    state.modeler.on('view.contentChanged', () => {
      scheduleDirtyCheckDmn(state);
    });
  } catch (e) {
    console.warn('Failed to bind DMN events:', e);
  }
}

function handleShapeAdded(state: DiagramTabState, e: any) {
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

function bindDragAndDrop(state: DiagramTabState) {
  const target = state.canvasEl;
  if (!target) return;
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    target.addEventListener(evt, stop, false);
  });
  target.addEventListener('drop', (e: Event) => {
    const file = (e as DragEvent).dataTransfer?.files?.[0];
    if (file) {
      openFileIntoState(file, state);
    }
  });
}

async function bootstrapState(state: DiagramTabState, init: DiagramInit) {
  updateStateTitle(state, init.title);
  if (typeof init.fileName === 'string') state.fileName = init.fileName;
  if (tabsControl?.getActiveId() === state.id) persistActiveTab(state);

  let xml = init.xml;
  if (!xml) {
    xml = initialXml;
  }

  let prepared: string;
  let inferredTitle: string | null;

  if (state.diagramType === 'dmn') {
    prepared = xml;
    inferredTitle = deriveDecisionId(prepared);
  } else {
    prepared = init.xml ? normalizeErrorRefOnImport(expandSubProcessShapesInDI(prefixVariableChildrenForImport(xml))) : xml;
    inferredTitle = deriveProcessId(prepared);
  }

  if (inferredTitle) updateStateTitle(state, inferredTitle);

  try {
    if (state.diagramType === 'dmn') {
      // DMN Standard-Import
      await runWithState(state, () => state.modeler.importXML(prepared));

      // Automatisch zur Decision Table View wechseln
      const views = state.modeler.getViews();
      if (views && views.length > 0) {
        const decisionTableView = views.find((v: any) => v.type === 'decisionTable');
        if (decisionTableView) {
          await state.modeler.open(decisionTableView);
        }
      }
    } else {
      await runWithState(state, () => state.modeler.importXML(prepared));
      runWithState(state, () => {
        try { state.modeler.get('canvas').zoom('fit-viewport', 'auto'); } catch {}
      });
    }
    await updateBaseline(state);
    if (init.statusMessage && tabsControl?.getActiveId() === state.id) setStatus(init.statusMessage);
  } catch (err) {
    console.error(err);
    alert('Fehler beim Import der Datei.');
    if (tabsControl?.getActiveId() === state.id) setStatus('Import fehlgeschlagen');
  } finally {
    maybeRestoreActiveTab(state);
  }
}

function setupModelerForState(state: DiagramTabState) {
  if (state.diagramType === 'dmn') {
    // DMN Web Component handles its own events
    bindDmnTabEvents(state);
    bindDragAndDrop(state);
    return;
  }

  // BPMN-specific setup
  runWithState(state, () => {
    try {
      const panelSvc = state.modeler.get('propertiesPanel', false);
      if (panelSvc && typeof panelSvc.attachTo === 'function') {
        panelSvc.attachTo(state.propertiesEl);
      }
    } catch {}
    customizeProviders();
  });
  bindModelerEvents(state);
  bindDragAndDrop(state);
  applyPropertyPanelVisibility(state);
}

function createDiagramTab(init: DiagramInit) {
  if (!tabsControl) return;
  const id = `diagram-${tabSequence++}`;
  pendingTabInits.set(id, init);
  tabsControl.add({ id, title: init.title, closable: true });
  if (init.activate !== false) {
    tabsControl.activate(id);
  }
}

function initTabs() {
  const root = $('#diagramTabs');
  if (!root) {
    console.error('Tab-Container nicht gefunden');
    return;
  }

  tabsControl = new Tabs(root as HTMLElement, {
    onCreatePanel(id, panel) {
      const layout = document.createElement('div');
      layout.className = 'diagram-pane';

      const diagramType = pendingTabInits.get(id)?.diagramType || 'bpmn';

      const canvas = document.createElement('div');
      canvas.className = diagramType === 'dmn' ? 'canvas dmn-canvas' : 'canvas';
      canvas.setAttribute('aria-label', diagramType === 'dmn' ? 'DMN Arbeitsfläche' : 'BPMN Arbeitsfläche');

      const props = document.createElement('aside');
      props.className = 'properties';
      props.setAttribute('aria-label', 'Eigenschaften');

      layout.append(canvas, props);
      panel.appendChild(layout);

      let instance: any;
      if (diagramType === 'dmn') {
        // Create DMN instance direkt wie BPMN - ohne Web Component
        instance = new DmnJS({
          container: canvas,
          keyboard: { bindTo: window }
        });
      } else {
        instance = new BpmnModeler({
          container: canvas,
          propertiesPanel: { parent: props },
          additionalModules: [
            BpmnPropertiesPanelModule,
            BpmnPropertiesProviderModule,
            FlowablePropertiesProviderModule
          ],
          moddleExtensions: { flowable: flowableModdle }
        });
      }

      const state: DiagramTabState = {
        id,
        modeler: instance,
        panelEl: panel,
        layoutEl: layout,
        canvasEl: canvas,
        propertiesEl: props,
        title: '',
        dirty: false,
        isImporting: false,
        diagramType
      };

      tabStates.set(id, state);
      setupModelerForState(state);
      updateEmptyStateVisibility();

      const init = pendingTabInits.get(id) ?? {
        title: diagramType === 'dmn' ? `Entscheidung ${tabSequence}` : `Diagramm ${tabSequence}`,
        xml: diagramType === 'dmn' ? initialDmnXml : initialXml,
        statusMessage: diagramType === 'dmn' ? 'Neue DMN Entscheidungstabelle geladen' : 'Neues Diagramm geladen',
        diagramType
      };
      pendingTabInits.delete(id);

      bootstrapState(state, init).catch((err) => {
        console.error(err);
      });
    },
    onActivate(id) {
      setActiveTab(id ?? null);
      // DMN wird jetzt wie BPMN behandelt - keine spezielle Attach/Detach-Logik nötig
    },
    async onClose(id) {
      const state = tabStates.get(id);
      if (!state) return true;
      if (!state.dirty) return true;
      let pid: string | null = null;
      try { pid = runWithState(state, () => deriveProcessIdFromModel()) as any; } catch {}
      const titleMsg = `${pid ? `[${pid}] ` : ''}Tab schließen?`;
      return await showConfirmDialog('Es gibt ungespeicherte Änderungen. Tab trotzdem schließen?', titleMsg);
    },
    onDestroyPanel(id) {
      pendingTabInits.delete(id);
      const state = tabStates.get(id);
      if (!state) return;
      if (state.dirtyTimer) clearTimeout(state.dirtyTimer);

      // DMN cleanup wie BPMN - keine spezielle Logik nötig

      try {
        state.modeler.destroy();
      } catch {}
      tabStates.delete(id);
      if (activeTabState && activeTabState.id === id) {
        activeTabState = null;
        modeler = null;
      }
      updateEmptyStateVisibility();
    },
    onAddRequest(diagramType: 'bpmn' | 'dmn') {
      createNewDiagram(diagramType);
    }
  });
}

function createNewDiagram(diagramType: 'bpmn' | 'dmn' = 'bpmn') {
  if (diagramType === 'dmn') {
    const decisionId = `Decision_${tabSequence}`;
    const xml = createInitialDmnXmlWithDecisionId(decisionId);
    createDiagramTab({
      title: decisionId,
      xml,
      statusMessage: 'Neue DMN Entscheidungstabelle geladen',
      diagramType: 'dmn'
    });
  } else {
    const nextPid = computeNextProcessId();
    const xml = createInitialXmlWithProcessId(nextPid);
    createDiagramTab({
      title: nextPid,
      xml,
      statusMessage: 'Neues Diagramm geladen',
      diagramType: 'bpmn'
    });
  }
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

const initialDmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC/" id="Definitions_1" name="DMN" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Decision_1" name="Decision 1">
    <decisionTable id="DecisionTable_1">
      <input id="Input_1" label="Input">
        <inputExpression id="InputExpression_1" typeRef="string">
          <text>input</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Output" typeRef="string" />
      <rule id="DecisionRule_1">
        <inputEntry id="UnaryTests_1">
          <text>""</text>
        </inputEntry>
        <outputEntry id="LiteralExpression_1">
          <text>""</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_1" dmnElementRef="Decision_1">
        <dc:Bounds height="80" width="180" x="160" y="100" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;

async function openFileAsTab(file: File) {
  if (!file) return;
  try {
    const raw = await file.text();
    const fileName = sanitizeFileName(file.name || 'diagram.bpmn20.xml');
    await openXmlConsideringDuplicates(raw, fileName, 'file');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Import der Datei.');
    setStatus('Import fehlgeschlagen');
  }
}

async function openFileIntoState(file: File, state: DiagramTabState) {
  if (!file) return;
  try {
    const raw = await file.text();
    const title = file.name || state.title || `Datei ${tabSequence}`;
    await bootstrapState(state, {
      title,
      xml: raw,
      fileName: sanitizeFileName(file.name || state.fileName || 'diagram.bpmn20.xml'),
      statusMessage: file.name ? `Geladen: ${file.name}` : 'Datei geladen'
    });
    if (tabsControl?.getActiveId() === state.id) {
      setActiveTab(state.id);
    }
  } catch (err) {
    console.error(err);
    alert('Fehler beim Import der Datei.');
    setStatus('Import fehlgeschlagen');
  }
}

function triggerOpen() {
  const input = $('#file-input');
  if (!input) return;
  (input as HTMLInputElement).value = '';
  (input as HTMLInputElement).onchange = () => {
    const file = (input as HTMLInputElement).files?.[0];
    if (file) openFileAsTab(file);
  };
  (input as HTMLInputElement).click();
}

function deriveProcessId(xml: string): string | null {
  try {
    const m = /<([\w-]+:)?process\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i.exec(xml);
    return m ? m[2] : null;
  } catch { return null; }
}

function deriveDecisionId(xml: string): string | null {
  try {
    const m = /<decision\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i.exec(xml);
    return m ? m[1] : null;
  } catch { return null; }
}

// Try to read the current Process id directly from the in-memory model
function deriveProcessIdFromModel(): string | null {
  try {
    const canvas = modeler.get('canvas');
    const root = canvas && canvas.getRootElement && canvas.getRootElement();
    const bo = root && (root as any).businessObject;
    if (!bo) return null;
    // If we're directly on a Process root
    if (bo.$type === 'bpmn:Process' && bo.id) return String(bo.id);
    // Try resolving via Definitions.rootElements
    let defs: any = bo.$parent;
    while (defs && !Array.isArray((defs as any).rootElements)) defs = defs.$parent;
    const rootElements = defs && Array.isArray(defs.rootElements) ? defs.rootElements : [];
    const processEl = rootElements.find((e: any) => e && e.$type === 'bpmn:Process');
    if (processEl && processEl.id) return String(processEl.id);
    // Collaboration / Participant case: pick first participant's processRef id
    if (bo.$type === 'bpmn:Collaboration' && Array.isArray((bo as any).participants)) {
      const p = (bo as any).participants.find((x: any) => x && x.processRef && x.processRef.id);
      if (p && p.processRef && p.processRef.id) return String(p.processRef.id);
    }
  } catch {}
  return null;
}

function getProcessIdForState(state: DiagramTabState): string | null {
  try { return runWithState(state, () => deriveProcessIdFromModel()) as any; } catch { return null; }
}

function findTabByProcessId(pid: string): DiagramTabState | null {
  if (!pid) return null;
  for (const state of tabStates.values()) {
    const spid = getProcessIdForState(state);
    if (spid && spid === pid) return state;
  }
  return null;
}

function computeNextProcessId(): string {
  let maxN = 0;
  for (const state of tabStates.values()) {
    const pid = getProcessIdForState(state) || '';
    const m = /^Process_(\d+)$/.exec(pid);
    if (m) {
      const n = parseInt(m[1], 10) || 0;
      if (n > maxN) maxN = n;
    }
  }
  const next = Math.max(0, maxN) + 1;
  return `Process_${next}`;
}

function createInitialXmlWithProcessId(pid: string): string {
  try {
    // Replace process id and the BPMNPlane bpmnElement reference
    let xml = initialXml;
    xml = xml.replace(/(<bpmn:process\b[^>]*\bid=")Process_\d+("[^>]*>)/, `$1${pid}$2`);
    xml = xml.replace(/(bpmnElement=")Process_\d+(")/, `$1${pid}$2`);
    return xml;
  } catch {
    return initialXml;
  }
}

function createInitialDmnXmlWithDecisionId(decisionId: string): string {
  try {
    let xml = initialDmnXml;
    xml = xml.replace(/(<decision\s+id=")Decision_\d+("[^>]*>)/, `$1${decisionId}$2`);
    xml = xml.replace(/(dmnElementRef=")Decision_\d+(")/, `$1${decisionId}$2`);
    return xml;
  } catch {
    return initialDmnXml;
  }
}

async function openXmlConsideringDuplicates(xml: string, fileName?: string, source: 'host' | 'file' | 'unknown' = 'unknown') {
  const pid = deriveProcessId(xml);
  const existing = pid ? findTabByProcessId(pid) : null;
  if (!existing) {
    const title = pid || (fileName || `Diagramm ${tabSequence}`);
    createDiagramTab({
      title,
      xml,
      fileName: fileName ? sanitizeFileName(fileName) : undefined,
      statusMessage: source === 'host' ? 'Aus Host geladen' : (fileName ? `Geladen: ${fileName}` : 'Datei geladen')
    });
    return;
  }
  // If a different file (different fileName) shares the same process id, offer to open a new tab
  if (fileName && existing.fileName && sanitizeFileName(fileName) !== sanitizeFileName(existing.fileName)) {
    const titleMsg = `${pid ? `[${pid}] ` : ''}Gleiches Diagramm (ID) geöffnet`;
    const ok = await showConfirmDialog(
      'Ein Diagramm mit gleicher Prozess-ID ist bereits geöffnet. Neues Tab öffnen?',
      titleMsg,
      { okLabel: 'Neuer Tab', okVariant: 'primary', cancelLabel: 'Im vorhandenen Tab überschreiben' }
    );
    if (ok) {
      const title = pid || (fileName || `Diagramm ${tabSequence}`);
      createDiagramTab({
        title,
        xml,
        fileName: sanitizeFileName(fileName),
        statusMessage: source === 'host' ? 'Aus Host geladen' : (fileName ? `Geladen: ${fileName}` : 'Datei geladen')
      });
      return;
    }
  }
  // Existing tab detected; if dirty -> warn
  if (existing.dirty) {
    const titleMsg = `${pid ? `[${pid}] ` : ''}Diagramm überschreiben?`;
    const ok = await showConfirmDialog('Es gibt ungespeicherte Änderungen. Änderungen überschreiben?', titleMsg, { okLabel: 'Ja' });
    if (!ok) { setStatus('Öffnen abgebrochen'); tabsControl?.activate(existing.id); return; }
  }
  // Import into existing tab and activate it
  tabsControl?.activate(existing.id);
  await bootstrapState(existing, {
    title: pid || existing.title || 'Diagramm',
    xml,
    fileName: fileName ? sanitizeFileName(fileName) : existing.fileName,
    statusMessage: source === 'host' ? 'Aus Host geladen' : (fileName ? `Geladen: ${fileName}` : 'Datei geladen'),
    activate: true
  });
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?\"<>|\n\r]+/g, '_');
}

async function saveXML() {
  const state = getActiveState();
  if (!state) return;
  try {
    const withFlowableHeader = await prepareXmlForExport();
    // Browser default: trigger download (or use host via saveXMLWithSidecarFallback)
    debug('save: browser download fallback');
    const pid = deriveProcessId(withFlowableHeader);
    const name = sanitizeFileName(((pid || 'diagram') + '.bpmn20.xml'));
    download(name, withFlowableHeader, 'application/xml');
    state.fileName = name;
    persistActiveTab(state);
    await updateBaseline(state);
    setStatus('XML exportiert');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Export als XML');
  }
}

async function saveSVG() {
  if (!modeler) return;
  try {
    const { svg } = await modeler.saveSVG();
    // compute suggested name based on current process id
    let name = 'diagram.svg';
    try {
      const { xml } = await modeler.saveXML({ format: false });
      const pid = deriveProcessId(xml);
      name = sanitizeFileName(((pid || 'diagram') + '.svg'));
    } catch {}
    debug('save-svg: browser download fallback');
    download(name, svg, 'image/svg+xml');
    setStatus('SVG exportiert');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Export als SVG');
  }
}

async function saveSVGWithSidecarFallback() {
  if (!modeler) return;
  try {
    const { svg } = await modeler.saveSVG();
    if (hostAvailable() && sidecar) {
      // compute suggested name based on current process id
      let suggestedName = 'diagram.svg';
      try {
        const { xml } = await modeler.saveXML({ format: false });
        const pid = deriveProcessId(xml);
        suggestedName = sanitizeFileName(((pid || 'diagram') + '.svg'));
      } catch {}
      debug('save-svg: request host doc.saveSvg', { size: svg.length, suggestedName });
      const res: any = await sidecar.request('doc.saveSvg', { svg, suggestedName }, 120000);
      if (res && res.ok) {
        debug('save-svg: host ok', { path: (res && res.path) || undefined });
        setStatus('Über Host gespeichert');
        return;
      }
      if (res && res.canceled) {
        debug('save-svg: host canceled');
        setStatus('Speichern abgebrochen');
        return;
      }
      debug('save-svg: host returned not ok', res);
      setStatus('Speichern fehlgeschlagen' + ((res && res.error) ? (': ' + String(res.error)) : ''));
      // fall through to browser download fallback below
    }
  } catch (e) {
    debug('save-svg: host error/no host; fallback', e);
  }
  await saveSVG();
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

// Build Flowable-export XML (used by save + sidecar)
async function prepareXmlForExport(): Promise<string> {
  // Persist defaults before export and prune incomplete mappings
  ensureCallActivityDefaults();
  pruneInvalidCallActivityMappings();
  ensureDmnDefaultsForDecisionTasks();
  ensureSystemChannelForSendTasks();
  ensureDefaultOutboundMappingForSendTasks();
  ensureCorrelationParameterForReceiveTasks();
  ensureCorrelationParameterForIntermediateCatchEvents();
  ensureCorrelationParameterForBoundaryEvents();
  ensureCorrelationParameterForStartEvents();
  ensureStartEventCorrelationConfigurationForStartEvents();
  const { xml } = await modeler.saveXML({ format: true });
  const withCdata = wrapConditionExpressionsInCDATA(xml);
  const withEventTypeCdata = wrapEventTypeInCDATA(withCdata);
  const withSendSyncCdata = wrapSendSynchronouslyInCDATA(withEventTypeCdata);
  const withStartCfgCdata = wrapStartEventCorrelationConfigurationInCDATA(withSendSyncCdata);
  const withFlowableStringCdata = wrapFlowableStringInCDATA(withStartCfgCdata);
  const withDecisionRefCdata = wrapDecisionReferenceTypeInCDATA(withFlowableStringCdata);
  const withoutMessageDefs = stripMessageEventDefinitionsInXML(withDecisionRefCdata);
  const mappedSendTasks = mapSendTaskToServiceOnExport(withoutMessageDefs);
  const mappedBusinessRule = mapBusinessRuleToServiceDmnOnExport(mappedSendTasks);
  const withErrorRefCodes = mapErrorRefToErrorCodeOnExport(mappedBusinessRule);
  const reconciledErrors = reconcileErrorDefinitionsOnExport(withErrorRefCodes);
  const withExternalWorkerStencils = ensureExternalWorkerStencilsOnExport(reconciledErrors);
  return toFlowableDefinitionHeader(withExternalWorkerStencils);
}

// Sidecar UI helpers
function setMenubarVisible(visible: boolean) {
  menubarVisible = !!visible;
  const header = document.querySelector<HTMLElement>('header.toolbar');
  if (header) header.style.display = menubarVisible ? '' : 'none';
}

function setPropertyPanelVisible(visible: boolean) {
  propertyPanelVisible = !!visible;
  tabStates.forEach((state) => applyPropertyPanelVisibility(state));
}

async function openViaSidecarOrFile() {
  // Host-first; if not yet connected, wait briefly for handshake instead of falling back
  const waitForHostConnected = (timeoutMs = 2000) => new Promise<boolean>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (hostAvailable()) return resolve(true);
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });

  if (!hostAvailable() || !sidecar) {
    setStatus('Verbinde mit Host…');
    const connected = await waitForHostConnected(2000);
    if (!connected) {
      // Do not use fallback automatically; keep host-only as requested
      debug('open: host not connected after wait; aborting without fallback');
      setStatus('Öffnen abgebrochen (Host nicht verbunden)');
      return;
    }
  }

  // At this point we have a host; request doc.load
  try {
    debug('open: request host doc.load');
    const res: any = await sidecar!.request('doc.load', undefined, 120000);
    let xml: string | undefined;
    let fileName: string | undefined;
    let canceled = false;
    if (typeof res === 'string') {
      xml = res;
    } else if (res && typeof res === 'object') {
      if (typeof res.xml === 'string') xml = res.xml;
      if (typeof res.fileName === 'string') fileName = sanitizeFileName(res.fileName);
      if (res.canceled === true) canceled = true;
    }
    if (typeof xml === 'string' && xml.trim()) {
      debug('open: host response', { length: xml.length, fileName });
      await openXmlConsideringDuplicates(xml, fileName, 'host');
      return;
    }
    if (canceled) {
      debug('open: host canceled by user');
      setStatus('Öffnen abgebrochen');
      return;
    }
    // Host returned nothing useful; avoid fallback per request
    debug('open: host returned empty/invalid; aborting without fallback');
    setStatus('Öffnen fehlgeschlagen');
  } catch (e) {
    // Avoid fallback; surface error
    debug('open: host error; aborting without fallback', e);
    setStatus('Öffnen fehlgeschlagen');
  }
}

async function saveXMLWithSidecarFallback() {
  const state = getActiveState();
  if (!state) return;
  try {
    const xml = await prepareXmlForExport();
    if (hostAvailable() && sidecar) {
      debug('save: request host doc.save', { size: xml.length });
      const res: any = await sidecar.request('doc.save', { xml }, 120000);
      if (res && res.ok) {
        debug('save: host ok', { path: (res && res.path) || undefined });
        const path = typeof res.path === 'string' ? res.path : undefined;
        if (path) {
          const parts = path.split(/[/\\]/);
          const fileName = parts[parts.length - 1];
          if (fileName) state.fileName = fileName;
        }
        persistActiveTab(state);
        await updateBaseline(state);
        setStatus('Über Host gespeichert');
        return;
      }
      if (res && res.canceled) {
        debug('save: host canceled');
        setStatus('Speichern abgebrochen');
        return;
      }
      debug('save: host returned not ok', res);
      setStatus('Speichern fehlgeschlagen' + ((res && res.error) ? (': ' + String(res.error)) : ''));
      // fall through to browser download fallback below
    }
  } catch (e) {
    debug('save: host error/no host; fallback', e);
  }
  await saveXML();
}

function initSidecar() {
  try {
    // Prefer postMessage in iframe, else DOM transport
    const inIframe = window.parent && window.parent !== window;
    const transport = inIframe ? createPostMessageTransport(window.parent) : createDomTransport();
    sidecar = new SidecarBridge(transport, 'component');

    // Handle inbound UI ops
    sidecar.onRequest('ui.setPropertyPanel', async (p: any) => {
      setPropertyPanelVisible(!!(p && p.visible));
      // publish ui.state for host convenience
      try { sidecar?.emitEvent('ui.state', { propertyPanel: propertyPanelVisible, menubar: menubarVisible }); } catch {}
      return { ok: true };
    });
    sidecar.onRequest('ui.setMenubar', async (p: any) => {
      setMenubarVisible(!!(p && p.visible));
      try { sidecar?.emitEvent('ui.state', { propertyPanel: propertyPanelVisible, menubar: menubarVisible }); } catch {}
      return { ok: true };
    });

    // Host-initiated open of external files (e.g., OS double-click association)
    sidecar.onRequest('doc.openExternal', async (p: any) => {
      try {
        const xml = String(p?.xml ?? '');
        if (!xml.trim()) return { ok: false };
        const fileName = typeof p?.fileName === 'string' ? sanitizeFileName(p.fileName) : undefined;
        debug('open-external: received from host', { fileName, size: xml.length });
        try { setStatus(fileName ? `Host: Datei empfangen – ${fileName}` : 'Host: Datei empfangen'); } catch {}
        await openXmlConsideringDuplicates(xml, fileName, 'host');
        return { ok: true };
      } catch (e: any) {
        debug('open-external: error', String(e?.message || e));
        return { ok: false, error: String(e?.message || e) } as any;
      }
    });

    // Start handshake; if no host responds, keep retrying briefly to avoid race
    let handshakeAttempts = 0;
    const tryHandshake = () => {
      if (hostAvailable()) return;
      handshakeAttempts++;
      debug('handshake: attempt', handshakeAttempts);
      sidecar!.handshake(800).then((caps) => {
        sidecarConnected = !!caps;
        if (hostAvailable()) {
          debug('handshake: connected', { host: (sidecar as any).capabilities?.host, features: (sidecar as any).capabilities?.features });
          try { setStatus('Host verbunden'); } catch {}
          // publish initial state
          try { sidecar?.emitEvent('ui.state', { propertyPanel: propertyPanelVisible, menubar: menubarVisible }); } catch {}
          return;
        }
        if (handshakeAttempts < 16) setTimeout(tryHandshake, 250);
      }).catch(() => {
        sidecarConnected = false;
        if (handshakeAttempts < 16) setTimeout(tryHandshake, 250);
      });
    };
    tryHandshake();
  } catch (e) {
    // ignore sidecar setup errors; editor remains standalone
    sidecarConnected = false;
  }
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

// Normalize Flowable-style errorRef (holding errorCode) to proper BPMN references:
// - If errorEventDefinition@errorRef references a non-existent ID but matches an existing <error errorCode="...">,
//   replace it with that <error>'s id.
// - If no matching <error> exists, create one under <definitions> and point errorRef to it.
function normalizeErrorRefOnImport(xml: string): string {
  try {
    // Collect existing <error id=... errorCode=...>
    const idToCode = new Map<string, string>();
    const codeToId = new Map<string, string>();
    const reError = /<([\w-]+:)?error\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    while ((m = reError.exec(xml))) {
      const attrs = m[2] || '';
      const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
      const codeMatch = /\berrorCode\s*=\s*"([^"]*)"/i.exec(attrs);
      if (idMatch) {
        const id = idMatch[1];
        const code = codeMatch ? codeMatch[1] : '';
        idToCode.set(id, code);
        if (code) codeToId.set(code, id);
      }
    }

    // Track new errors to inject
    const newErrors: Array<{ id: string, code: string, name: string } > = [];

    // Replace errorRef in errorEventDefinition if needed
    const reErrDefRef = /(<([\w-]+:)?errorEventDefinition\b[^>]*\berrorRef\s*=\s*")([^"]+)(")/gi;
    let changed = false;
    const replaced = xml.replace(reErrDefRef, (full, pre, _ns, ref, post) => {
      // already an existing error ID?
      if (idToCode.has(ref)) return full;
      // treat as code: find existing error by code or create one
      let targetId = codeToId.get(ref);
      if (!targetId) {
        // generate new unique id
        const base = 'Error_' + (ref || 'code').replace(/[^A-Za-z0-9_\-]/g, '_');
        let candidate = base;
        let i = 1;
        while (idToCode.has(candidate)) { candidate = base + '_' + (++i); }
        targetId = candidate;
        idToCode.set(targetId, ref);
        codeToId.set(ref, targetId);
        newErrors.push({ id: targetId, code: ref, name: ref });
      }
      changed = true;
      return `${pre}${targetId}${post}`;
    });

    if (!changed && !newErrors.length) return xml;

    // Inject any newly created <error> elements before </definitions>
    if (newErrors.length) {
      // detect prefix used for definitions and error elements
      const defMatch = /<([\w-]+:)?definitions\b[^>]*>/i.exec(replaced);
      const ns = defMatch && defMatch[1] ? defMatch[1] : 'bpmn:';
      const injection = newErrors.map(e => `  <${ns}error id="${e.id}" name="${escapeXml(e.name)}" errorCode="${escapeXml(e.code)}" />`).join('\n');
      const reClose = /(<\/(?:[\w-]+:)?definitions>)/i;
      if (reClose.test(replaced)) {
        return replaced.replace(reClose, `${injection}\n$1`);
      } else {
        // fallback: append at end
        return replaced + `\n${injection}\n`;
      }
    }
    return replaced;
  } catch {
    return xml;
  }
}

function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Ensure flowable:eventType body is wrapped in CDATA
function wrapEventTypeInCDATA(xml: string): string {
  try {
    const re = /(<flowable:eventType\b[^>]*>)([\s\S]*?)(<\/flowable:eventType>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:sendSynchronously body is wrapped in CDATA if present
function wrapSendSynchronouslyInCDATA(xml: string): string {
  try {
    const re = /(<flowable:sendSynchronously\b[^>]*>)([\s\S]*?)(<\/flowable:sendSynchronously>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:startEventCorrelationConfiguration body is wrapped in CDATA if present
function wrapStartEventCorrelationConfigurationInCDATA(xml: string): string {
  try {
    const re = /(<flowable:startEventCorrelationConfiguration\b[^>]*>)([\s\S]*?)(<\/flowable:startEventCorrelationConfiguration>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:string body is wrapped in CDATA
function wrapFlowableStringInCDATA(xml: string): string {
  try {
    const re = /(<flowable:string\b[^>]*>)([\s\S]*?)(<\/flowable:string>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:decisionReferenceType body is wrapped in CDATA
function wrapDecisionReferenceTypeInCDATA(xml: string): string {
  try {
    const re = /(<flowable:decisionReferenceType\b[^>]*>)([\s\S]*?)(<\/flowable:decisionReferenceType>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Replace errorEventDefinition@errorRef with the actual errorCode of the referenced bpmn:Error, for Flowable compatibility
function mapErrorRefToErrorCodeOnExport(xml: string): string {
  try {
    // Build map of Error element ID -> errorCode
    const idToCode = new Map<string, string>();
    const reError = /<([\w-]+:)?error\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    while ((m = reError.exec(xml))) {
      const attrs = m[2] || '';
      const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
      const codeMatch = /\berrorCode\s*=\s*"([^"]*)"/i.exec(attrs);
      if (idMatch && codeMatch) {
        idToCode.set(idMatch[1], codeMatch[1]);
      }
    }
    if (!idToCode.size) return xml;
    // Replace errorRef values on errorEventDefinition with code if we have a match
    const reErrDef = /(<([\w-]+:)?errorEventDefinition\b[^>]*\berrorRef\s*=\s*")([^"]+)(")/gi;
    return xml.replace(reErrDef, (full, pre, _ns, ref, post) => {
      const code = idToCode.get(ref);
      if (!code) return full;
      return `${pre}${code}${post}`;
    });
  } catch {
    return xml;
  }
}

// Ensure error definitions match errorRef usage:
// - Remove unreferenced <bpmn:error> elements
// - For each errorRef without a matching <bpmn:error id="..."> create one
//   with id=name=errorCode=errorRef value
function reconcileErrorDefinitionsOnExport(xml: string): string {
  try {
    // 1) Collect referenced errorRef values (after we rewrote them to codes)
    const refs = new Set<string>();
    const reErrRef = /<([\w-]+:)?errorEventDefinition\b[^>]*\berrorRef\s*=\s*"([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = reErrRef.exec(xml))) {
      const ref = (m[2] || '').trim();
      if (ref) refs.add(ref);
    }

    // 2) Collect existing error IDs
    const existing = new Set<string>();
    const collectId = (attrs: string) => {
      const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs || '');
      return idMatch ? idMatch[1] : '';
    };
    const reErrSelf = /<([\w-]+:)?error\b([^>]*)\/>/gi;
    while ((m = reErrSelf.exec(xml))) {
      const id = collectId(m[2]);
      if (id) existing.add(id);
    }
    const reErrPair = /<([\w-]+:)?error\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?error>/gi;
    while ((m = reErrPair.exec(xml))) {
      const id = collectId(m[2]);
      if (id) existing.add(id);
    }

    // 3) Remove unreferenced errors
    const shouldKeep = (attrs: string) => {
      const id = collectId(attrs);
      return id && refs.has(id);
    };
    let out = xml.replace(reErrSelf, (full, _ns, attrs) => (shouldKeep(attrs) ? full : ''));
    out = out.replace(reErrPair, (full, _ns, attrs) => (shouldKeep(attrs) ? full : ''));

    // 4) Inject missing errors before </definitions>
    const missing = Array.from(refs).filter((id) => !existing.has(id));
    if (missing.length) {
      const defMatch = /<([\w-]+:)?definitions\b[^>]*>/i.exec(out);
      const ns = defMatch && defMatch[1] ? defMatch[1] : 'bpmn:';
      const payload = missing
        .map((id) => `  <${ns}error id="${id}" name="${id}" errorCode="${id}" />`)
        .join('\n');
      const reClose = /(<\/(?:[\w-]+:)?definitions>)/i;
      if (reClose.test(out)) {
        out = out.replace(reClose, `${payload}\n$1`);
      } else {
        out += `\n${payload}\n`;
      }
    }

    return out;
  } catch {
    return xml;
  }
}

// For ServiceTasks with flowable:type="external-worker", ensure design stencils are written
// inside extensionElements as required by Flowable Design:
//   <extensionElements>
//     <design:stencilid><![CDATA[ExternalWorkerTask]]></design:stencilid>
//     <design:stencilsuperid><![CDATA[Task]]></design:stencilsuperid>
//   </extensionElements>
function ensureExternalWorkerStencilsOnExport(xml: string): string {
  try {
    let out = xml;
    // pretty-printed block with stable indentation
    const OPEN_INDENT = '      ';
    const INNER_INDENT = '        ';
    const buildStencilBlock = (extPrefix: string) => (
      `<${extPrefix}extensionElements>\n` +
      `${INNER_INDENT}<design:stencilid><![CDATA[ExternalWorkerTask]]></design:stencilid>\n` +
      `${INNER_INDENT}<design:stencilsuperid><![CDATA[Task]]></design:stencilsuperid>\n` +
      `${OPEN_INDENT}</${extPrefix}extensionElements>`
    );

    // 1) Handle paired serviceTask with content
    const pairRe = /<(([\w-]+:)?serviceTask)\b([^>]*\bflowable:type\s*=\s*"external-worker"[^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?serviceTask>/gi;
    out = out.replace(pairRe, (_m, qname, pfxMaybe, attrs, inner) => {
      const pfx = (pfxMaybe || '');
      // Find existing extensionElements (prefixed or not)
      const extRe = /<([\w-]+:)?extensionElements\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?extensionElements>/i;
      let newInner: string;
      const extMatch = inner.match(extRe);
      if (extMatch) {
        const extPrefix = extMatch[1] || pfx;
        const extContent = extMatch[2] || '';
        // Remove existing design stencil tags and trim trailing/leading whitespace
        const cleaned = extContent
          .replace(/<design:(stencilid|stencilsuperid)\b[\s\S]*?<\/design:\1>\s*/gi, '')
          .trim();
        // Rebuild pretty block and append remaining extension content on new line if present
        const base = buildStencilBlock(extPrefix);
        const extBlock = cleaned ? `${base}\n${cleaned}` : base;
        // Ensure we replace with a block that starts on its own line
        newInner = inner.replace(extRe, extBlock);
      } else {
        const extPrefix = pfx;
        const extBlock = buildStencilBlock(extPrefix);
        // place extensionElements as the first child with proper newlines
        newInner = `\n${OPEN_INDENT}${extBlock}${inner ? `\n${inner.trimStart()}` : ''}`;
      }
      return `<${pfx}serviceTask${attrs}>${newInner}</${pfx}serviceTask>`;
    });

    // 2) Handle self-closing serviceTask
    const selfRe = /<(([\w-]+:)?serviceTask)\b([^>]*\bflowable:type\s*=\s*"external-worker"[^>]*)\/>/gi;
    out = out.replace(selfRe, (_m, _qname, pfxMaybe, attrs) => {
      const pfx = (pfxMaybe || '');
      const extBlock = buildStencilBlock(pfx);
      return `<${pfx}serviceTask${attrs}>\n${OPEN_INDENT}${extBlock}\n    </${pfx}serviceTask>`;
    });

    return out;
  } catch {
    return xml;
  }
}

// Remove messageEventDefinition only in the serialized XML for Start/IntermediateCatch/Boundary events
function stripMessageEventDefinitionsInXML(xml: string): string {
  try {
    const stripFor = (input: string, tag: string) => {
      const re = new RegExp(`(<([\\\w-]+:)?${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/([\\\w-]+:)?${tag}>)`, 'g');
      return input.replace(re, (_m, open, _ns, inner, close) => {
        const hasFlowable = /<flowable:(eventType|eventCorrelationParameter)\b/i.test(inner);
        const hasTimer = /<([\w-]+:)?timerEventDefinition\b/i.test(inner);
        if (!hasFlowable && !hasTimer) return _m;
        let stripped = inner
          .replace(/<([\w-]+:)?messageEventDefinition\b[^>]*\/>/gi, '')
          .replace(/<([\w-]+:)?messageEventDefinition\b[^>]*>[\s\S]*?<\/([\w-]+:)?messageEventDefinition>/gi, '');
        return `${open}${stripped}${close}`;
      });
    };
    let out = xml;
    out = stripFor(out, 'startEvent');
    out = stripFor(out, 'intermediateCatchEvent');
    out = stripFor(out, 'boundaryEvent');
    return out;
  } catch {
    return xml;
  }
}

// Ensure all SubProcesses are expanded on the canvas by setting BPMNShape@isExpanded="true" for their DI shapes
function expandSubProcessShapesInDI(xml: string): string {
  try {
    let out = xml;
    // collect all subprocess IDs (prefixed or unprefixed)
    const ids = new Set<string>();
    const reSub = /<([\w-]+:)?subProcess\b[^>]*\bid="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = reSub.exec(out))) {
      ids.add(m[2]);
    }
    if (!ids.size) return out;
    // for each id, force BPMNShape isExpanded="true"
    ids.forEach((id) => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reShape = new RegExp(`(<([\\w-]+:)?BPMNShape\\b[^>]*\\bbpmnElement="${esc}"[^>]*)(/?>)`, 'g');
      out = out.replace(reShape, (full, open, _ns, end) => {
        if (/\bisExpanded\s*=\s*"true"/i.test(open)) return full; // already true
        if (/\bisExpanded\s*=\s*"(?:true|false)"/i.test(open)) {
          open = open.replace(/\bisExpanded\s*=\s*"(?:true|false)"/i, 'isExpanded="true"');
          return open + end;
        }
        // inject attribute before end
        return `${open} isExpanded="true"${end}`;
      });
    });
    return out;
  } catch {
    return xml;
  }
}

// Convert bpmn:sendTask to bpmn:serviceTask with flowable:type="send-event" in the serialized XML
function mapSendTaskToServiceOnExport(xml: string): string {
  try {
    let out = xml;
    const ensureType = (attrs: string) => (/\bflowable:type\s*=/.test(attrs) ? attrs : `${attrs} flowable:type="send-event"`);
    const replaceTriplet = (prefix: string) => {
      const openSelf = new RegExp(`<${prefix}sendTask\\b([^>]*?)\\/>`, 'g');
      const open = new RegExp(`<${prefix}sendTask\\b([^>]*?)>`, 'g');
      const close = new RegExp(`</${prefix}sendTask>`, 'g');
      out = out.replace(openSelf, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)} />`);
      out = out.replace(open, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)}>`);
      out = out.replace(close, `</${prefix}serviceTask>`);
    };
    // Handle both prefixed and unprefixed forms
    replaceTriplet('bpmn:');
    replaceTriplet('');
    return out;
  } catch {
    return xml;
  }
}

// Convert bpmn:businessRuleTask to bpmn:serviceTask with flowable:type="dmn" in the serialized XML
function mapBusinessRuleToServiceDmnOnExport(xml: string): string {
  try {
    let out = xml;
    const ensureType = (attrs: string) => (/\bflowable:type\s*=/.test(attrs) ? attrs : `${attrs} flowable:type="dmn"`);
    const replaceTriplet = (prefix: string) => {
      const openSelf = new RegExp(`<${prefix}businessRuleTask\\b([^>]*?)\\/>`, 'g');
      const open = new RegExp(`<${prefix}businessRuleTask\\b([^>]*?)>`, 'g');
      const close = new RegExp(`</${prefix}businessRuleTask>`, 'g');
      out = out.replace(openSelf, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)} />`);
      out = out.replace(open, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)}>`);
      out = out.replace(close, `</${prefix}serviceTask>`);
    };
    replaceTriplet('bpmn:');
    replaceTriplet('');
    return out;
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

// Ensure first default outbound event mapping exists for SendTask / ServiceTask(send-event)
function ensureDefaultOutboundMappingForSendTasks() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    const isSendLike = (bo: any) => {
      const t = bo && bo.$type;
      if (t === 'bpmn:SendTask') return true;
      if (t === 'bpmn:ServiceTask') {
        const v = bo.get ? bo.get('flowable:type') : (bo as any)['flowable:type'];
        return v === 'send-event';
      }
      return false;
    };
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || !isSendLike(bo)) return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasEventIn = values.some((v: any) => String(v && v.$type).toLowerCase() === 'flowable:eventinparameter' || String(v && v.$type).toLowerCase() === 'flowable:eventinparameter');
      if (!hasEventIn) {
        const param = bpmnFactory.create('flowable:EventInParameter', {
          source: '${execution.getProcessInstanceBusinessKey()}',
          target: 'businessKey'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ param ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureDefaultOutboundMappingForSendTasks failed:', e);
  }
}

// Ensure a default correlation parameter exists for ReceiveTask
function ensureCorrelationParameterForReceiveTasks() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:ReceiveTask') return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForReceiveTasks failed:', e);
  }
}

// Ensure default correlation parameter for IntermediateCatchEvent before export
function ensureCorrelationParameterForIntermediateCatchEvents() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:IntermediateCatchEvent') return;
      
      // Skip timer events
      const eventDefinitions = bo && bo.eventDefinitions;
      const isTimer = Array.isArray(eventDefinitions) && eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
      if (isTimer) return;
      
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForIntermediateCatchEvents failed:', e);
  }
}

// Remove auto-added MessageEventDefinition for Flowable event-registry style events (Start/ICE/Boundary) before export
function stripMessageEventDefinitionsForFlowableEvents() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    if (!elementRegistry || !modeling) return;
    const events = elementRegistry.filter((el: any) => {
      const t = el?.businessObject?.$type;
      return t === 'bpmn:IntermediateCatchEvent' || t === 'bpmn:BoundaryEvent' || t === 'bpmn:StartEvent';
    });
    events.forEach((el: any) => {
      const bo: any = el.businessObject;
      const defs = Array.isArray(bo.eventDefinitions) ? bo.eventDefinitions : [];
      if (!defs.length) return;
      const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
      const hasMessage = defs.some((d: any) => d && d.$type === 'bpmn:MessageEventDefinition');
      if (hasTimer && hasMessage) {
        // keep only timer if both present
        const newDefs = defs.filter((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
        try { modeling.updateModdleProperties(el, bo, { eventDefinitions: newDefs }); } catch {}
        return;
      }
      // If only message def(s) present and Flowable event-registry metadata exists, strip them (we added for icon only)
      const onlyMessage = hasMessage && defs.every((d: any) => d && d.$type === 'bpmn:MessageEventDefinition');
      if (!onlyMessage) return;
      const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
      const hasFlowableMeta = values && values.some((v: any) => {
        const t = String(v && v.$type);
        return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter' || /flowable:eventOutParameter/i.test(t);
      });
      if (hasFlowableMeta) {
        try { modeling.updateModdleProperties(el, bo, { eventDefinitions: [] }); } catch {}
      }
    });
  } catch (e) {
    console.warn('stripMessageEventDefinitionsForFlowableEvents failed:', e);
  }
}

// Ensure default correlation parameter for StartEvent before export
function ensureCorrelationParameterForStartEvents() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:StartEvent') return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasEventType = values.some((v: any) => String(v && v.$type) === 'flowable:EventType');
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr && hasEventType) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForStartEvents failed:', e);
  }
}

// Ensure a startEventCorrelationConfiguration exists for StartEvent (message) before export
function ensureStartEventCorrelationConfigurationForStartEvents() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:StartEvent') return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasEventMeta = values.some((v: any) => {
        const t = String(v && v.$type);
        return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter';
      });
      const hasCfg = values.some((v: any) => String(v && v.$type) === 'flowable:StartEventCorrelationConfiguration');
      if (hasEventMeta && !hasCfg) {
        const cfg = bpmnFactory.create('flowable:StartEventCorrelationConfiguration', { value: 'startNewInstance' });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ cfg ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureStartEventCorrelationConfigurationForStartEvents failed:', e);
  }
}

// Ensure default correlation parameter for BoundaryEvent before export
function ensureCorrelationParameterForBoundaryEvents() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:BoundaryEvent') return;
      const defs = Array.isArray((bo as any).eventDefinitions) ? (bo as any).eventDefinitions : [];
      const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
      const hasError = defs.some((d: any) => d && d.$type === 'bpmn:ErrorEventDefinition');
      if (hasTimer || hasError) return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForBoundaryEvents failed:', e);
  }
}

// Ensure a <flowable:systemChannel/> exists on SendTask and on ServiceTask with flowable:type="send-event"
function ensureSystemChannelForSendTasks() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    const needsSystemChannel = (bo: any) => {
      const t = bo && bo.$type;
      if (t === 'bpmn:SendTask') return true;
      if (t === 'bpmn:ServiceTask') {
        const v = bo.get ? bo.get('flowable:type') : (bo as any)['flowable:type'];
        return v === 'send-event';
      }
      return false;
    };
    const hasSystemChannel = (bo: any) => {
      const ext = bo && (bo.get ? bo.get('extensionElements') : bo.extensionElements);
      const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
      return values.some((v: any) => v && String(v.$type) === 'flowable:SystemChannel' || String(v.$type) === 'flowable:systemChannel');
    };
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || !needsSystemChannel(bo) || hasSystemChannel(bo)) return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const sys = bpmnFactory.create('flowable:SystemChannel', {});
      try { modeling.updateModdleProperties(el, ext, { values: values.concat([ sys ]) }); } catch {}
    });
  } catch (e) {
    console.warn('ensureSystemChannelForSendTasks failed:', e);
  }
}

// Ensure DMN defaults exist on BusinessRuleTask or ServiceTask(flowable:type="dmn")
function ensureDmnDefaultsForDecisionTasks() {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    const isDmnLike = (bo: any) => {
      if (!bo) return false;
      if (bo.$type === 'bpmn:BusinessRuleTask') return true;
      if (bo.$type === 'bpmn:ServiceTask') {
        const t = bo.get ? bo.get('flowable:type') : (bo as any)['flowable:type'];
        return t === 'dmn';
      }
      return false;
    };
    const ensureExt = (el: any, bo: any) => {
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      return ext;
    };
    const getValues = (ext: any) => (ext.get ? ext.get('values') : ext.values) || [];
    const findField = (values: any[], name: string) => values.find((v: any) => v && v.$type && /flowable:field/i.test(v.$type) && ((v.get ? v.get('name') : v.name) === name));
    const setField = (el: any, ext: any, values: any[], name: string, val: string) => {
      let fld = findField(values, name);
      if (!fld) {
        fld = bpmnFactory.create('flowable:Field', { name });
        values = values.concat([ fld ]);
        try { modeling.updateModdleProperties(el, ext, { values }); } catch {}
      }
      let node = fld.get ? fld.get('string') : (fld as any).string;
      if (!node) {
        node = bpmnFactory.create('flowable:String', { value: val });
        try { modeling.updateModdleProperties(el, fld, { string: node }); } catch {}
      } else {
        try { modeling.updateModdleProperties(el, node, { value: val }); } catch {}
      }
    };
    const ensureDecisionRefType = (el: any, ext: any, values: any[]) => {
      let node = values.find((v: any) => v && v.$type && /flowable:decisionReferenceType/i.test(v.$type));
      if (!node) {
        node = bpmnFactory.create('flowable:DecisionReferenceType', { value: 'decisionTable' });
        values = values.concat([ node ]);
        try { modeling.updateModdleProperties(el, ext, { values }); } catch {}
      } else {
        try { modeling.updateModdleProperties(el, node, { value: 'decisionTable' }); } catch {}
      }
    };
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!isDmnLike(bo)) return;
      const ext = ensureExt(el, bo);
      let values = getValues(ext);
      setField(el, ext, values, 'fallbackToDefaultTenant', 'true');
      values = getValues(ext);
      setField(el, ext, values, 'sameDeployment', 'true');
      values = getValues(ext);
      ensureDecisionRefType(el, ext, values);
    });
  } catch (e) {
    console.warn('ensureDmnDefaultsForDecisionTasks failed:', e);
  }
}

function zoom(delta: number) {
  if (!modeler) return;
  const canvas = modeler.get('canvas');
  const current = canvas.zoom();
  canvas.zoom(Math.max(0.2, Math.min(4, current + delta)));
}

function zoomReset() {
  if (!modeler) return;
  modeler.get('canvas').zoom(1);
}

function fitViewport() {
  if (!modeler) return;
  modeler.get('canvas').zoom('fit-viewport', 'auto');
}

// Sanitize ScriptTask -> Task
  function sanitizeModel() {
    try {
      const elementRegistry = modeler.get('elementRegistry');
      const bpmnReplace = modeler.get('bpmnReplace');
      if (!elementRegistry || !bpmnReplace) return;
    // Map ServiceTask with flowable:type="send-event" -> SendTask for display
    try {
      const serviceSend = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ServiceTask' && (el.businessObject.get ? el.businessObject.get('flowable:type') === 'send-event' : (el.businessObject as any)['flowable:type'] === 'send-event'));
      serviceSend.forEach((el: any) => {
        try { bpmnReplace.replaceElement(el, { type: 'bpmn:SendTask' }); } catch {}
      });
    } catch (e) {
      console.warn('Send-event ServiceTask view mapping failed:', e);
    }
    // Map ServiceTask with flowable:type="dmn" -> BusinessRuleTask for display
    try {
      const serviceDmn = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ServiceTask' && (el.businessObject.get ? el.businessObject.get('flowable:type') === 'dmn' : (el.businessObject as any)['flowable:type'] === 'dmn'));
      serviceDmn.forEach((el: any) => {
        try { bpmnReplace.replaceElement(el, { type: 'bpmn:BusinessRuleTask' }); } catch {}
      });
    } catch (e) {
      console.warn('DMN ServiceTask view mapping failed:', e);
    }
    const scriptTasks = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ScriptTask');
      scriptTasks.forEach((el: any) => {
        try {
          bpmnReplace.replaceElement(el, { type: 'bpmn:Task' });
        } catch (e) {
          console.warn('Konnte ScriptTask nicht ersetzen:', e);
        }
      });

      // Ensure icon rendering for StartEvent / IntermediateCatchEvent / BoundaryEvent by adding MessageEventDefinition
      try {
        const modeling = modeler.get('modeling');
        const bpmnFactory = modeler.get('bpmnFactory');
        if (modeling && bpmnFactory) {
          const events = elementRegistry.filter((el: any) => {
            const t = el?.businessObject?.$type;
            return t === 'bpmn:IntermediateCatchEvent' || t === 'bpmn:BoundaryEvent' || t === 'bpmn:StartEvent';
          });
          events.forEach((el: any) => {
            const bo: any = el.businessObject;
            const defs = Array.isArray(bo.eventDefinitions) ? bo.eventDefinitions : [];
            if (defs.length) return;
            const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
            const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
            const hasFlowableMeta = values && values.some((v: any) => {
              const t = String(v && v.$type);
              return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter' || /flowable:eventOutParameter/i.test(t);
            });
            if (hasFlowableMeta) {
              const med = bpmnFactory.create('bpmn:MessageEventDefinition', {});
              try { modeling.updateModdleProperties(el, bo, { eventDefinitions: [ med ] }); } catch {}
            }
          });
        }
      } catch (e) {
        console.warn('Ensure MessageEventDefinition failed:', e);
      }
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
      if (typeof bo.get('flowable:inheritBusinessKey') === 'undefined' && !bo.get('flowable:businessKey')) updates['flowable:inheritBusinessKey'] = true;
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

// Toolbar Events
$('#btn-open')?.addEventListener('click', openViaSidecarOrFile);
$('#btn-save-xml')?.addEventListener('click', saveXMLWithSidecarFallback);
$('#btn-save-svg')?.addEventListener('click', saveSVGWithSidecarFallback);
$('#btn-zoom-in')?.addEventListener('click', () => zoom(+0.2));
$('#btn-zoom-out')?.addEventListener('click', () => zoom(-0.2));
$('#btn-zoom-reset')?.addEventListener('click', zoomReset);
$('#btn-fit')?.addEventListener('click', fitViewport);

initTabs();
updateEmptyStateVisibility();
initSidecar();
