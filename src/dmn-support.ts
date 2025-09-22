import { DiagramTabState } from './types';

let tabsControl: any = null;
let modeler: any = null;

export function setTabsControl(control: any) {
  tabsControl = control;
}

export function setModeler(m: any) {
  modeler = m;
}

export function syncDmnDecisionIdWithName(state: DiagramTabState) {
  if (!state.modeler) return;

  try {
    const activeView = state.modeler.getActiveView();
    if (!activeView || !activeView.element) return;

    const decision = activeView.element;
    if (!decision || !decision.name) return;

    const currentName = String(decision.name).trim();
    const currentId = String(decision.id || '');

    // Only sync if name is different from ID and name is not empty
    if (!currentName || currentName === currentId) return;

    // Create a sanitized ID from the name
    const sanitizedId = currentName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'Decision_1';

    // Update the decision ID to match the name
    if (decision.id !== sanitizedId) {
      console.log(`DMN Sync: Updating decision ID from "${decision.id}" to "${sanitizedId}"`);
      decision.id = sanitizedId;

      // Also update $attrs if it exists
      if (decision.$attrs) {
        decision.$attrs.id = sanitizedId;
      }
    }
  } catch (e) {
    console.warn('Failed to sync DMN decision ID with name:', e);
  }
}

export function updateDmnTabTitle(state: DiagramTabState) {
  if (!tabsControl || !state.id) {
    console.log('DMN Tab Title: Missing tabsControl or state.id');
    return;
  }

  try {
    console.log('DMN Tab Title: Updating for state:', state.id);

    const activeView = state.modeler.getActiveView();
    console.log('DMN Tab Title: Active view:', activeView);

    if (!activeView) {
      console.log('DMN Tab Title: No active view');
      return;
    }

    const decision = activeView.element;
    console.log('DMN Tab Title: Decision element:', decision);

    if (!decision) {
      console.log('DMN Tab Title: No decision element');
      return;
    }

    let title = 'DMN Entscheidung';

    console.log('DMN Tab Title: Decision properties:', {
      id: decision.id,
      name: decision.name,
      $attrs: decision.$attrs,
      keys: Object.keys(decision)
    });

    if (decision.name && decision.name.trim()) {
      title = decision.name.trim();
    } else if (decision.id) {
      title = decision.id;
    } else if (decision.$attrs && decision.$attrs.id) {
      title = decision.$attrs.id;
    }

    console.log('DMN Tab Title: Setting title to:', title);
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