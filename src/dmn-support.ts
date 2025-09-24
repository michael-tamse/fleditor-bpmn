import { DiagramTabState } from './types';

let tabsControl: any = null;
let modeler: any = null;

// Per-tab sync timers for debouncing
const syncTimerByTab = new WeakMap<DiagramTabState, any>();

// Per-tab locks to prevent sync during ID updates
const updatingIdByTab = new WeakMap<DiagramTabState, boolean>();

// Per-tab tracking of last known name to detect actual changes
const lastKnownNameByTab = new WeakMap<DiagramTabState, string>();

export function setTabsControl(control: any) {
  tabsControl = control;
}

export function setModeler(m: any) {
  modeler = m;
}

export function syncDmnDecisionIdWithName(state: DiagramTabState) {
  // Only run for DMN tabs
  if (state.kind !== 'dmn' || !state.modeler) return;

  // Don't sync if we're currently updating the ID for this tab (prevents circular updates)
  if (updatingIdByTab.get(state)) {
    return;
  }

  // Clear any pending sync operation for this tab
  const existingTimer = syncTimerByTab.get(state);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Use longer debounce time to allow user to finish typing
  const timer = setTimeout(() => {
    performDmnSync(state);
  }, 500);
  syncTimerByTab.set(state, timer);
}

function performDmnSync(state: DiagramTabState) {
  if (state.kind !== 'dmn' || !state.modeler) return;

  try {
    const activeView = state.modeler.getActiveView();
    if (!activeView || !activeView.element) return;

    const decision = activeView.element;
    if (!decision) return;

    const currentName = (decision.name || '').trim();
    const currentId = String(decision.id || '');

    // Early exits
    if (updatingIdByTab.get(state)) return;
    if (lastKnownNameByTab.get(state) === currentName) return;
    if (!currentName || currentName === currentId) return;

    // Create a sanitized ID from the name
    const base = currentName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Check for ID collisions using ElementRegistry
    const elementRegistry = state.modeler.get('elementRegistry');
    let newId = base || 'Decision_1';
    if (elementRegistry?.get(newId)) {
      let i = 2;
      while (elementRegistry.get(`${base}_${i}`)) i++;
      newId = `${base}_${i}`;
    }

    // Update ID via Modeling API (not direct mutation)
    if (decision.id !== newId) {
      console.log(`DMN Sync: Updating decision ID from "${decision.id}" to "${newId}"`);

      const viewer = state.modeler.getActiveViewer();
      const modeling = viewer?.get('modeling');
      if (!modeling) return;

      // Set lock to prevent circular updates for this tab
      updatingIdByTab.set(state, true);

      try {
        modeling.updateProperties(decision, { id: newId });
        lastKnownNameByTab.set(state, currentName);
      } finally {
        // Clear lock after a short delay to allow events to settle
        setTimeout(() => updatingIdByTab.set(state, false), 50);
      }
    }
  } catch (e) {
    console.warn('Failed to sync DMN decision ID with name:', e);
  }
}

export function updateDmnTabTitle(state: DiagramTabState) {
  if (!tabsControl || !state.id) {
    return;
  }

  try {
    const activeView = state.modeler.getActiveView();
    if (!activeView) {
      return;
    }

    const decision = activeView.element;
    if (!decision) {
      return;
    }

    let title = 'DMN Entscheidung';

    if (decision.name && decision.name.trim()) {
      title = decision.name.trim();
    } else if (decision.id) {
      title = decision.id;
    } else if (decision.$attrs && decision.$attrs.id) {
      title = decision.$attrs.id;
    }

    tabsControl.setTitle(state.id, title);
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