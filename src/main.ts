// CSS imports
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
import './event-editor/event-editor.css';

// Module imports
import {
  openFileAsTab,
  triggerOpen,
  saveXML,
  saveSVG,
  saveXMLWithSidecarFallback,
  saveSVGWithSidecarFallback,
  openViaSidecarOrFile,
  setActiveTabState as setFileOpsActiveTabState,
  setModeler as setFileOpsModeler,
  setSidecar as setFileOpsSidecar,
  setTabSequence as setFileOpsTabSequence
} from './file-operations';

import {
  setStatus,
  updateEmptyStateVisibility,
  debug,
  zoom,
  zoomReset,
  fitViewport,
  setMenubarVisible,
  setPropertyPanelVisible,
  getMenubarVisible,
  getPropertyPanelVisible,
  updateToolbarExtras,
  setModeler as setUIModeler,
  setTabStates as setUITabStates
} from './ui-controls';

import {
  setDirtyState,
  updateBaseline,
  setTabsControl as setChangeTrackerTabsControl,
  setSidecar as setChangeTrackerSidecar,
  bindEventEditor
} from './change-tracker';

import {
  initTabs,
  createNewDiagram,
  getTabStates,
  getActiveState,
  getTabsControl,
  getModeler,
  setTabSequence,
  findTabByProcessId,
  findEventTabByKey,
  createDiagramTab,
  runWithState,
  updateStateTitle,
  persistActiveTab,
  maybeRestoreActiveTab
} from './tab-manager';

import {
  setupModelerForState,
  bootstrapState,
  handleShapeAdded,
  bindDragAndDrop,
  customizeProviders,
  initialXml,
  initialDmnXml,
  setModeler as setModelerSetupModeler
} from './modeler-setup';

import {
  applyPreExportConfigurations,
  setModeler as setModelTransformationsModeler
} from './model-transformations';

import {
  updateDmnTabTitle,
  syncDmnDecisionIdWithName,
  syncDmnDecisionIdWithNameImmediate,
  deriveDmnDecisionIdFromModel,
  createInitialDmnXmlWithDecisionId,
  getIdForState,
  setTabsControl as setDmnTabsControl,
  setModeler as setDmnModeler
} from './dmn-support';

import { SidecarBridge } from './sidecar/bridge';
import { createDomTransport } from './sidecar/transports/dom';
import { createPostMessageTransport } from './sidecar/transports/postMessage';

// Global state
let sidecar: SidecarBridge | null = null;
let sidecarConnected = false;

// Helper function to compute next process ID
function computeNextProcessId(): string {
  const tabStates = getTabStates();
  const existingProcessIds = new Set<string>();

  for (const state of tabStates.values()) {
    try {
      const id = getIdForState(state);
      if (id && /^Process_\d+$/.test(id)) {
        existingProcessIds.add(id);
      }
    } catch {}
  }

  let counter = 1;
  while (existingProcessIds.has(`Process_${counter}`)) {
    counter++;
  }
  return `Process_${counter}`;
}

