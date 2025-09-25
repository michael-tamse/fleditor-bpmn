import { store } from './state/rootStore';
import type { TabState } from './state/types';
import { DiagramTabState } from './types';

let tabsControl: any = null;
let modeler: any = null;

// Per-tab locks to prevent sync during ID updates
const updatingIdByTab = new WeakMap<DiagramTabState, boolean>();

const lastKnownNameByTabId = new Map<string, string>();
const pendingSyncByTabId = new Map<string, ReturnType<typeof setTimeout>>();
const lastModelVersionByTabId = new Map<string, number>();

store.subscribe(() => {
  const appState = store.getState();

  for (const [tabId, timer] of pendingSyncByTabId.entries()) {
    if (!appState.tabs[tabId]) {
      clearTimeout(timer);
      pendingSyncByTabId.delete(tabId);
    }
  }

  for (const [tabId] of lastModelVersionByTabId.entries()) {
    if (!appState.tabs[tabId]) {
      lastModelVersionByTabId.delete(tabId);
      lastKnownNameByTabId.delete(tabId);
    }
  }

  Object.values(appState.tabs)
    .filter((tab: TabState) => tab.kind === 'dmn')
    .forEach((tab) => {
      const previousVersion = lastModelVersionByTabId.get(tab.id);
      if (previousVersion === undefined || previousVersion !== tab.modelVersion) {
        lastModelVersionByTabId.set(tab.id, tab.modelVersion);
        scheduleStoreDrivenSync(tab.id);
      }
    });
});

export function setTabsControl(control: any) {
  tabsControl = control;
}

export function setModeler(m: any) {
  modeler = m;
}

function resolveTabState(tabId: string): DiagramTabState | null {
  try {
    const getTabStates = (window as any).getTabStates;
    const map = getTabStates?.();
    if (map && typeof map.get === 'function') {
      return map.get(tabId) ?? null;
    }
  } catch (error) {
    console.warn('Failed to resolve DMN tab state:', error);
  }
  return null;
}

function scheduleStoreDrivenSync(tabId: string) {
  const existing = pendingSyncByTabId.get(tabId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingSyncByTabId.delete(tabId);
    const tabState = resolveTabState(tabId);
    if (!tabState) return;

    try { syncDmnDecisionIdWithName(tabState); } catch (error) { console.warn('DMN sync via store failed:', error); }
    try { updateDmnTabTitle(tabState); } catch (error) { console.warn('DMN title via store failed:', error); }
  }, 180);

  pendingSyncByTabId.set(tabId, timer);
}

export function syncDmnDecisionIdWithName(state: DiagramTabState) {
  // Only run for DMN tabs
  if (state.kind !== 'dmn' || !state.modeler) return;

  // Don't sync if we're currently updating the ID for this tab (prevents circular updates)
  if (updatingIdByTab.get(state)) {
    return;
  }

  performDmnSyncInternal(state, false);
}

export function syncDmnDecisionIdWithNameImmediate(state: DiagramTabState): string | null {
  performDmnSyncInternal(state, true);
  // Return the current ID after sync
  try {
    const activeView = state.modeler?.getActiveView();
    if (activeView && activeView.element && activeView.element.id) {
      return String(activeView.element.id);
    }
  } catch {}
  return null;
}

function performDmnSyncInternal(state: DiagramTabState, immediate: boolean = false) {
  if (state.kind !== 'dmn' || !state.modeler) return;

  try {
    const activeView = state.modeler.getActiveView();
    if (!activeView || !activeView.element) return;

    const decision = activeView.element;
    if (!decision) return;

    const currentName = (decision.name || '').trim();
    const currentId = String(decision.id || '');

    // Early exits
    if (!immediate && updatingIdByTab.get(state)) return;
    const tabKey = state.id;
    if (!immediate && lastKnownNameByTabId.get(tabKey) === currentName) return;
    if (!currentName || currentName === currentId) return;

    // Create a sanitized ID from the name
    const base = currentName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Check for ID collisions using ElementRegistry
    const viewer = state.modeler.getActiveViewer();
    const elementRegistry = viewer?.get('elementRegistry');
    let newId = base || 'Decision_1';
    if (elementRegistry?.get(newId)) {
      let i = 2;
      while (elementRegistry.get(`${base}_${i}`)) i++;
      newId = `${base}_${i}`;
    }

    // Update ID via Modeling API (not direct mutation)
    if (decision.id !== newId) {
      console.log(`DMN Sync: Updating decision ID from "${decision.id}" to "${newId}"`);

      const modeling = viewer?.get('modeling');
      if (!modeling) return;

      // Set lock to prevent circular updates for this tab
      if (!immediate) updatingIdByTab.set(state, true);

      try {
        modeling.updateProperties(decision, { id: newId });
        lastKnownNameByTabId.set(tabKey, currentName);
      } finally {
        // Clear lock after a short delay to allow events to settle
        if (!immediate) {
          setTimeout(() => updatingIdByTab.set(state, false), 50);
        }
      }
    } else {
      lastKnownNameByTabId.set(tabKey, currentName);
    }
  } catch (e) {
    console.warn('Failed to sync DMN decision ID with name:', e);
  }
}

