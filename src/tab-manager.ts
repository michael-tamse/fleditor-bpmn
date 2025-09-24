import BpmnModeler from 'bpmn-js/lib/Modeler';
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel';
import FlowablePropertiesProviderModule from './flowable-properties-provider';
import flowableModdle from './flowable-moddle';
import { createFlowableDmnModeler } from './dmn/dmn-factory';
import { createEventEditor } from './event-editor/event-editor';
import { Tabs } from './bpmn-tabs/tabs';
import { updateEmptyStateVisibility, showConfirmDialog, updateZoomButtonsVisibility } from './ui-controls';

import { DiagramTabState, DiagramInit } from './types';

type StoredActiveMeta = { title?: string | null; fileName?: string | null };

const STORAGE_LAST_ACTIVE = 'fleditor:lastActiveTab';
const tabStates = new Map<string, DiagramTabState>();
const pendingTabInits = new Map<string, DiagramInit>();

let tabsControl: Tabs | null = null;
let activeTabState: DiagramTabState | null = null;
let tabSequence = 1;
let storedActiveMeta: StoredActiveMeta | null = readStoredActiveMeta();
let suspendActivePersist = !!storedActiveMeta;
let modeler: any = null;

export function getTabStates(): Map<string, DiagramTabState> {
  return tabStates;
}

export function getActiveState(): DiagramTabState | null {
  return activeTabState;
}

export function getTabsControl(): Tabs | null {
  return tabsControl;
}

export function getModeler(): any {
  return modeler;
}

export function setTabSequence(seq: number) {
  tabSequence = seq;
}

function updateToolbarButtons(state: DiagramTabState | null) {
  const saveXmlBtn = document.querySelector('#btn-save-xml') as HTMLButtonElement;
  const saveSvgBtn = document.querySelector('#btn-save-svg') as HTMLButtonElement;

  if (!saveXmlBtn || !saveSvgBtn) return;

  if (!state) {
    // No active tab - disable both buttons
    saveXmlBtn.disabled = true;
    saveSvgBtn.disabled = true;
    saveXmlBtn.title = 'Kein Diagramm geöffnet';
    saveSvgBtn.title = 'Kein Diagramm geöffnet';
  } else {
    // Active tab - handle different tab kinds
    if (state.kind === 'event') {
      saveXmlBtn.disabled = false;
      saveXmlBtn.title = 'Als JSON speichern';
      saveSvgBtn.disabled = true;
      saveSvgBtn.title = 'Export nicht verfügbar für Event-Definitionen';
    } else {
      saveXmlBtn.disabled = false;
      saveXmlBtn.title = state.kind === 'dmn' ? 'Als DMN speichern' : 'Als BPMN speichern';

      if (state.kind === 'bpmn') {
        saveSvgBtn.disabled = false;
        saveSvgBtn.title = 'Als SVG speichern';
      } else {
        saveSvgBtn.disabled = true;
        saveSvgBtn.title = 'SVG-Export nur für BPMN-Diagramme verfügbar';
      }
    }
  }
}