// Initialize sidecar
function initSidecar() {
  const inIframe = window.self !== window.top;
  try {
    const transport = inIframe ? createPostMessageTransport(window.parent) : createDomTransport();
    sidecar = new SidecarBridge(transport, 'component');

    // Handle inbound UI ops
    sidecar.onRequest('ui.setPropertyPanel', async (p: any) => {
      setPropertyPanelVisible(!!(p && p.visible));
      try {
        sidecar?.emitEvent('ui.state', {
          propertyPanel: getPropertyPanelVisible(),
          menubar: getMenubarVisible()
        });
      } catch {}
      return { ok: true };
    });

    sidecar.onRequest('ui.setMenubar', async (p: any) => {
      setMenubarVisible(!!(p && p.visible));
      try {
        sidecar?.emitEvent('ui.state', {
          propertyPanel: getPropertyPanelVisible(),
          menubar: getMenubarVisible()
        });
      } catch {}
      return { ok: true };
    });

    sidecar.onRequest('doc.openExternal', async (p: any) => {
      try {
        const xml = String(p?.xml ?? '');
        const json = String(p?.json ?? '');

        if (!xml.trim() && !json.trim()) return { ok: false };

        const { sanitizeFileName } = await import('./bpmn-xml-utils');
        const fileName = typeof p?.fileName === 'string' ? sanitizeFileName(p.fileName) : undefined;

        if (json.trim()) {
          // Handle event JSON files
          debug('open-external: received event JSON from host', { fileName, size: json.length });
          try {
            setStatus(fileName ? `Host: Event-Datei empfangen – ${fileName}` : 'Host: Event-Datei empfangen');
          } catch {}
          const { openEventFile } = await import('./file-operations');
          await openEventFile(json, fileName || 'event.event', 'host');
        } else {
          // Handle XML files (BPMN/DMN)
          debug('open-external: received XML from host', { fileName, size: xml.length });
          try {
            setStatus(fileName ? `Host: Datei empfangen – ${fileName}` : 'Host: Datei empfangen');
          } catch {}
          const { openXmlConsideringDuplicates } = await import('./file-operations');
          await openXmlConsideringDuplicates(xml, fileName, 'host');
        }

        return { ok: true };
      } catch (e: any) {
        debug('open-external: error', String(e?.message || e));
        return { ok: false, error: String(e?.message || e) } as any;
      }
    });

    let handshakeAttempts = 0;
    const tryHandshake = () => {
      if (hostAvailable()) return;
      handshakeAttempts++;
      debug('handshake: attempt', handshakeAttempts);
      sidecar!.handshake(800).then((caps) => {
        sidecarConnected = !!caps;
        if (hostAvailable()) {
          debug('handshake: connected', {
            host: (sidecar as any).capabilities?.host,
            features: (sidecar as any).capabilities?.features
          });

          // Now that sidecar is connected, configure modules
          setFileOpsSidecar(sidecar);
          setChangeTrackerSidecar(sidecar);
          (window as any).sidecar = sidecar; // Update global reference

          try { setStatus('Host verbunden'); } catch {}
          try {
            sidecar?.emitEvent('ui.state', {
              propertyPanel: getPropertyPanelVisible(),
              menubar: getMenubarVisible()
            });
          } catch {}
          return;
        }
        if (handshakeAttempts < 5) setTimeout(tryHandshake, 1000);
      }).catch(() => {
        if (handshakeAttempts < 5) setTimeout(tryHandshake, 1000);
      });
    };
    tryHandshake();
  } catch (e) {
    debug('sidecar init failed', e);
  }
}

function hostAvailable(): boolean {
  try { return !!(sidecar && (sidecar as any).capabilities); } catch { return false; }
}