export function updateDmnTabTitle(state: DiagramTabState) {
  if (!state?.id) {
    return;
  }

  try {
    const activeView = state.modeler?.getActiveView?.();
    if (!activeView) {
      return;
    }

    const decision = activeView.element;
    if (!decision) {
      return;
    }

    let baseTitle = 'DMN Entscheidung';

    if (decision.name && decision.name.trim()) {
      baseTitle = decision.name.trim();
    } else if (decision.id) {
      baseTitle = String(decision.id);
    } else if (decision.$attrs && decision.$attrs.id) {
      baseTitle = String(decision.$attrs.id);
    }

    const updateStateTitle = (window as any).updateStateTitle;
    if (typeof updateStateTitle === 'function') {
      updateStateTitle(state, baseTitle);
    } else {
      state.title = baseTitle;
    }

    const control = tabsControl ?? (window as any).tabsControl;
    if (!control?.setTitle) {
      return;
    }

    if (!tabsControl) {
      tabsControl = control;
    }

    const storeTab = store.getState().tabs[state.id];
    const displayTitle = storeTab?.dirty ? `* ${baseTitle}` : baseTitle;

    control.setTitle(state.id, displayTitle);
  } catch (e) {
    console.warn('Failed to update DMN tab title:', e);
  }
}

export function deriveDmnDecisionIdFromModel(): string | null {
  try {
    const activeView = modeler.getActiveView();
    if (!activeView || !activeView.element) return null;

    const decision = activeView.element;
    if (!decision) return null;

    if (decision.id) {
      return String(decision.id);
    } else if (decision.$attrs && decision.$attrs.id) {
      return String(decision.$attrs.id);
    }

    return null;
  } catch (e) {
    console.warn('Failed to derive DMN decision ID from model:', e);
    return null;
  }
}

export function createInitialDmnXmlWithDecisionId(decisionId: string): string {
  const initialDmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" name="DRD" namespace="http://flowable.org/dmn" exporter="Flowable Modeler" exporterVersion="1.0" expressionLanguage="juel">
  <decision id="Decision_1" name="Decision 1">
    <decisionTable id="DecisionTable_1" hitPolicy="FIRST">
      <input id="Input_1" label="Input">
        <inputExpression id="InputExpression_1" typeRef="string" expressionLanguage="juel">
          <text></text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Output" typeRef="string" />
      <rule id="Rule_1">
        <inputEntry id="UnaryTests_1">
          <text></text>
        </inputEntry>
        <outputEntry id="LiteralExpression_1">
          <text></text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

  try {
    let xml = initialDmnXml;
    xml = xml.replace(/(<decision\s+id=")Decision_\d+("[^>]*>)/, `$1${decisionId}$2`);
    xml = xml.replace(/(dmnElementRef=")Decision_\d+(")/, `$1${decisionId}$2`);
    return xml;
  } catch {
    return initialDmnXml;
  }
}

export function getIdForState(state: DiagramTabState): string | null {
  try {
    if (state.kind === 'dmn') {
      // For DMN, try to get ID directly from the modeler in the state
      if (state.modeler) {
        try {
          const activeView = state.modeler.getActiveView();
          if (activeView && activeView.element && activeView.element.id) {
            return String(activeView.element.id);
          }
        } catch {}

        // Fallback: try to get decision from registry
        try {
          const elementRegistry = state.modeler.get('elementRegistry');
          if (elementRegistry) {
            const decisions = elementRegistry.filter(element => element.type === 'dmn:Decision');
            if (decisions.length > 0 && decisions[0].businessObject && decisions[0].businessObject.id) {
              return String(decisions[0].businessObject.id);
            }
          }
        } catch {}
      }
      return null;
    } else {
      // For BPMN, try to get ID directly from the modeler in the state first
      if (state.modeler) {
        try {
          const canvas = state.modeler.get('canvas');
          const rootElement = canvas.getRootElement();
          const businessObject = rootElement.businessObject;
          if (businessObject && businessObject.id) {
            return String(businessObject.id);
          }
        } catch {}
      }

      // Fallback: use the existing pattern
      const runWithState = (window as any).runWithState;
      if (!runWithState) return null;

      return runWithState(state, () => {
        const deriveProcessIdFromModel = (window as any).deriveProcessIdFromModel;
        return deriveProcessIdFromModel ? deriveProcessIdFromModel() : null;
      });
    }
  } catch (e) {
    console.warn('Failed to get ID for state:', e);
    return null;
  }
}