export function setActiveTab(id: string | null) {
  if (!id) {
    activeTabState = null;
    modeler = null;
    updateToolbarButtons(null);
    updateZoomButtonsVisibility();
    persistActiveTab(null);
    return;
  }
  const state = tabStates.get(id);
  if (!state) return;
  activeTabState = state;
  modeler = state.modeler;

  const applyPropertyPanelVisibility = (window as any).applyPropertyPanelVisibility;
  if (applyPropertyPanelVisibility) applyPropertyPanelVisibility(state);

  // Update toolbar buttons based on active tab type
  updateToolbarButtons(state);
  updateZoomButtonsVisibility();

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

export function persistActiveTab(state: DiagramTabState | null) {
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

export function maybeRestoreActiveTab(state: DiagramTabState) {
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

export function updateStateTitle(state: DiagramTabState, title?: string | null) {
  const trimmed = (title || '').trim();
  if (!trimmed || state.title === trimmed) return;
  state.title = trimmed;
  tabsControl?.setTitle(state.id, trimmed);
  if (tabsControl?.getActiveId() === state.id) {
    persistActiveTab(state);
  }
}

export function runWithState<T>(state: DiagramTabState, fn: () => Promise<T>): Promise<T>;
export function runWithState<T>(state: DiagramTabState, fn: () => T): T;
export function runWithState<T>(state: DiagramTabState, fn: () => T | Promise<T>): T | Promise<T> {
  const prev = modeler;
  modeler = state.modeler;
  let sync = true;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      sync = false;
      return (result as Promise<T>).finally(() => {
        const active = getActiveState();
        if (!active || active.id !== state.id) {
          modeler = prev;
        }
      });
    }
    return result;
  } finally {
    if (sync) {
      modeler = prev;
    }
  }
}

export function findTabByProcessId(pid: string): DiagramTabState | null {
  const getIdForState = (window as any).getIdForState;
  if (!getIdForState) return null;

  for (const state of tabStates.values()) {
    try {
      const id = getIdForState(state);
      if (id === pid) return state;
    } catch {}
  }
  return null;
}

export function createDiagramTab(init: DiagramInit) {
  if (!tabsControl) return;
  const id = `diagram-${tabSequence++}`;
  pendingTabInits.set(id, init);
  tabsControl.add({ id, title: init.title, closable: true });
  if (init.activate !== false) {
    tabsControl.activate(id);
  }
}

export function createNewDiagram(kind: 'bpmn' | 'dmn' | 'event' = 'bpmn') {
  if (kind === 'dmn') {
    const decisionId = `Decision_${tabSequence}`;
    const createInitialDmnXmlWithDecisionId = (window as any).createInitialDmnXmlWithDecisionId;
    const xml = createInitialDmnXmlWithDecisionId ? createInitialDmnXmlWithDecisionId(decisionId) : '';
    createDiagramTab({
      title: decisionId,
      xml,
      statusMessage: 'Neue DMN Entscheidungstabelle geladen',
      kind: 'dmn'
    });
  } else if (kind === 'event') {
    const eventId = `Event_${tabSequence}`;
    createDiagramTab({
      title: eventId,
      statusMessage: 'Neuer Event-Tab (Platzhalter)',
      kind: 'event'
    });
  } else {
    const computeNextProcessId = (window as any).computeNextProcessId;
    const createInitialXmlWithProcessId = (window as any).createInitialXmlWithProcessId;
    const nextPid = computeNextProcessId ? computeNextProcessId() : `Process_${tabSequence}`;
    const xml = createInitialXmlWithProcessId ? createInitialXmlWithProcessId(nextPid) : '';
    createDiagramTab({
      title: nextPid,
      xml,
      statusMessage: 'Neues Diagramm geladen'
    });
  }
}

export function initTabs() {
  const root = document.querySelector<HTMLElement>('#diagramTabs');
  if (!root) {
    console.error('Tab-Container nicht gefunden');
    return;
  }

  tabsControl = new Tabs(root, {
    onCreatePanel(id, panel) {
      const layout = document.createElement('div');
      layout.className = 'diagram-pane';

      const kind = pendingTabInits.get(id)?.kind || 'bpmn';

      const canvas = document.createElement('div');
      if (kind === 'dmn') {
        canvas.className = 'canvas dmn-canvas';
        canvas.setAttribute('aria-label', 'DMN Arbeitsfläche');
        canvas.style.position = 'relative';
        canvas.style.overflow = 'visible';
        canvas.style.height = '100%';
        canvas.style.width = '100%';
      } else if (kind === 'event') {
        canvas.className = 'canvas event-canvas';
        canvas.setAttribute('aria-label', 'Event Editor Arbeitsfläche');
        canvas.style.position = 'relative';
        canvas.style.overflow = 'auto';
        canvas.style.height = '100%';
        canvas.style.width = '100%';
      } else {
        canvas.className = 'canvas';
        canvas.setAttribute('aria-label', 'BPMN Arbeitsfläche');
      }

      const props = document.createElement('aside');
      props.className = 'properties';
      props.setAttribute('aria-label', 'Eigenschaften');

      layout.append(canvas, props);
      panel.appendChild(layout);

      let instance: any;
      if (kind === 'dmn') {
        instance = createFlowableDmnModeler({
          container: canvas
        });
      } else if (kind === 'event') {
        // For event tabs, hide the properties panel as the event editor has its own UI
        layout.className = 'diagram-pane hide-properties';

        // Create event editor instance with change tracking
        const init = pendingTabInits.get(id);
        const eventId = init?.title || `Event_${tabSequence}`;

        instance = createEventEditor(canvas, {
          model: {
            key: eventId.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: eventId,
            correlationParameters: [
              { name: 'businessKey', type: 'string' }
            ],
            payload: [
              { name: 'eventData', type: 'json' }
            ]
          },
          onChange: (model) => {
            // Handle model changes for dirty state tracking
            if (activeTabState && activeTabState.id === id) {
              const updateBaseline = (window as any).updateBaseline;
              if (updateBaseline) {
                updateBaseline();
              }
            }
          },
          onDirtyChange: (dirty) => {
            const state = tabStates.get(id);
            if (state) {
              state.dirty = dirty;
              const setDirtyState = (window as any).setDirtyState;
              if (setDirtyState) {
                setDirtyState(id, dirty);
              }
            }
          }
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
        kind
      };

      tabStates.set(id, state);
      const setupModelerForState = (window as any).setupModelerForState;
      if (setupModelerForState) setupModelerForState(state);
      updateEmptyStateVisibility();

      const initialXml = (window as any).initialXml || '';
      const initialDmnXml = (window as any).initialDmnXml || '';

      const init = pendingTabInits.get(id) ?? {
        title: kind === 'dmn' ? `Entscheidung ${tabSequence}` : `Diagramm ${tabSequence}`,
        xml: kind === 'dmn' ? initialDmnXml : initialXml,
        statusMessage: kind === 'dmn' ? 'Neue DMN Entscheidungstabelle geladen' : 'Neues Diagramm geladen',
        kind
      };
      pendingTabInits.delete(id);

      const bootstrapState = (window as any).bootstrapState;
      if (bootstrapState) {
        bootstrapState(state, init).catch((err: any) => {
          console.error(err);
        });
      }
    },
    onActivate(id) {
      setActiveTab(id ?? null);
    },
    async onClose(id) {
      const state = tabStates.get(id);
      if (!state) return true;
      if (!state.dirty) return true;
      let stateId: string | null = null;
      try {
        const getIdForState = (window as any).getIdForState;
        if (getIdForState) stateId = getIdForState(state);
      } catch {}
      const titleMsg = `${stateId ? `[${stateId}] ` : ''}Tab schließen?`;
      return await showConfirmDialog('Es gibt ungespeicherte Änderungen. Tab trotzdem schließen?', titleMsg);
    },
    onDestroyPanel(id) {
      pendingTabInits.delete(id);
      const state = tabStates.get(id);
      if (!state) return;
      if (state.dirtyTimer) clearTimeout(state.dirtyTimer);

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
    onAddRequest(kind: any) {
      createNewDiagram(kind);
    }
  });
}