// Initialize all modules with their dependencies
function initializeModules() {
  // Set up cross-module dependencies
  setFileOpsModeler(getModeler());
  setFileOpsActiveTabState(getActiveState());
  setFileOpsTabSequence(1);

  setUIModeler(getModeler());
  setUITabStates(getTabStates());

  setChangeTrackerTabsControl(getTabsControl());

  setModelerSetupModeler(getModeler());
  setModelTransformationsModeler(getModeler());

  setDmnTabsControl(getTabsControl());
  setDmnModeler(getModeler());

  // Sidecar setup will be done after sidecar is initialized

  // Export globals for module communication
  (window as any).tabsControl = getTabsControl();
  (window as any).sidecar = sidecar;
  (window as any).setActiveTab = async (id: string | null) => {
    const { setActiveTab } = await import('./tab-manager');
    setActiveTab(id);
  };
  (window as any).getActiveState = getActiveState;
  (window as any).getIdForState = getIdForState;
  (window as any).updateStateTitle = updateStateTitle;
  (window as any).persistActiveTab = persistActiveTab;
  (window as any).maybeRestoreActiveTab = maybeRestoreActiveTab;
  (window as any).findTabByProcessId = findTabByProcessId;
  (window as any).findEventTabByKey = findEventTabByKey;
  (window as any).createDiagramTab = createDiagramTab;
  (window as any).runWithState = runWithState;
  (window as any).bootstrapState = bootstrapState;
  (window as any).setupModelerForState = setupModelerForState;
  (window as any).updateBaseline = updateBaseline;
  (window as any).setDirtyState = setDirtyState;
  (window as any).bindEventEditor = bindEventEditor;
  (window as any).updateDmnTabTitle = updateDmnTabTitle;
  (window as any).syncDmnDecisionIdWithName = syncDmnDecisionIdWithName;
  (window as any).syncDmnDecisionIdWithNameImmediate = syncDmnDecisionIdWithNameImmediate;
  (window as any).openFileIntoState = async (file: File, state: any) => {
    const { openFileIntoState } = await import('./file-operations');
    return openFileIntoState(file, state);
  };
  (window as any).deriveProcessIdFromModel = async () => {
    const { deriveProcessIdFromModel } = await import('./file-operations');
    return deriveProcessIdFromModel();
  };
  (window as any).computeNextProcessId = computeNextProcessId;
  (window as any).createInitialXmlWithProcessId = async (pid: string) => {
    const { createInitialXmlWithProcessId } = await import('./bpmn-xml-utils');
    return createInitialXmlWithProcessId(pid, initialXml);
  };
  (window as any).createInitialDmnXmlWithDecisionId = createInitialDmnXmlWithDecisionId;
  (window as any).initialXml = initialXml;
  (window as any).initialDmnXml = initialDmnXml;
  (window as any).applyPropertyPanelVisibility = async (state: any) => {
    const { applyPropertyPanelVisibility } = await import('./ui-controls');
    return applyPropertyPanelVisibility(state);
  };
  (window as any).setStatus = setStatus;
  (window as any).handleShapeAdded = handleShapeAdded;
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  updateEmptyStateVisibility();
  updateToolbarExtras();

  // Initialize modules after tabs are ready
  setTimeout(() => {
    initializeModules();
    initSidecar();

    // Toolbar Events - register after modules are initialized
    document.querySelector('#btn-open')?.addEventListener('click', openViaSidecarOrFile);
    document.querySelector('#btn-save-xml')?.addEventListener('click', saveXMLWithSidecarFallback);

    // Initialize toolbar button states
    const saveXmlBtn = document.querySelector('#btn-save-xml') as HTMLButtonElement;
    if (saveXmlBtn) {
      saveXmlBtn.disabled = true;
      saveXmlBtn.title = 'Kein Diagramm geöffnet';
    }
  }, 100);

  // Toolbar actions that are contributed per editor kind
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('#btn-save-svg')) {
      saveSVGWithSidecarFallback();
      return;
    }

    if (target.closest('#btn-zoom-in')) {
      zoom(+0.2);
      return;
    }

    if (target.closest('#btn-zoom-out')) {
      zoom(-0.2);
      return;
    }

    if (target.closest('#btn-zoom-reset')) {
      zoomReset();
      return;
    }

    if (target.closest('#btn-fit')) {
      fitViewport();
    }
  });

  // Start-Tiles Event-Handler
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tile = target.closest('.tile[data-kind]') as HTMLElement;
    if (tile) {
      const kind = tile.getAttribute('data-kind') as 'bpmn' | 'dmn' | 'event';
      if (kind) createNewDiagram(kind);
    }
  });

  // File Input
  const fileInput = document.querySelector('#file-input') as HTMLInputElement;
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const files = fileInput.files ? Array.from(fileInput.files) : [];
      for (const f of files) {
        await openFileAsTab(f);
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'o':
          e.preventDefault();
          openViaSidecarOrFile();
          break;
        case 's':
          e.preventDefault();
          saveXMLWithSidecarFallback();
          break;
        case 'n':
          e.preventDefault();
          createNewDiagram('bpmn');
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoom(+0.2);
          break;
        case '-':
          e.preventDefault();
          zoom(-0.2);
          break;
        case '0':
          e.preventDefault();
          zoomReset();
          break;
      }
    }
  });

  setStatus('Editor geladen');
});
